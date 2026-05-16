import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { isAbsolute, join, resolve, sep } from 'path';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaUrlService } from '../media/media-url.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { WbaInstanceService } from '../wba/wba-instance.service.js';
import { ChatRealtimeEvent } from '../whatsapp/chat-store.service.js';
import { toMessageContent } from '../whatsapp/utils/transformer.js';
import {
  validateOrThrow,
  WebhookUrlInvalidError,
} from '../webhook/webhook-url-validator.js';
import {
  InstanceProvider,
  getProviderCapabilities,
} from './provider-capabilities.js';
import {
  GetBase64FromMediaMessageDto,
  GetBase64FromMediaMessageResponseDto,
} from './dto/get-base64-from-media-message.dto.js';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly wbaService: WbaInstanceService,
    private readonly configService: ConfigService,
    private readonly mediaUrlService: MediaUrlService,
    private readonly prisma: PrismaService,
  ) {}

  async createInstance(
    userId: string,
    name: string,
    webhookUrl?: string,
    webhookHeaders?: Record<string, string>,
    webhookEnabled?: boolean,
    webhookEvents?: string[],
    provider: InstanceProvider = 'web',
    wba?: {
      businessAccountId: string;
      phoneNumberId: string;
      displayPhoneNumber: string;
      accessToken: string;
      appSecret?: string;
      webhookVerifyToken?: string;
    },
  ): Promise<void> {
    this.logger.log(`Creating instance: ${userId}:${name} (${provider})`);

    if (webhookUrl) {
      await this.validateWebhookUrl(webhookUrl);
    }

    if (provider === 'wba') {
      if (!wba) {
        throw new BadRequestException(
          'WBA configuration is required when provider is wba.',
        );
      }
      await this.wbaService.createInstance(
        userId,
        name,
        wba,
        webhookUrl,
        webhookHeaders,
        webhookEnabled,
        webhookEvents,
      );
      return;
    }

    await this.whatsappService.createInstance(
      userId,
      name,
      webhookUrl,
      webhookHeaders,
      webhookEnabled,
      webhookEvents,
    );
  }

  async getProvider(userId: string, name: string): Promise<InstanceProvider> {
    const config = await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name } },
      select: { provider: true },
    });
    if (!config) {
      throw new NotFoundException(`Papagai ${name} não encontrado`);
    }
    return config.provider === 'wba' ? 'wba' : 'web';
  }

  async getInstanceStatus(userId: string, name: string): Promise<any> {
    const provider = await this.getProvider(userId, name);
    if (provider === 'wba') {
      return this.wbaService.getStatus(userId, name);
    }

    const instance = this.whatsappService.getInstance(userId, name);
    if (!instance) {
      throw new NotFoundException(`Papagai ${name} não encontrado`);
    }
    return {
      name: instance.name,
      provider: 'web',
      capabilities: getProviderCapabilities('web'),
      connected: instance.connected,
      startTime: new Date(instance.startTime).toISOString(),
      uptime: Date.now() - instance.startTime,
      phoneNumber: instance.socket.user?.id?.split(':')[0],
      webhook: {
        url: instance.webhookUrl,
        headers: instance.webhookHeaders,
        enabled: instance.webhookEnabled,
        events: instance.webhookEvents,
      },
    };
  }

  async getInstance(userId: string, name: string): Promise<unknown> {
    const provider = await this.getProvider(userId, name);
    if (provider === 'wba') {
      return this.wbaService.getStatus(userId, name);
    }
    return this.whatsappService.getInstance(userId, name);
  }

  async getQR(userId: string, name: string): Promise<string | null> {
    const provider = await this.getProvider(userId, name);
    if (provider === 'wba') {
      throw new BadRequestException(
        'QR pairing is only available for provider web instances.',
      );
    }
    return this.whatsappService.getQR(userId, name);
  }

  async sendMessage(
    userId: string,
    instanceName: string,
    payload: Record<string, any>,
  ): Promise<any> {
    this.logger.log(
      `${userId}:${instanceName} sending message type ${payload.type} to ${payload.to}`,
    );

    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      return this.wbaService.sendMessage(userId, instanceName, payload);
    }

    await this.validateMessageMediaUrls(payload);
    const content = toMessageContent(payload);
    return this.whatsappService.send(userId, instanceName, payload.to, content);
  }

  async getContactInfo(
    userId: string,
    instanceName: string,
    number: string,
  ): Promise<any> {
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      return this.wbaService.getContactInfo(userId, instanceName, number);
    }
    return this.whatsappService.getContactInfo(userId, instanceName, number);
  }

  async getChats(
    userId: string,
    instanceName: string,
    includeMessages?: boolean,
  ): Promise<any[]> {
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      return this.wbaService.getChats(userId, instanceName);
    }
    return this.whatsappService.getChats(
      userId,
      instanceName,
      includeMessages ?? false,
    );
  }

  async getChatMessages(
    userId: string,
    instanceName: string,
    chatId: string,
    limit: number,
  ): Promise<any[]> {
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      return this.wbaService.getChatMessages(
        userId,
        instanceName,
        chatId,
        limit,
      );
    }
    return this.whatsappService.getChatMessages(
      userId,
      instanceName,
      chatId,
      limit,
    );
  }

  async streamChatEvents(
    userId: string,
    instanceName: string,
  ): Promise<Observable<ChatRealtimeEvent>> {
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      return this.wbaService.streamChatEvents(userId, instanceName);
    }
    return this.whatsappService.streamChatEvents(userId, instanceName);
  }

  async getBase64FromMediaMessage(
    userId: string,
    instanceName: string,
    payload: GetBase64FromMediaMessageDto,
  ): Promise<GetBase64FromMediaMessageResponseDto> {
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      throw new BadRequestException(
        'WBA media base64 retrieval is not supported yet.',
      );
    }

    if (payload.convertToMp4) {
      throw new BadRequestException('Media conversion is not supported.');
    }

    const messageId = payload.message.key.id;
    const message = this.whatsappService.findMessageById(
      userId,
      instanceName,
      messageId,
    );
    if (!message) {
      throw new BadRequestException('Message not found');
    }

    if (
      !message.mediaPath ||
      !message.filename ||
      !message.mimetype ||
      typeof message.size !== 'number'
    ) {
      throw new BadRequestException('Message is not a media message');
    }

    const mediaDir = resolve(
      this.configService.get<string>('mediaDir') || './media',
    );
    const candidatePath = isAbsolute(message.mediaPath)
      ? resolve(message.mediaPath)
      : resolve(join(mediaDir, message.mediaPath));
    const mediaDirPrefix = mediaDir.endsWith(sep)
      ? mediaDir
      : `${mediaDir}${sep}`;
    if (
      candidatePath !== mediaDir &&
      !candidatePath.startsWith(mediaDirPrefix)
    ) {
      throw new BadRequestException('Stored media path is invalid');
    }

    let base64: string;
    try {
      base64 = readFileSync(candidatePath).toString('base64');
    } catch {
      throw new BadRequestException('Stored media is unavailable');
    }

    return {
      mediaType: this.toEvolutionMediaType(message.type),
      fileName: message.filename,
      mimetype: message.mimetype,
      size: { fileLength: message.size },
      caption: message.caption ?? null,
      base64,
    };
  }

  async markChatRead(
    userId: string,
    instanceName: string,
    chatId: string,
  ): Promise<void> {
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      await this.wbaService.markChatRead(userId, instanceName);
      return;
    }
    this.whatsappService.markChatRead(userId, instanceName, chatId);
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
    const provider = await this.getProvider(userId, instanceName);
    if (provider === 'wba') {
      return this.wbaService.getMetrics(userId, instanceName);
    }
    return this.whatsappService.getMetrics(userId, instanceName);
  }

  async updateWebhookConfig(
    userId: string,
    name: string,
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
    if (config.webhookUrl) {
      await this.validateWebhookUrl(config.webhookUrl);
    }

    const provider = await this.getProvider(userId, name);
    if (provider === 'wba') {
      return this.wbaService.updateWebhookConfig(userId, name, config);
    }

    const updated = await this.whatsappService.updateWebhookConfig(
      userId,
      name,
      config,
    );
    return {
      webhookUrl: updated.webhookUrl,
      webhookHeaders: updated.webhookHeaders,
      webhookEnabled: updated.webhookEnabled,
      webhookEvents: updated.webhookEvents,
    };
  }

  async getInstances(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ instances: any[]; total: number }> {
    const webInstances = this.whatsappService.getInstances(userId, {
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const wbaInstances = await this.wbaService.getListItems(userId, {
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });

    const all = [...webInstances.instances, ...wbaInstances.instances].sort(
      (a, b) => b.startTime - a.startTime,
    );
    const total = all.length;
    const start = (pagination.page - 1) * pagination.limit;
    const instances = all.slice(start, start + pagination.limit);
    return { instances, total };
  }

  async disconnectInstance(userId: string, name: string): Promise<boolean> {
    const provider = await this.getProvider(userId, name);
    if (provider === 'wba') {
      return this.wbaService.disconnectInstance(userId, name);
    }
    return this.whatsappService.disconnectInstance(userId, name);
  }

  private toEvolutionMediaType(type: string): string {
    const map: Record<string, string> = {
      image: 'imageMessage',
      audio: 'audioMessage',
      video: 'videoMessage',
      document: 'documentMessage',
      sticker: 'stickerMessage',
    };
    return map[type] ?? 'unknownMessage';
  }

  private async validateWebhookUrl(url: string): Promise<void> {
    const allowPrivate =
      this.configService.get<boolean>('webhookAllowPrivateHosts') ?? false;
    try {
      await validateOrThrow(url, { allowPrivate });
    } catch (error) {
      if (error instanceof WebhookUrlInvalidError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async validateMessageMediaUrls(payload: any): Promise<void> {
    const mediaPayloads = [
      payload?.image,
      payload?.audio,
      payload?.video,
      payload?.document,
      payload?.sticker,
    ];

    for (const media of mediaPayloads) {
      if (typeof media?.data === 'string' && media.data.trim() !== '') {
        continue;
      }

      const link = media?.link;
      if (typeof link !== 'string' || link.trim() === '') {
        continue;
      }
      await this.validateMediaUrl(link);
    }
  }

  private async validateMediaUrl(url: string): Promise<void> {
    if (this.mediaUrlService.isSignedMediaUrl(url)) {
      return;
    }

    const allowPrivate =
      this.configService.get<boolean>('mediaAllowPrivateHosts') ?? false;
    try {
      await validateOrThrow(url, { allowPrivate });
    } catch (error) {
      if (error instanceof WebhookUrlInvalidError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
