import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstanceConfig } from '../instances/entities/instance-config.entity.js';
import { Redis } from 'ioredis';
import { useRedisAuthState } from './utils/redis-auth-state.js';
import makeWASocket, {
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import {
  Instance,
  MediaFile,
  WebhookData,
  ChatInfo,
  ContactInfo,
} from './interfaces/whatsapp.interface.js';
import { WebhookService } from '../webhook/webhook.service.js';
import { phoneNumberToJid } from './utils/jid.js';

const MEDIA_EXTENSION_FALLBACK: Record<string, string> = {
  image: 'jpg',
  audio: 'ogg',
  video: 'mp4',
  document: 'bin',
  sticker: 'webp',
};

@Injectable()
export class WhatsappService implements OnModuleDestroy, OnModuleInit {
  private static readonly MAX_RETRIES = 5;
  private readonly logger = new Logger(WhatsappService.name);
  private instances: Map<string, Instance> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private mediaDir: string;
  private readonly redis: Redis;

  private readonly MESSAGE_TYPE_DETECTORS: Array<{
    test: (m: any) => boolean;
    resolve: string | ((m: any) => string);
  }> = [
    { test: (m) => !!(m.conversation || m.extendedTextMessage), resolve: 'text' },
    { test: (m) => !!m.imageMessage, resolve: 'image' },
    { test: (m) => !!m.audioMessage, resolve: (m) => (m.audioMessage.ptt ? 'voice' : 'audio') },
    { test: (m) => !!m.videoMessage, resolve: 'video' },
    { test: (m) => !!m.documentMessage, resolve: 'document' },
    { test: (m) => !!m.stickerMessage, resolve: 'sticker' },
    { test: (m) => !!m.locationMessage, resolve: 'location' },
    { test: (m) => !!m.contactMessage, resolve: 'contact' },
    { test: (m) => !!m.buttonsResponseMessage, resolve: 'button_response' },
    { test: (m) => !!m.listResponseMessage, resolve: 'list_response' },
    { test: (m) => !!m.reactionMessage, resolve: 'reaction' },
  ];

  constructor(
    private configService: ConfigService,
    private webhookService: WebhookService,
    @InjectRepository(InstanceConfig)
    private instanceConfigRepo: Repository<InstanceConfig>,
  ) {
    this.redis = new Redis(this.configService.get<string>('redisUrl') || 'redis://localhost:6379');
    this.mediaDir = this.configService.get<string>('mediaDir') || './media';
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  async onModuleInit(): Promise<void> {
    const configs = await this.instanceConfigRepo.find();
    if (configs.length === 0) return;

    this.logger.log(`Restoring ${configs.length} instance(s) from database...`);

    // Restore instances sequentially with a delay between each to avoid
    // WhatsApp "conflict: replaced" errors when the server restarts quickly
    // (the previous WS session needs time to expire on WhatsApp's side).
    const RESTORE_DELAY_MS = 3_000;

    for (const config of configs) {
      try {
        await this.createInstance(
          config.name,
          config.webhookUrl ?? undefined,
          config.webhookHeaders,
          config.webhookEnabled,
          config.webhookEvents,
        );
        this.logger.log(`Restored instance "${config.name}"`);
      } catch (error) {
        this.logger.error(
          `Failed to restore instance "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (configs.indexOf(config) < configs.length - 1) {
        await new Promise((r) => setTimeout(r, RESTORE_DELAY_MS));
      }
    }
  }

  async createInstance(
    instanceName: string,
    webhookUrl?: string,
    webhookHeaders?: Record<string, string>,
    webhookEnabled?: boolean,
    webhookEvents?: string[],
  ): Promise<Instance> {
    if (this.instances.has(instanceName)) {
      throw new Error(`Papagai ${instanceName} já existe!`);
    }

    const { state, saveCreds } = await useRedisAuthState(this.redis, instanceName);

    let version: [number, number, number] | undefined;
    try {
      const result = await fetchLatestWaWebVersion({
        headers: {
          'sec-fetch-site': 'none',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      version = result.error ? undefined : result.version;
      if (result.error) {
        const fallback = await fetchLatestBaileysVersion({}).catch(() => ({ version: undefined }));
        version = fallback.version;
      }
    } catch {
      const fallback = await fetchLatestBaileysVersion({}).catch(() => ({ version: undefined }));
      version = fallback.version;
    }
    this.logger.debug(`Using Baileys version: ${version?.join('.') ?? 'built-in default'}`);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: [`Papagai-${instanceName}`, 'Chrome', '120.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      defaultQueryTimeoutMs: 60000,
      generateHighQualityLinkPreview: true,
      shouldResendMessageOn475AckError: true,
      getMessage: async () => ({ conversation: '' }),
    });

    const DEFAULT_WEBHOOK_EVENTS = ['message', 'message_update', 'qr', 'connected', 'disconnected'];

    const resolvedWebhookEnabled = webhookUrl ? (webhookEnabled ?? true) : false;
    const resolvedWebhookEvents = webhookEvents ?? DEFAULT_WEBHOOK_EVENTS;

    const instance: Instance = {
      socket: sock,
      webhookUrl: webhookUrl || null,
      webhookHeaders: webhookHeaders || {},
      webhookEnabled: resolvedWebhookEnabled,
      webhookEvents: resolvedWebhookEvents,
      name: instanceName,
      connected: false,
      qr: null,
      saveCreds,
      startTime: Date.now(),
      lastConnectedAt: null,
      retryCount: 0,
    };

    this.instances.set(instanceName, instance);
    this.registerSocketEvents(instance);

    await this.instanceConfigRepo.upsert(
      {
        name: instanceName,
        webhookUrl: webhookUrl ?? null,
        webhookHeaders: webhookHeaders ?? {},
        webhookEnabled: resolvedWebhookEnabled,
        webhookEvents: resolvedWebhookEvents,
      },
      ['name'],
    );

    this.logger.log(`Instance "${instanceName}" created`);
    return instance;
  }

  private registerSocketEvents(instance: Instance): void {
    const sock = instance.socket;

    sock.ev.on('connection.update', (update) =>
      this.handleConnectionUpdate(instance, update),
    );

    sock.ev.on('creds.update', instance.saveCreds);

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.key.fromMe) {
          this.handleIncomingMessage(instance, msg).catch((err) =>
            this.logger.error(
              `Error handling incoming message for "${instance.name}": ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const update of updates) {
        this.logger.debug(
          `Message status update for "${instance.name}": id=${update.key?.id} status=${update.update?.status}`,
        );
      }
      const data: WebhookData = {
        event: 'message_update',
        instance: instance.name,
        updates,
        timestamp: Date.now(),
      };
      this.webhookService.sendWebhook(instance, data).catch(() => undefined);
    });
  }

  private handleConnectionUpdate(instance: Instance, update: any): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      instance.qr = qr;
      this.qrCodes.set(instance.name, qr);
      this.logger.log(`QR code generated for instance "${instance.name}"`);
      const data: WebhookData = {
        event: 'qr',
        instance: instance.name,
        qr,
        timestamp: Date.now(),
      };
      this.webhookService.sendWebhook(instance, data).catch(() => undefined);
    }

    if (connection === 'open') {
      instance.connected = true;
      instance.lastConnectedAt = Date.now();
      instance.retryCount = 0;
      instance.qr = null;
      this.qrCodes.delete(instance.name);
      const phoneNumber = (instance.socket.user?.id ?? '').split(':')[0];
      this.logger.log(
        `Instance "${instance.name}" connected as ${phoneNumber}`,
      );
      const data: WebhookData = {
        event: 'connected',
        instance: instance.name,
        phoneNumber,
        timestamp: Date.now(),
      };
      this.webhookService.sendWebhook(instance, data).catch(() => undefined);
    }

    if (connection === 'close') {
      this.handleConnectionClose(instance, lastDisconnect);
    }
  }

  private handleConnectionClose(instance: Instance, lastDisconnect: any): void {
    const statusCode =
      lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null;
    const isLoggedOut = statusCode === DisconnectReason.loggedOut;
    const isConflict = statusCode === 440;

    const retryCount = instance.retryCount + 1;
    const willReconnect = !isLoggedOut && !isConflict && retryCount <= WhatsappService.MAX_RETRIES;

    this.logger.warn(
      `Instance "${instance.name}" disconnected — statusCode=${statusCode}, attempt=${retryCount}/${WhatsappService.MAX_RETRIES}, willReconnect=${willReconnect}`,
    );

    const data: WebhookData = {
      event: 'disconnected',
      instance: instance.name,
      reason: lastDisconnect?.error?.message || 'Unknown',
      willReconnect,
      timestamp: Date.now(),
    };
    this.webhookService.sendWebhook(instance, data).catch(() => undefined);

    if (isConflict) {
      instance.connected = false;
      this.instances.delete(instance.name);
      this.qrCodes.delete(instance.name);
      this.logger.warn(
        `Instance "${instance.name}" replaced by another session (conflict) — not reconnecting`,
      );
      return;
    }

    if (isLoggedOut) {
      instance.connected = false;
      this.instances.delete(instance.name);
      this.qrCodes.delete(instance.name);

      const connectedDurationMs = instance.lastConnectedAt ? Date.now() - instance.lastConnectedAt : null;
      const isSyncFailure = connectedDurationMs !== null && connectedDurationMs < 10_000;

      if (isSyncFailure) {
        // Baileys self-logout due to app state sync race condition on fresh connection.
        // Keys saved during the brief session may be needed — retry without purging.
        this.logger.warn(`Instance "${instance.name}" hit app state sync failure (connected for ${connectedDurationMs}ms) — retrying without purge`);
        setTimeout(() => this.reconnectInstance(instance.name, 0), 3000);
      } else {
        this.purgeInstance(instance.name).catch((err: unknown) =>
          this.logger.error(`Failed to purge logged-out instance "${instance.name}": ${err instanceof Error ? err.message : String(err)}`),
        );
      }
      return;
    }

    instance.connected = false;
    instance.retryCount = retryCount;

    if (retryCount > WhatsappService.MAX_RETRIES) {
      this.logger.error(
        `Instance "${instance.name}" gave up reconnecting after ${WhatsappService.MAX_RETRIES} attempts`,
      );
      instance.connected = false;
      this.instances.delete(instance.name);
      this.qrCodes.delete(instance.name);
      return;
    }

    setTimeout(() => this.reconnectInstance(instance.name, retryCount), 5000);
  }

  private async handleIncomingMessage(
    instance: Instance,
    msg: any,
  ): Promise<void> {
    const sender: string = msg.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    const pushName: string = msg.pushName || 'Unknown';
    const messageType = this.getMessageType(msg);

    const webhookData: WebhookData = {
      event: 'message',
      instance: instance.name,
      from: phoneNumber,
      pushName,
      messageId: msg.key.id,
      messageType,
      timestamp: msg.messageTimestamp || Date.now(),
      isGroup: sender.includes('@g.us'),
      groupId: sender.includes('@g.us') ? sender : null,
    };

    await this.enrichWebhookData(webhookData, msg, messageType);

    this.logger.log(
      `Incoming ${messageType} from ${phoneNumber} on instance "${instance.name}"`,
    );
    await this.webhookService.sendWebhook(instance, webhookData);
  }

  private async enrichWebhookData(
    webhookData: WebhookData,
    msg: any,
    messageType: string,
  ): Promise<void> {
    type Enricher = (msg: any, data: WebhookData) => Promise<void>;
    const ENRICHERS: Partial<Record<string, Enricher>> = {
      text: async (msg, data) => {
        data.text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      },
      image: async (msg, data) => {
        const r = await this.downloadMedia(msg, 'image');
        if (r) { data.image = r; data.caption = r.caption; }
      },
      audio: async (msg, data) => {
        const r = await this.downloadMedia(msg, 'audio');
        if (r) { data.audio = r; data.duration = r.duration; }
      },
      voice: async (msg, data) => {
        const r = await this.downloadMedia(msg, 'audio');
        if (r) { data.voice = r; data.duration = r.duration; }
      },
      video: async (msg, data) => {
        const r = await this.downloadMedia(msg, 'video');
        if (r) { data.video = r; data.caption = r.caption; data.duration = r.duration; }
      },
      document: async (msg, data) => {
        const r = await this.downloadMedia(msg, 'document');
        if (r) { data.document = r; data.filename = r.filename; }
      },
      sticker: async (msg, data) => {
        const r = await this.downloadMedia(msg, 'sticker');
        if (r) data.sticker = r;
      },
      location: async (msg, data) => {
        const loc = msg.message?.locationMessage;
        data.location = {
          degreesLatitude: loc?.degreesLatitude,
          degreesLongitude: loc?.degreesLongitude,
          name: loc?.name,
          address: loc?.address,
        };
      },
      contact: async (msg, data) => {
        const contact = msg.message?.contactMessage;
        const vcard: string = contact?.vcard || '';
        data.contact = {
          displayName: contact?.displayName || '',
          vcard,
          numbers: this.parseVCard(vcard),
        };
      },
      button_response: async (msg, data) => {
        const btn = msg.message?.buttonsResponseMessage;
        data.buttonId = btn?.selectedButtonId;
        data.text = btn?.selectedDisplayText;
      },
      reaction: async (msg, data) => {
        const react = msg.message?.reactionMessage;
        data.reaction = react?.text;
        data.parentMessageId = react?.key?.id;
      },
    };
    const enrich = ENRICHERS[messageType];
    if (enrich) await enrich(msg, webhookData);
  }

  private getMessageType(msg: any): string {
    const m = msg.message;
    if (!m) return 'unknown';
    const detector = this.MESSAGE_TYPE_DETECTORS.find(({ test }) => test(m));
    if (!detector) return 'unknown';
    return typeof detector.resolve === 'function' ? detector.resolve(m) : detector.resolve;
  }

  private async downloadMedia(
    msg: any,
    mediaType: string,
  ): Promise<MediaFile | null> {
    try {
      const messageKey = `${mediaType}Message`;
      const mediaMessage: any = msg.message?.[messageKey] ?? null;
      if (!mediaMessage) return null;

      const stream = await downloadContentFromMessage(mediaMessage, mediaType as any);

      const mimeType: string = mediaMessage.mimetype || '';
      const extensionFromMime = mimeType.split('/')[1];
      const extension =
        extensionFromMime || MEDIA_EXTENSION_FALLBACK[mediaType] || 'bin';

      const fileName = `${Date.now()}_${mediaType}.${extension}`;
      const filePath = path.join(this.mediaDir, fileName);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(filePath, buffer);

      return {
        path: filePath,
        url: `/media/${fileName}`,
        filename: fileName,
        mimetype: mimeType,
        size: mediaMessage.fileLength ?? buffer.length,
        caption: mediaMessage.caption || null,
        duration: mediaMessage.seconds ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to download ${mediaType} media for message ${msg.key?.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    if (url.startsWith('http')) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data as ArrayBuffer);
    }
    return fs.readFileSync(url);
  }

  private parseVCard(vcard: string): string[] {
    const numbers: string[] = [];
    const regex = /TEL[^:]*:([^\r\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(vcard)) !== null) {
      const number = match[1].trim();
      if (number) numbers.push(number);
    }
    return numbers;
  }

  private getConnectedInstance(instanceName: string): Instance {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`Papagai ${instanceName} não está conectado!`);
    }
    return instance;
  }

  private async purgeInstance(instanceName: string): Promise<void> {
    const redisKeys = await this.redis.keys(`papagai:${instanceName}:*`);
    if (redisKeys.length > 0) {
      await this.redis.del(...redisKeys);
    }
    await this.instanceConfigRepo.delete({ name: instanceName });
    this.logger.log(`Purged storage for logged-out instance "${instanceName}"`);
  }

  async send(instanceName: string, to: string, content: any): Promise<any> {
    const instance = this.getConnectedInstance(instanceName);
    const jid = await this.resolveJid(instance, to);
    this.logger.debug(`Sending to JID: ${jid}, content keys: ${Object.keys(content).join(', ')}`);

    let payload = content;
    const myJid = instance.socket.user?.id ?? '';

    if (content.listMessage) {
      // listMessage requires a forward wrapper for cross-platform (iOS) compatibility
      payload = {
        forward: {
          key: { remoteJid: myJid, fromMe: true },
          message: content,
        },
      };
    }

    const result = await instance.socket.sendMessage(jid, payload);
    this.logger.debug(`sendMessage result: id=${result?.key?.id} status=${result?.status}`);
    return result;
  }

  private async resolveJid(instance: Instance, to: string): Promise<string> {
    const candidateJid = phoneNumberToJid(to);
    try {
      const results = await instance.socket.onWhatsApp(candidateJid);
      const match = results?.[0];
      if (match?.exists && match?.jid) {
        this.logger.debug(`onWhatsApp resolved ${to} → ${match.jid}`);
        return match.jid;
      }
      // Number not found with 9-digit; try without if it was inserted
      const fallbackJid = phoneNumberToJid(to.replace(/^55(\d{2})9(\d{8})$/, '55$1$2'));
      if (fallbackJid !== candidateJid) {
        const fallbackResults = await instance.socket.onWhatsApp(fallbackJid);
        const fallbackMatch = fallbackResults?.[0];
        if (fallbackMatch?.exists && fallbackMatch?.jid) {
          this.logger.debug(`onWhatsApp resolved ${to} via fallback → ${fallbackMatch.jid}`);
          return fallbackMatch.jid;
        }
      }
      this.logger.warn(`${to} not found on WhatsApp (tried ${candidateJid})`);
    } catch (err) {
      this.logger.warn(`onWhatsApp check failed for ${to}: ${err instanceof Error ? err.message : String(err)} — using constructed JID`);
    }
    return candidateJid;
  }

  async getContactInfo(
    instanceName: string,
    number: string,
  ): Promise<ContactInfo> {
    const instance = this.getConnectedInstance(instanceName);
    const jid = phoneNumberToJid(number);

    try {
      const onWhatsAppResults = await instance.socket.onWhatsApp(jid);
      const onWhatsApp = onWhatsAppResults?.[0];
      const profilePicture = await instance.socket
        .profilePictureUrl(jid, 'image')
        .catch(() => null);

      return {
        phoneNumber: number,
        pushName: (onWhatsApp as any)?.notify || null,
        profilePicture: profilePicture || null,
      };
    } catch (error) {
      this.logger.warn(
        `Could not fetch contact info for ${number} on instance "${instanceName}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return { phoneNumber: number, pushName: null };
    }
  }

  async getChats(
    instanceName: string,
    includeMessages: boolean,
  ): Promise<ChatInfo[]> {
    const instance = this.getConnectedInstance(instanceName);

    try {
      const sock = instance.socket as any;
      const chats: any[] = typeof sock.getChats === 'function'
        ? await sock.getChats()
        : [];

      return chats.map((chat: any) => ({
        phoneNumber: (chat.id || '').split('@')[0],
        pushName: chat.name || chat.notify || '',
        unreadCount: chat.unreadCount || 0,
        lastMessage: includeMessages ? chat.lastMessage?.message?.conversation : undefined,
        timestamp: chat.conversationTimestamp || Date.now(),
        isGroup: (chat.id || '').includes('@g.us'),
      }));
    } catch (error) {
      this.logger.warn(
        `Could not fetch chats for instance "${instanceName}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async updateWebhookConfig(
    instanceName: string,
    config: {
      webhookUrl?: string;
      webhookHeaders?: Record<string, string>;
      webhookEnabled?: boolean;
      webhookEvents?: string[];
    },
  ): Promise<Instance> {
    const instance = this.instances.get(instanceName);
    if (!instance) {
      throw new Error(`Instance "${instanceName}" not found`);
    }

    if (config.webhookUrl !== undefined) instance.webhookUrl = config.webhookUrl;
    if (config.webhookHeaders !== undefined) instance.webhookHeaders = config.webhookHeaders;
    if (config.webhookEnabled !== undefined) instance.webhookEnabled = config.webhookEnabled;
    if (config.webhookEvents !== undefined) instance.webhookEvents = config.webhookEvents;

    await this.instanceConfigRepo.update(
      { name: instanceName },
      {
        ...(config.webhookUrl !== undefined && { webhookUrl: config.webhookUrl }),
        ...(config.webhookHeaders !== undefined && { webhookHeaders: config.webhookHeaders }),
        ...(config.webhookEnabled !== undefined && { webhookEnabled: config.webhookEnabled }),
        ...(config.webhookEvents !== undefined && { webhookEvents: config.webhookEvents }),
      },
    );

    return instance;
  }

  getInstance(name: string): Instance | undefined {
    return this.instances.get(name);
  }

  getQR(name: string): string | null {
    return this.qrCodes.get(name) || null;
  }

  getInstances(): Array<{
    name: string;
    connected: boolean;
    startTime: number;
    webhookEnabled: boolean;
    webhook: {
      url: string | null;
      headers: Record<string, string>;
      enabled: boolean;
      events: string[];
    };
  }> {
    return [...this.instances.keys()].map((name) => {
      const instance = this.instances.get(name)!;
      return {
        name: instance.name,
        connected: instance.connected,
        startTime: instance.startTime,
        webhookEnabled: instance.webhookEnabled,
        webhook: {
          url: instance.webhookUrl,
          headers: instance.webhookHeaders,
          enabled: instance.webhookEnabled,
          events: instance.webhookEvents,
        },
      };
    });
  }

  async disconnectInstance(instanceName: string): Promise<boolean> {
    const instance = this.instances.get(instanceName);
    if (!instance) return false;

    instance.socket.end(undefined);
    this.instances.delete(instanceName);
    this.qrCodes.delete(instanceName);
    const redisKeys = await this.redis.keys(`papagai:${instanceName}:*`);
    if (redisKeys.length > 0) {
      await this.redis.del(...redisKeys);
    }
    this.logger.log(`Instance "${instanceName}" disconnected and removed`);
    await this.instanceConfigRepo.delete({ name: instanceName });
    return true;
  }

  async reconnectInstance(instanceName: string, retryCount = 0): Promise<void> {
    const existing = this.instances.get(instanceName);
    if (!existing) {
      this.logger.warn(
        `Reconnect requested for unknown instance "${instanceName}" — skipping`,
      );
      return;
    }

    const { webhookUrl, webhookHeaders, webhookEnabled, webhookEvents } = existing;
    this.instances.delete(instanceName);
    this.qrCodes.delete(instanceName);

    this.logger.log(`Reconnecting instance "${instanceName}" (attempt ${retryCount})`);
    const newInstance = await this.createInstance(
      instanceName,
      webhookUrl ?? undefined,
      webhookHeaders,
      webhookEnabled,
      webhookEvents,
    );
    newInstance.retryCount = retryCount;
  }

  async onModuleDestroy(): Promise<void> {
    for (const [name, instance] of this.instances) {
      this.logger.log(`Shutting down instance "${name}"`);
      try {
        instance.socket.ev.removeAllListeners('connection.update');
        instance.socket.ev.removeAllListeners('creds.update');
        instance.socket.ev.removeAllListeners('messages.upsert');
        instance.socket.ev.removeAllListeners('messages.update');
        instance.socket.end(undefined);
      } catch (err) {
        this.logger.warn(`Error closing socket for "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.instances.clear();
    this.qrCodes.clear();
    this.redis.disconnect();
  }
}
