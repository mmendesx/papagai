import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Instance, WebhookData } from '../whatsapp/interfaces/whatsapp.interface';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendWebhook(instance: Instance, data: WebhookData): Promise<void> {
    if (!instance.webhookUrl) {
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Papagai-Instance': instance.name,
      'X-Papagai-Event': data.event,
      ...instance.webhookHeaders,
    };

    try {
      await firstValueFrom(
        this.httpService.post(instance.webhookUrl, data, {
          headers,
          timeout: 5000,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to deliver webhook to ${instance.webhookUrl} for instance "${instance.name}" event "${data.event}": ${message}`,
      );
    }
  }
}
