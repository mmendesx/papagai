import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { Instance } from '../whatsapp/interfaces/whatsapp.interface.js';
import { toMessageContent } from '../whatsapp/utils/transformer.js';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  createInstance(
    name: string,
    webhookUrl?: string,
    webhookHeaders?: Record<string, string>,
    webhookEnabled?: boolean,
    webhookEvents?: string[],
  ): Promise<Instance> {
    this.logger.log(`Criando novo papagai: ${name}`);
    return this.whatsappService.createInstance(name, webhookUrl, webhookHeaders, webhookEnabled, webhookEvents);
  }

  getInstance(name: string): Instance | undefined {
    return this.whatsappService.getInstance(name);
  }

  getQR(name: string): string | null {
    return this.whatsappService.getQR(name);
  }

  async sendMessage(instanceName: string, payload: any): Promise<any> {
    this.logger.log(`${instanceName} enviando mensagem tipo ${payload.type} para ${payload.to}`);
    const content = toMessageContent(payload);
    return this.whatsappService.send(instanceName, payload.to, content);
  }

  getContactInfo(instanceName: string, number: string): Promise<any> {
    this.logger.log(`${instanceName} buscando info do contato ${number}`);
    return this.whatsappService.getContactInfo(instanceName, number);
  }

  getChats(instanceName: string, includeMessages?: boolean): Promise<any> {
    this.logger.log(`${instanceName} buscando conversas`);
    return this.whatsappService.getChats(instanceName, includeMessages ?? false);
  }

  async updateWebhookConfig(
    name: string,
    config: {
      webhookUrl?: string;
      webhookHeaders?: Record<string, string>;
      webhookEnabled?: boolean;
      webhookEvents?: string[];
    },
  ) {
    return this.whatsappService.updateWebhookConfig(name, config);
  }

  getInstances(): Array<{
    name: string;
    connected: boolean;
    startTime: number;
    webhookEnabled: boolean;
    webhook: { url: string | null; headers: Record<string, string>; enabled: boolean; events: string[] };
  }> {
    return this.whatsappService.getInstances();
  }

  disconnectInstance(name: string): Promise<boolean> {
    this.logger.log(`Desconectando papagai: ${name}`);
    return this.whatsappService.disconnectInstance(name);
  }
}
