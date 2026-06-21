import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Redis } from 'ioredis';
import { useRedisAuthState } from './utils/redis-auth-state.js';
import makeWASocket, {
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} from '@whiskeysockets/baileys';
import * as fs from 'fs';
import {
  Instance,
  WebhookData,
  ChatInfo,
  ContactInfo,
} from './interfaces/whatsapp.interface.js';
import { WebhookService } from '../webhook/webhook.service.js';
import {
  ChatRealtimeEvent,
  ChatStoreService,
  StoredMessage,
  extractPreview,
} from './chat-store.service.js';
import { phoneNumberToJid } from './utils/jid.js';
import { downloadMedia } from './utils/media-downloader.js';
import {
  MAX_RECONNECT_RETRIES,
  ReconnectionContext,
  handleConnectionClose,
} from './utils/reconnection-manager.js';
import { WebhookEnricher } from './utils/webhook-enricher.js';
import { resolveJid } from './utils/jid-resolver.js';
import { Observable } from 'rxjs';
import { MediaUrlService } from '../media/media-url.service.js';
import { getProviderCapabilities } from '../instances/provider-capabilities.js';

function extractButtonLabels(content: any): string[] | undefined {
  // All interactive types now use interactiveMessage/nativeFlowMessage (modern proto).
  // Extract labels based on the button name:
  //   quick_reply  → buttonParamsJson.display_text (reply buttons)
  //   single_select → buttonParamsJson.sections[].rows[].title (list rows)
  //   cta_url / cta_copy / otp → buttonParamsJson.display_text
  const nativeButtons: any[] =
    content?.interactiveMessage?.nativeFlowMessage?.buttons ?? [];

  if (!nativeButtons.length) return undefined;

  const labels: string[] = [];

  for (const b of nativeButtons) {
    let parsed: any = {};
    try {
      parsed = JSON.parse(b.buttonParamsJson ?? '{}');
    } catch {
      // Malformed JSON — skip this button's labels
    }

    if (b.name === 'single_select') {
      // List picker: extract all row titles from sections so the preview
      // shows the actual options, not just the picker button label.
      const sections: any[] = parsed.sections ?? [];
      for (const section of sections) {
        for (const row of section.rows ?? []) {
          if (row.title) labels.push(row.title as string);
        }
      }
    } else if (parsed.display_text) {
      // quick_reply, cta_url, cta_copy, otp — show the button label.
      labels.push(parsed.display_text as string);
    }
  }

  return labels.length ? labels : undefined;
}

@Injectable()
export class WhatsappService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private instances: Map<string, Instance> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private mediaDir: string;
  private readonly redis: Redis;
  private readonly webhookEnricher: WebhookEnricher;
  private readonly reconnectionContext: ReconnectionContext;

  constructor(
    private configService: ConfigService,
    private webhookService: WebhookService,
    private chatStore: ChatStoreService,
    private readonly prisma: PrismaService,
    private readonly mediaUrlService: MediaUrlService,
  ) {
    this.redis = new Redis(
      this.configService.get<string>('redisUrl') || 'redis://localhost:6379',
    );
    this.mediaDir = this.configService.get<string>('mediaDir') || './media';
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }

    this.webhookEnricher = new WebhookEnricher((msg, type) =>
      downloadMedia(msg, type, this.mediaDir, this.logger, (path) =>
        this.mediaUrlService.signPath(path),
      ),
    );

    this.reconnectionContext = {
      maxRetries: MAX_RECONNECT_RETRIES,
      logger: this.logger,
      webhookService: this.webhookService,
      onRemoveFromMaps: (key) => {
        this.instances.delete(key);
        this.qrCodes.delete(key);
      },
      onReconnect: (key, retryCount) => {
        this.reconnectInstance(key, retryCount).catch((err: unknown) =>
          this.logger.error(
            `Reconnect failed for "${key}": ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      },
      onPurge: (userId, instanceName) =>
        this.purgeInstance(userId, instanceName),
    };
  }

  async onModuleInit(): Promise<void> {
    const configs = await this.prisma.instanceConfig.findMany({
      where: { provider: 'web' },
    });
    if (configs.length === 0) return;

    this.logger.log(`Restoring ${configs.length} instance(s) from database...`);

    // Restore instances sequentially with a delay between each to avoid
    // WhatsApp "conflict: replaced" errors when the server restarts quickly
    // (the previous WS session needs time to expire on WhatsApp's side).
    const RESTORE_DELAY_MS = 3_000;

    for (const config of configs) {
      try {
        await this.createInstance(
          config.userId,
          config.name,
          config.webhookUrl ?? undefined,
          (config.webhookHeaders ?? undefined) as
            | Record<string, string>
            | undefined,
          config.webhookEnabled,
          config.webhookEvents,
        );
        this.logger.log(`Restored instance "${config.userId}:${config.name}"`);
      } catch (error) {
        this.logger.error(
          `Failed to restore instance "${config.userId}:${config.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (configs.indexOf(config) < configs.length - 1) {
        await new Promise((r) => setTimeout(r, RESTORE_DELAY_MS));
      }
    }
  }

  async createInstance(
    userId: string,
    instanceName: string,
    webhookUrl?: string,
    webhookHeaders?: Record<string, string>,
    webhookEnabled?: boolean,
    webhookEvents?: string[],
  ): Promise<Instance> {
    const compositeKey = `${userId}:${instanceName}`;
    if (this.instances.has(compositeKey)) {
      throw new Error(`Papagai ${instanceName} já existe!`);
    }

    const { state, saveCreds } = await useRedisAuthState(
      this.redis,
      userId,
      instanceName,
    );

    let version: [number, number, number] | undefined;
    try {
      const result = await fetchLatestWaWebVersion({
        headers: {
          'sec-fetch-site': 'none',
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      version = result.error ? undefined : result.version;
      if (result.error) {
        const fallback = await fetchLatestBaileysVersion({}).catch(() => ({
          version: undefined,
        }));
        version = fallback.version;
      }
    } catch {
      const fallback = await fetchLatestBaileysVersion({}).catch(() => ({
        version: undefined,
      }));
      version = fallback.version;
    }
    this.logger.debug(
      `Using Baileys version: ${version?.join('.') ?? 'built-in default'}`,
    );

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: [`Papagai-${instanceName}`, 'Chrome', '120.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      defaultQueryTimeoutMs: 60000,
      generateHighQualityLinkPreview: true,
      getMessage: () => Promise.resolve({ conversation: '' }),
    });

    const DEFAULT_WEBHOOK_EVENTS = [
      'message',
      'message_update',
      'qr',
      'connected',
      'disconnected',
    ];

    const resolvedWebhookEnabled = webhookUrl
      ? (webhookEnabled ?? true)
      : false;
    const resolvedWebhookEvents = webhookEvents ?? DEFAULT_WEBHOOK_EVENTS;

    const instance: Instance = {
      socket: sock,
      webhookUrl: webhookUrl || null,
      webhookHeaders: webhookHeaders || {},
      webhookEnabled: resolvedWebhookEnabled,
      webhookEvents: resolvedWebhookEvents,
      name: instanceName,
      userId,
      connected: false,
      qr: null,
      saveCreds,
      startTime: Date.now(),
      lastConnectedAt: null,
      retryCount: 0,
    };

    this.instances.set(compositeKey, instance);
    this.registerSocketEvents(instance);

    // Hydrate chat store from Redis (non-blocking — failure is logged, not thrown)
    this.chatStore
      .hydrate(userId, instanceName)
      .catch((err: unknown) =>
        this.logger.warn(
          `Chat store hydration failed for "${compositeKey}": ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    await this.prisma.instanceConfig.upsert({
      where: { userId_name: { userId, name: instanceName } },
      create: {
        userId,
        name: instanceName,
        provider: 'web',
        webhookUrl: webhookUrl ?? null,
        webhookHeaders: webhookHeaders ?? {},
        webhookEnabled: resolvedWebhookEnabled,
        webhookEvents: resolvedWebhookEvents,
      },
      update: {
        provider: 'web',
        webhookUrl: webhookUrl ?? null,
        webhookHeaders: webhookHeaders ?? {},
        webhookEnabled: resolvedWebhookEnabled,
        webhookEvents: resolvedWebhookEvents,
      },
    });

    this.logger.log(`Instance "${compositeKey}" created`);
    return instance;
  }

  private instanceKey(userId: string, name: string): string {
    return `${userId}:${name}`;
  }

  private instanceKeyOf(instance: Instance): string {
    return this.instanceKey(instance.userId, instance.name);
  }

  private registerSocketEvents(instance: Instance): void {
    const sock = instance.socket;

    sock.ev.on('connection.update', (update) => {
      void this.handleConnectionUpdate(instance, update);
    });

    sock.ev.on('creds.update', () => void instance.saveCreds());

    sock.ev.on(
      'messaging-history.set',
      ({ chats, messages, isLatest, progress }) => {
        this.logger.log(
          `History sync for "${instance.name}": ${chats.length} chats, ${messages.length} messages (latest=${isLatest}, progress=${progress ?? '?'})`,
        );
        this.chatStore.recordHistorySync(
          instance.userId,
          instance.name,
          chats,
          messages,
        );
        void this.enrichHistorySyncMedia(instance, messages);
      },
    );

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        // Record every message (both directions) in the chat store.
        // recordIncoming/recordOutgoing both dedup on msg.key.id so echoes
        // from Baileys after send() won't double-count.
        if (msg.key.fromMe) {
          const { body: outgoingBody } = extractPreview(msg);
          this.chatStore.recordOutgoing(
            instance.userId,
            instance.name,
            msg.key.remoteJid ?? '',
            outgoingBody,
            msg,
          );
        } else {
          this.chatStore.recordIncoming(instance.userId, instance.name, msg);
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
      this.qrCodes.set(this.instanceKeyOf(instance), qr);
      this.logger.log(
        `QR code generated for instance "${this.instanceKeyOf(instance)}"`,
      );
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
      this.qrCodes.delete(this.instanceKeyOf(instance));
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
      handleConnectionClose(instance, lastDisconnect, this.reconnectionContext);
    }
  }

  private async handleIncomingMessage(
    instance: Instance,
    msg: any,
  ): Promise<void> {
    const sender: string = msg.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    const pushName: string = msg.pushName || 'Unknown';
    const messageType = this.webhookEnricher.getMessageType(msg);

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

    await this.webhookEnricher.enrich(webhookData, msg, messageType);
    const media =
      webhookData.image ??
      webhookData.audio ??
      webhookData.voice ??
      webhookData.video ??
      webhookData.document ??
      webhookData.sticker;
    if (media && webhookData.messageId) {
      this.chatStore.attachMediaToMessage(
        instance.userId,
        instance.name,
        webhookData.messageId,
        media,
      );
    }

    this.logger.log(
      `Incoming ${messageType} from ${phoneNumber} on instance "${instance.name}"`,
    );
    await this.webhookService.sendWebhook(instance, webhookData);
  }

  private async enrichHistorySyncMedia(
    instance: Instance,
    messages: any[],
  ): Promise<void> {
    for (const message of messages) {
      const messageType = this.webhookEnricher.getMessageType(message);
      const mediaType =
        messageType === 'voice'
          ? 'audio'
          : this.toDownloadableMediaType(messageType);
      if (!mediaType) continue;

      const media = await downloadMedia(
        message,
        mediaType,
        this.mediaDir,
        this.logger,
        (path) => this.mediaUrlService.signPath(path),
      );
      if (!media || !message?.key?.id) continue;

      this.chatStore.attachMediaToMessage(
        instance.userId,
        instance.name,
        message.key.id,
        media,
      );
    }
  }

  private toDownloadableMediaType(messageType: string): string | null {
    switch (messageType) {
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
      case 'sticker':
        return messageType;
      default:
        return null;
    }
  }

  private getConnectedInstance(userId: string, instanceName: string): Instance {
    const key = this.instanceKey(userId, instanceName);
    const instance = this.instances.get(key);
    if (!instance || !instance.connected) {
      throw new Error(`Papagai ${instanceName} não está conectado!`);
    }
    return instance;
  }

  private async purgeInstance(
    userId: string,
    instanceName: string,
  ): Promise<void> {
    const key = this.instanceKey(userId, instanceName);
    this.chatStore.clearInstance(userId, instanceName);
    const redisKeys = await this.redis.keys(
      `papagai:${userId}:${instanceName}:*`,
    );
    if (redisKeys.length > 0) {
      await this.redis.del(...redisKeys);
    }
    await this.prisma.instanceConfig.delete({
      where: { userId_name: { userId, name: instanceName } },
    });
    this.logger.log(`Purged storage for logged-out instance "${key}"`);
  }

  async send(
    userId: string,
    instanceName: string,
    to: string,
    content: any,
  ): Promise<any> {
    const instance = this.getConnectedInstance(userId, instanceName);
    const jid = await resolveJid(instance.socket, to, this.logger);
    this.logger.debug(
      `Sending to JID: ${jid}, content keys: ${Object.keys(content).join(', ')}`,
    );

    // All interactive types now use interactiveMessage/nativeFlowMessage (modern
    // proto). The legacy listMessage forward-wrapper hack is no longer needed.
    const result = await instance.socket.sendMessage(jid, content);
    this.logger.debug(
      `sendMessage result: id=${result?.key?.id} status=${result?.status}`,
    );

    // Extract text body for the store preview (best-effort)
    const textBody: string | null =
      content?.text ??
      content?.caption ??
      (typeof content === 'string' ? content : null);

    const interactiveButtons = extractButtonLabels(content);

    // Record in the chat store; the messages.upsert Baileys echo will be deduped
    // by msg.key.id so this does not double-count.
    this.chatStore.recordOutgoing(
      userId,
      instanceName,
      to,
      textBody,
      result,
      interactiveButtons,
    );

    return result;
  }

  async getContactInfo(
    userId: string,
    instanceName: string,
    number: string,
  ): Promise<ContactInfo> {
    const instance = this.getConnectedInstance(userId, instanceName);
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

  getChats(
    userId: string,
    instanceName: string,
    _includeMessages: boolean,
  ): ChatInfo[] {
    // Instance must exist (connected or not) — just check it's registered
    const key = this.instanceKey(userId, instanceName);
    if (!this.instances.has(key)) {
      throw new Error(`Papagai ${instanceName} não encontrado`);
    }

    const summaries = this.chatStore.getChats(userId, instanceName);
    return summaries.map((s) => ({
      id: s.id,
      jid: s.jid,
      phoneNumber: s.phoneNumber,
      displayName: s.displayName ?? undefined,
      profilePictureUrl: s.profilePictureUrl,
      pushName: s.displayName ?? s.name ?? s.phoneNumber,
      name: s.displayName ?? s.name ?? s.phoneNumber,
      unreadCount: s.unreadCount,
      lastMessage: s.lastMessage ?? undefined,
      timestamp: s.lastMessageAt,
      isGroup: s.isGroup,
    }));
  }

  getChatMessages(
    userId: string,
    instanceName: string,
    chatId: string,
    limit: number,
  ): import('./chat-store.service.js').StoredMessage[] {
    const key = this.instanceKey(userId, instanceName);
    if (!this.instances.has(key)) {
      throw new Error(`Papagai ${instanceName} não encontrado`);
    }
    return this.chatStore.getMessages(userId, instanceName, chatId, limit);
  }

  findMessageById(
    userId: string,
    instanceName: string,
    messageId: string,
  ): StoredMessage | null {
    const key = this.instanceKey(userId, instanceName);
    if (!this.instances.has(key)) {
      throw new Error(`Papagai ${instanceName} não encontrado`);
    }
    return this.chatStore.findMessageById(userId, instanceName, messageId);
  }

  streamChatEvents(
    userId: string,
    instanceName: string,
  ): Observable<ChatRealtimeEvent> {
    const key = this.instanceKey(userId, instanceName);
    if (!this.instances.has(key)) {
      throw new Error(`Papagai ${instanceName} não encontrado`);
    }
    return this.chatStore.observeEvents(userId, instanceName);
  }

  markChatRead(userId: string, instanceName: string, chatId: string): void {
    this.chatStore.markRead(userId, instanceName, chatId);
  }

  getMetrics(
    userId: string,
    instanceName: string,
  ): {
    messagesSent: number;
    messagesReceived: number;
    activeConversations: number;
    webhookEnabled: boolean;
  } {
    const key = this.instanceKey(userId, instanceName);
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Papagai ${instanceName} não encontrado`);
    }
    const counters = this.chatStore.getCounters(userId, instanceName);
    return {
      messagesSent: counters.sent,
      messagesReceived: counters.received,
      activeConversations: counters.activeConversations,
      webhookEnabled: instance.webhookEnabled,
    };
  }

  async updateWebhookConfig(
    userId: string,
    instanceName: string,
    config: {
      webhookUrl?: string;
      webhookHeaders?: Record<string, string>;
      webhookEnabled?: boolean;
      webhookEvents?: string[];
    },
  ): Promise<Instance> {
    const key = this.instanceKey(userId, instanceName);
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Instance "${key}" not found`);
    }

    if (config.webhookUrl !== undefined)
      instance.webhookUrl = config.webhookUrl;
    if (config.webhookHeaders !== undefined)
      instance.webhookHeaders = config.webhookHeaders;
    if (config.webhookEnabled !== undefined)
      instance.webhookEnabled = config.webhookEnabled;
    if (config.webhookEvents !== undefined)
      instance.webhookEvents = config.webhookEvents;

    await this.prisma.instanceConfig.update({
      where: { userId_name: { userId, name: instanceName } },
      data: {
        ...(config.webhookUrl !== undefined && {
          webhookUrl: config.webhookUrl,
        }),
        ...(config.webhookHeaders !== undefined && {
          webhookHeaders: config.webhookHeaders,
        }),
        ...(config.webhookEnabled !== undefined && {
          webhookEnabled: config.webhookEnabled,
        }),
        ...(config.webhookEvents !== undefined && {
          webhookEvents: config.webhookEvents,
        }),
      },
    });

    return instance;
  }

  getInstance(userId: string, name: string): Instance | undefined {
    return this.instances.get(this.instanceKey(userId, name));
  }

  getQR(userId: string, name: string): string | null {
    return this.qrCodes.get(this.instanceKey(userId, name)) || null;
  }

  getInstances(
    userId: string,
    pagination: { page: number; limit: number },
  ): {
    instances: Array<{
      name: string;
      provider: 'web';
      connected: boolean;
      startTime: number;
      webhookEnabled: boolean;
      capabilities: ReturnType<typeof getProviderCapabilities>;
      webhook: {
        url: string | null;
        headers: Record<string, string>;
        enabled: boolean;
        events: string[];
      };
      phoneNumber: string | null;
    }>;
    total: number;
  } {
    const prefix = `${userId}:`;
    const all = [...this.instances.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, instance]) => ({
        name: instance.name,
        provider: 'web' as const,
        connected: instance.connected,
        startTime: instance.startTime,
        webhookEnabled: instance.webhookEnabled,
        capabilities: getProviderCapabilities('web'),
        webhook: {
          url: instance.webhookUrl,
          headers: instance.webhookHeaders,
          enabled: instance.webhookEnabled,
          events: instance.webhookEvents,
        },
        phoneNumber: instance.socket?.user?.id
          ? instance.socket.user.id.split(':')[0]
          : null,
      }));

    const total = all.length;
    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;

    return { instances: all.slice(start, end), total };
  }

  async disconnectInstance(
    userId: string,
    instanceName: string,
  ): Promise<boolean> {
    const key = this.instanceKey(userId, instanceName);
    const instance = this.instances.get(key);
    if (!instance) return false;

    this.chatStore.clearInstance(userId, instanceName);
    void instance.socket.end(undefined);
    this.instances.delete(key);
    this.qrCodes.delete(key);
    const redisKeys = await this.redis.keys(
      `papagai:${userId}:${instanceName}:*`,
    );
    if (redisKeys.length > 0) {
      await this.redis.del(...redisKeys);
    }
    this.logger.log(`Instance "${key}" disconnected and removed`);
    await this.prisma.instanceConfig.delete({
      where: { userId_name: { userId, name: instanceName } },
    });
    return true;
  }

  async reconnectInstance(compositeKey: string, retryCount = 0): Promise<void> {
    const existing = this.instances.get(compositeKey);
    if (!existing) {
      this.logger.warn(
        `Reconnect requested for unknown instance "${compositeKey}" — skipping`,
      );
      return;
    }

    const {
      userId,
      name,
      webhookUrl,
      webhookHeaders,
      webhookEnabled,
      webhookEvents,
    } = existing;
    this.instances.delete(compositeKey);
    this.qrCodes.delete(compositeKey);

    this.logger.log(
      `Reconnecting instance "${compositeKey}" (attempt ${retryCount})`,
    );
    const newInstance = await this.createInstance(
      userId,
      name,
      webhookUrl ?? undefined,
      webhookHeaders,
      webhookEnabled,
      webhookEvents,
    );
    newInstance.retryCount = retryCount;
  }

  onModuleDestroy(): void {
    for (const [name, instance] of this.instances) {
      this.logger.log(`Shutting down instance "${name}"`);
      try {
        instance.socket.ev.removeAllListeners('connection.update');
        instance.socket.ev.removeAllListeners('creds.update');
        instance.socket.ev.removeAllListeners('messaging-history.set');
        instance.socket.ev.removeAllListeners('messages.upsert');
        instance.socket.ev.removeAllListeners('messages.update');
        void instance.socket.end(undefined);
      } catch (err) {
        this.logger.warn(
          `Error closing socket for "${name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.instances.clear();
    this.qrCodes.clear();
    this.redis.disconnect();
  }
}
