import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { Instance } from '../whatsapp/interfaces/whatsapp.interface.js';
import { ChatRealtimeEvent } from '../whatsapp/chat-store.service.js';
import { toMessageContent } from '../whatsapp/utils/transformer.js';
import {
  validateOrThrow,
  WebhookUrlInvalidError,
} from '../webhook/webhook-url-validator.js';
import { Observable } from 'rxjs';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly configService: ConfigService,
  ) {}

  async createInstance(
    userId: string,
    name: string,
    webhookUrl?: string,
    webhookHeaders?: Record<string, string>,
    webhookEnabled?: boolean,
    webhookEvents?: string[],
  ): Promise<Instance> {
    this.logger.log(`Criando novo papagai: ${userId}:${name}`);

    if (webhookUrl) {
      await this.validateWebhookUrl(webhookUrl);
    }

    return this.whatsappService.createInstance(
      userId,
      name,
      webhookUrl,
      webhookHeaders,
      webhookEnabled,
      webhookEvents,
    );
  }

  getInstance(userId: string, name: string): Instance | undefined {
    return this.whatsappService.getInstance(userId, name);
  }

  getQR(userId: string, name: string): string | null {
    return this.whatsappService.getQR(userId, name);
  }

  async sendMessage(
    userId: string,
    instanceName: string,
    payload: any,
  ): Promise<any> {
    this.logger.log(
      `${userId}:${instanceName} enviando mensagem tipo ${payload.type} para ${payload.to}`,
    );
    const content = toMessageContent(payload);
    return this.whatsappService.send(userId, instanceName, payload.to, content);
  }

  getContactInfo(
    userId: string,
    instanceName: string,
    number: string,
  ): Promise<any> {
    this.logger.log(
      `${userId}:${instanceName} buscando info do contato ${number}`,
    );
    return this.whatsappService.getContactInfo(userId, instanceName, number);
  }

  getChats(userId: string, instanceName: string, includeMessages?: boolean) {
    this.logger.log(`${userId}:${instanceName} buscando conversas`);
    return this.whatsappService.getChats(
      userId,
      instanceName,
      includeMessages ?? false,
    );
  }

  getChatMessages(
    userId: string,
    instanceName: string,
    chatId: string,
    limit: number,
  ): any[] {
    this.logger.log(
      `${userId}:${instanceName} buscando mensagens do chat ${chatId}`,
    );
    return this.whatsappService.getChatMessages(
      userId,
      instanceName,
      chatId,
      limit,
    );
  }

  streamChatEvents(
    userId: string,
    instanceName: string,
  ): Observable<ChatRealtimeEvent> {
    this.logger.log(`${userId}:${instanceName} abrindo stream de eventos`);
    return this.whatsappService.streamChatEvents(userId, instanceName);
  }

  markChatRead(userId: string, instanceName: string, chatId: string): void {
    this.whatsappService.markChatRead(userId, instanceName, chatId);
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
    this.logger.log(`${userId}:${instanceName} buscando métricas`);
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
  ) {
    if (config.webhookUrl) {
      await this.validateWebhookUrl(config.webhookUrl);
    }

    return this.whatsappService.updateWebhookConfig(userId, name, config);
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

  getInstances(
    userId: string,
    pagination: { page: number; limit: number },
  ): { instances: any[]; total: number } {
    return this.whatsappService.getInstances(userId, pagination);
  }

  disconnectInstance(userId: string, name: string): Promise<boolean> {
    this.logger.log(`Desconectando papagai: ${userId}:${name}`);
    return this.whatsappService.disconnectInstance(userId, name);
  }
}
