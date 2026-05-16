import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChatStoreService } from '../whatsapp/chat-store.service.js';
import {
  ChatInfo,
  ContactInfo,
} from '../whatsapp/interfaces/whatsapp.interface.js';
import { Observable } from 'rxjs';
import { ChatRealtimeEvent } from '../whatsapp/chat-store.service.js';
import { WbaClientService, WbaApiError } from './wba-client.service.js';
import { WbaCredentialsService } from './wba-credentials.service.js';
import {
  InstanceCapabilities,
  getProviderCapabilities,
} from '../instances/provider-capabilities.js';

type WbaConfig = {
  id: number;
  userId: string;
  name: string;
  provider: 'wba';
  createdAt: Date;
  webhookUrl: string | null;
  webhookHeaders: unknown;
  webhookEnabled: boolean;
  webhookEvents: string[];
  wbaPhoneNumberId: string | null;
  wbaBusinessAccountId: string | null;
  wbaDisplayPhoneNumber: string | null;
  wbaAccessTokenEncrypted: string | null;
  wbaAppSecretEncrypted: string | null;
  wbaWebhookVerifyTokenEncrypted: string | null;
  wbaWebhookConfiguredAt: Date | null;
  wbaLastHealthCheckAt: Date | null;
  wbaLastHealthCheckStatus: string | null;
};

@Injectable()
export class WbaInstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatStore: ChatStoreService,
    private readonly wbaClient: WbaClientService,
    private readonly credentialsService: WbaCredentialsService,
  ) {}

  async createInstance(
    userId: string,
    name: string,
    wba: {
      businessAccountId: string;
      phoneNumberId: string;
      displayPhoneNumber: string;
      accessToken: string;
      appSecret?: string;
      webhookVerifyToken?: string;
    },
    webhookUrl?: string,
    webhookHeaders?: Record<string, string>,
    webhookEnabled?: boolean,
    webhookEvents?: string[],
  ): Promise<void> {
    const existing = await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Papagai ${name} já existe!`);
    }

    const verifyToken = wba.webhookVerifyToken?.trim() || randomUUID();
    const resolvedWebhookEnabled = webhookUrl
      ? (webhookEnabled ?? true)
      : false;
    const resolvedWebhookEvents = webhookEvents ?? [
      'message',
      'message_update',
      'connected',
      'disconnected',
    ];

    await this.prisma.instanceConfig.create({
      data: {
        userId,
        name,
        provider: 'wba',
        webhookUrl: webhookUrl ?? null,
        webhookHeaders: webhookHeaders ?? {},
        webhookEnabled: resolvedWebhookEnabled,
        webhookEvents: resolvedWebhookEvents,
        wbaBusinessAccountId: wba.businessAccountId,
        wbaPhoneNumberId: wba.phoneNumberId,
        wbaDisplayPhoneNumber: wba.displayPhoneNumber,
        wbaAccessTokenEncrypted: this.credentialsService.encrypt(
          wba.accessToken,
        ),
        wbaAppSecretEncrypted: wba.appSecret
          ? this.credentialsService.encrypt(wba.appSecret)
          : null,
        wbaWebhookVerifyTokenEncrypted:
          this.credentialsService.encrypt(verifyToken),
        wbaWebhookConfiguredAt: webhookUrl ? new Date() : null,
      },
    });

    const config = await this.getConfig(userId, name);
    await this.refreshHealthStatus(config).catch(() => undefined);
  }

  async sendMessage(
    userId: string,
    instanceName: string,
    payload: Record<string, any>,
  ): Promise<{
    messaging_product?: string;
    contacts?: Array<{ input?: string; wa_id?: string }>;
    messages?: Array<{ id?: string }>;
  }> {
    const config = await this.getConfig(userId, instanceName);
    const accessToken = this.getAccessToken(config);
    const body = this.toWbaPayload(payload);
    const textPreview = this.extractPreviewText(payload);

    try {
      const response = await this.wbaClient.sendMessage(
        config.wbaPhoneNumberId!,
        accessToken,
        body,
      );
      const messageId = response.messages?.[0]?.id;
      if (messageId) {
        this.chatStore.recordProviderOutgoing(userId, instanceName, {
          id: messageId,
          to: this.normalizeRecipient(payload.to),
          type: payload.type,
          body: textPreview,
          status: 'sent',
        });
      }
      await this.refreshHealthStatus(config).catch(() => undefined);
      return response;
    } catch (error) {
      await this.updateHealthStatus(config, 'unhealthy', new Date()).catch(
        () => undefined,
      );
      if (error instanceof WbaApiError) {
        throw new BadRequestException(
          `Meta Cloud API error (${error.statusCode}): ${error.message}`,
        );
      }
      throw error;
    }
  }

  async getStatus(
    userId: string,
    instanceName: string,
  ): Promise<{
    name: string;
    provider: 'wba';
    capabilities: InstanceCapabilities;
    connected: boolean;
    startTime: string;
    uptime: number;
    phoneNumber?: string;
    webhook: {
      url: string | null;
      headers: Record<string, string>;
      enabled: boolean;
      events: string[];
    };
    wba: {
      phoneNumberId: string | null;
      businessAccountId: string | null;
      displayPhoneNumber: string | null;
      webhookConfiguredAt: string | null;
      lastHealthCheckAt: string | null;
      lastHealthCheckStatus: string | null;
      appSecretConfigured: boolean;
    };
  }> {
    const config = await this.getConfig(userId, instanceName);
    const now = Date.now();
    return this.statusFromConfig(config, now);
  }

  async getListItems(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<{
    instances: Array<{
      name: string;
      provider: 'wba';
      connected: boolean;
      startTime: number;
      webhookEnabled: boolean;
      phoneNumber: string | null;
      capabilities: InstanceCapabilities;
      webhook: {
        url: string | null;
        headers: Record<string, string>;
        enabled: boolean;
        events: string[];
      };
    }>;
    total: number;
  }> {
    const rows = (await this.prisma.instanceConfig.findMany({
      where: { userId, provider: 'wba' },
      orderBy: { createdAt: 'desc' },
    })) as WbaConfig[];

    const total = rows.length;
    const start = (pagination.page - 1) * pagination.limit;
    const pageRows = rows.slice(start, start + pagination.limit);
    return {
      instances: pageRows.map((config) => ({
        name: config.name,
        provider: 'wba',
        connected: config.wbaLastHealthCheckStatus === 'healthy',
        startTime: config.createdAt.getTime(),
        webhookEnabled: config.webhookEnabled,
        phoneNumber: config.wbaDisplayPhoneNumber,
        capabilities: getProviderCapabilities('wba'),
        webhook: {
          url: config.webhookUrl,
          headers: this.toHeaders(config.webhookHeaders),
          enabled: config.webhookEnabled,
          events: config.webhookEvents ?? [],
        },
      })),
      total,
    };
  }

  async getContactInfo(
    userId: string,
    instanceName: string,
    _number: string,
  ): Promise<ContactInfo> {
    await this.getConfig(userId, instanceName);
    throw new BadRequestException(
      'Contact lookup is not supported for provider wba instances.',
    );
  }

  async getChats(userId: string, instanceName: string): Promise<ChatInfo[]> {
    await this.getConfig(userId, instanceName);
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

  async getChatMessages(
    userId: string,
    instanceName: string,
    chatId: string,
    limit: number,
  ) {
    await this.getConfig(userId, instanceName);
    return this.chatStore.getMessages(userId, instanceName, chatId, limit);
  }

  async streamChatEvents(
    userId: string,
    instanceName: string,
  ): Promise<Observable<ChatRealtimeEvent>> {
    await this.getConfig(userId, instanceName);
    return this.chatStore.observeEvents(userId, instanceName);
  }

  async markChatRead(userId: string, instanceName: string): Promise<void> {
    await this.getConfig(userId, instanceName);
    throw new BadRequestException(
      'Mark-as-read is not supported for provider wba instances.',
    );
  }

  async getMetrics(
    userId: string,
    instanceName: string,
  ): Promise<{
    messagesSent: number;
    messagesReceived: number;
    activeConversations: number;
    webhookEnabled: boolean;
  }> {
    const config = await this.getConfig(userId, instanceName);
    const counters = this.chatStore.getCounters(userId, instanceName);
    return {
      messagesSent: counters.sent,
      messagesReceived: counters.received,
      activeConversations: counters.activeConversations,
      webhookEnabled: config.webhookEnabled,
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
  ): Promise<{
    webhookUrl: string | null;
    webhookHeaders: Record<string, string>;
    webhookEnabled: boolean;
    webhookEvents: string[];
  }> {
    await this.getConfig(userId, instanceName);
    const updated = (await this.prisma.instanceConfig.update({
      where: { userId_name: { userId, name: instanceName } },
      data: {
        ...(config.webhookUrl !== undefined && {
          webhookUrl: config.webhookUrl,
          wbaWebhookConfiguredAt: config.webhookUrl ? new Date() : null,
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
    })) as WbaConfig;
    return {
      webhookUrl: updated.webhookUrl,
      webhookHeaders: this.toHeaders(updated.webhookHeaders),
      webhookEnabled: updated.webhookEnabled,
      webhookEvents: updated.webhookEvents ?? [],
    };
  }

  async disconnectInstance(
    userId: string,
    instanceName: string,
  ): Promise<boolean> {
    const config = await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name: instanceName } },
      select: { provider: true },
    });
    if (!config || config.provider !== 'wba') {
      return false;
    }
    await this.prisma.instanceConfig.delete({
      where: { userId_name: { userId, name: instanceName } },
    });
    this.chatStore.clearInstance(userId, instanceName);
    return true;
  }

  async findInstanceByPhoneNumberId(phoneNumberId: string): Promise<{
    userId: string;
    name: string;
    appSecret?: string;
  } | null> {
    const config = (await this.prisma.instanceConfig.findFirst({
      where: { provider: 'wba', wbaPhoneNumberId: phoneNumberId },
    })) as WbaConfig | null;
    if (!config) return null;

    return {
      userId: config.userId,
      name: config.name,
      appSecret: config.wbaAppSecretEncrypted
        ? this.credentialsService.decrypt(config.wbaAppSecretEncrypted)
        : undefined,
    };
  }

  async findByVerifyToken(token: string): Promise<{
    userId: string;
    name: string;
  } | null> {
    const configs = (await this.prisma.instanceConfig.findMany({
      where: {
        provider: 'wba',
        wbaWebhookVerifyTokenEncrypted: { not: null },
      },
      select: {
        userId: true,
        name: true,
        wbaWebhookVerifyTokenEncrypted: true,
      },
    })) as Array<{
      userId: string;
      name: string;
      wbaWebhookVerifyTokenEncrypted: string | null;
    }>;

    for (const config of configs) {
      if (!config.wbaWebhookVerifyTokenEncrypted) continue;
      const decrypted = this.credentialsService.decrypt(
        config.wbaWebhookVerifyTokenEncrypted,
      );
      if (decrypted === token) {
        return { userId: config.userId, name: config.name };
      }
    }
    return null;
  }

  ingestIncomingMessage(
    userId: string,
    instanceName: string,
    message: {
      id: string;
      from: string;
      type: string;
      text?: string;
      timestamp?: number;
      senderName?: string;
    },
  ): void {
    this.chatStore.recordProviderIncoming(userId, instanceName, {
      id: message.id,
      from: this.normalizeRecipient(message.from),
      sender: message.senderName ?? null,
      type: message.type,
      body: message.text ?? null,
      timestamp:
        typeof message.timestamp === 'number'
          ? message.timestamp * 1000
          : Date.now(),
    });
  }

  ingestStatusUpdate(
    userId: string,
    instanceName: string,
    status: { id: string; status?: string },
  ): void {
    const mapped = this.toStoredStatus(status.status);
    if (!mapped) return;
    this.chatStore.updateMessageStatus(userId, instanceName, status.id, mapped);
  }

  private async getConfig(userId: string, name: string): Promise<WbaConfig> {
    const config = (await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name } },
    })) as WbaConfig | null;
    if (!config || config.provider !== 'wba') {
      throw new NotFoundException(`Papagai ${name} não encontrado`);
    }
    return config;
  }

  private getAccessToken(config: WbaConfig): string {
    if (!config.wbaAccessTokenEncrypted || !config.wbaPhoneNumberId) {
      throw new BadRequestException(
        `WBA credentials are incomplete for instance "${config.name}"`,
      );
    }
    return this.credentialsService.decrypt(config.wbaAccessTokenEncrypted);
  }

  private toWbaPayload(payload: Record<string, any>): Record<string, unknown> {
    const type = payload.type;
    const to = this.normalizeRecipient(payload.to);
    const base: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
    };

    switch (type) {
      case 'text':
        return { ...base, text: payload.text };
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
      case 'sticker': {
        const media = payload[type] as { link?: string; data?: string };
        if (typeof media?.data === 'string' && media.data.trim() !== '') {
          throw new BadRequestException(
            `Inline base64 media is not supported for provider wba. Use "${type}.link" instead.`,
          );
        }
        if (typeof media?.link !== 'string' || media.link.trim() === '') {
          throw new BadRequestException(
            `Field "${type}.link" is required for provider wba.`,
          );
        }
        return { ...base, [type]: media };
      }
      case 'location':
      case 'contacts':
      case 'reaction':
        return { ...base, [type]: payload[type] };
      case 'interactive': {
        const interactiveType = payload?.interactive?.type;
        if (
          interactiveType === 'cta_url' ||
          interactiveType === 'cta_copy' ||
          interactiveType === 'otp'
        ) {
          throw new BadRequestException(
            `Interactive type "${interactiveType}" is not supported for provider wba.`,
          );
        }
        return { ...base, interactive: payload.interactive };
      }
      case 'template':
        return { ...base, template: payload.template };
      default:
        throw new BadRequestException(
          `Message type "${type}" is not supported for provider wba.`,
        );
    }
  }

  private extractPreviewText(payload: Record<string, any>): string | null {
    if (payload.type === 'text') return payload.text?.body ?? null;
    if (payload.type === 'template') {
      return payload.template?.name
        ? `Template: ${payload.template.name as string}`
        : 'Template message';
    }
    if (payload.type === 'location') return payload.location?.name ?? null;
    if (payload.type === 'reaction') return payload.reaction?.emoji ?? null;
    if (payload.type === 'interactive') {
      return payload.interactive?.body?.text ?? null;
    }
    if (payload.type === 'contacts') return 'Contacts';
    return payload[payload.type]?.caption ?? null;
  }

  private normalizeRecipient(value: string): string {
    if (!value) return value;
    return value.split('@')[0].replace(/\D/g, '');
  }

  private toStoredStatus(
    status?: string,
  ): 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null {
    if (status === 'sent') return 'sent';
    if (status === 'delivered') return 'delivered';
    if (status === 'read') return 'read';
    if (status === 'failed') return 'failed';
    return null;
  }

  private statusFromConfig(config: WbaConfig, now: number) {
    return {
      name: config.name,
      provider: 'wba' as const,
      capabilities: getProviderCapabilities('wba'),
      connected: config.wbaLastHealthCheckStatus === 'healthy',
      startTime: config.createdAt.toISOString(),
      uptime: Math.max(0, now - config.createdAt.getTime()),
      phoneNumber: config.wbaDisplayPhoneNumber ?? undefined,
      webhook: {
        url: config.webhookUrl,
        headers: this.toHeaders(config.webhookHeaders),
        enabled: config.webhookEnabled,
        events: config.webhookEvents ?? [],
      },
      wba: {
        phoneNumberId: config.wbaPhoneNumberId,
        businessAccountId: config.wbaBusinessAccountId,
        displayPhoneNumber: config.wbaDisplayPhoneNumber,
        webhookConfiguredAt: config.wbaWebhookConfiguredAt
          ? config.wbaWebhookConfiguredAt.toISOString()
          : null,
        lastHealthCheckAt: config.wbaLastHealthCheckAt
          ? config.wbaLastHealthCheckAt.toISOString()
          : null,
        lastHealthCheckStatus: config.wbaLastHealthCheckStatus,
        appSecretConfigured: Boolean(config.wbaAppSecretEncrypted),
      },
    };
  }

  private async refreshHealthStatus(config: WbaConfig): Promise<void> {
    if (!config.wbaPhoneNumberId || !config.wbaAccessTokenEncrypted) return;
    const accessToken = this.credentialsService.decrypt(
      config.wbaAccessTokenEncrypted,
    );
    const result = await this.wbaClient.healthCheck(
      config.wbaPhoneNumberId,
      accessToken,
    );
    await this.updateHealthStatus(
      config,
      result.healthy ? 'healthy' : 'unhealthy',
      new Date(),
    );
  }

  private async updateHealthStatus(
    config: WbaConfig,
    status: string,
    when: Date,
  ): Promise<void> {
    await this.prisma.instanceConfig.update({
      where: { userId_name: { userId: config.userId, name: config.name } },
      data: {
        wbaLastHealthCheckStatus: status,
        wbaLastHealthCheckAt: when,
      },
    });
  }

  private toHeaders(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, string>;
  }
}
