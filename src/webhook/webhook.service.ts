import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import {
  Instance,
  WebhookData,
} from '../whatsapp/interfaces/whatsapp.interface';
import {
  validateOrThrow,
  WebhookUrlInvalidError,
} from './webhook-url-validator';
import {
  WEBHOOK_DELIVERY_QUEUE,
  WebhookJobData,
} from './webhook-queue.module.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly webhookQueue: Queue<WebhookJobData>,
  ) {}

  async sendWebhook(instance: Instance, data: WebhookData): Promise<void> {
    if (!instance.webhookUrl) {
      return;
    }

    if (!instance.webhookEnabled) {
      this.logger.debug(
        `Webhook disabled for instance "${instance.name}" — skipping ${data.event}`,
      );
      return;
    }

    if (!instance.webhookEvents.includes(data.event)) {
      this.logger.debug(
        `Event "${data.event}" not in allowed events for instance "${instance.name}" — skipping`,
      );
      return;
    }

    // Dispatch-time SSRF re-validation. DNS rebinding and late-bound addresses
    // may differ from the config-time check, so we re-resolve right before dispatch.
    const allowPrivate =
      this.configService.get<boolean>('webhookAllowPrivateHosts') ?? false;
    try {
      await validateOrThrow(instance.webhookUrl, { allowPrivate });
    } catch (error: unknown) {
      if (error instanceof WebhookUrlInvalidError) {
        const hostname = this.extractHostname(instance.webhookUrl);
        this.logger.warn(
          `Webhook failed: instance=${instance.name} host=${hostname} category=blocked_address`,
        );
        this.logger.debug(error);
        return;
      }
      // Unexpected error from validateOrThrow — fall through so it is not silently lost
      throw error;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Papagai-Instance': instance.name,
      'X-Papagai-Event': data.event,
      ...instance.webhookHeaders,
    };

    const hostname = this.extractHostname(instance.webhookUrl);

    try {
      await firstValueFrom(
        this.httpService.post(instance.webhookUrl, data, {
          headers,
          maxRedirects: 0,
          timeout: 5000,
          validateStatus: (s) => s >= 200 && s < 300,
        }),
      );
    } catch (error: unknown) {
      const maxRetries = this.configService.get<number>('webhookMaxRetries', 3);
      const category = this.classifyAxiosError(error);
      const extra =
        category === 'http_status'
          ? ` status=${(error as { response?: { status?: number } }).response?.status}`
          : '';

      if (maxRetries > 0) {
        const jobData: WebhookJobData = {
          instanceName: instance.name,
          webhookUrl: instance.webhookUrl,
          webhookEnabled: instance.webhookEnabled,
          webhookEvents: instance.webhookEvents,
          webhookHeaders: instance.webhookHeaders,
          event: data.event,
          payload: data as unknown as Record<string, unknown>,
        };
        void this.webhookQueue.add('deliver', jobData, {
          attempts: maxRetries + 1,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 100,
        });
        this.logger.debug(
          `Webhook failed (${category}${extra}), enqueued for retry: instance=${instance.name} event=${data.event}`,
        );
      } else {
        this.logger.warn(
          `Webhook failed: instance=${instance.name} host=${hostname} category=${category}${extra}`,
        );
        this.logger.debug(error);
      }
    }
  }

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '<invalid-url>';
    }
  }

  private classifyAxiosError(error: unknown): string {
    if (error instanceof WebhookUrlInvalidError) {
      return 'blocked_address';
    }

    const err = error as {
      code?: string;
      message?: string;
      response?: { status?: number };
    };

    if (err.response?.status !== undefined) {
      return 'http_status';
    }

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return 'timeout';
    }

    if (err.code === 'ECONNREFUSED') {
      return 'refused';
    }

    if (err.code === 'ENOTFOUND') {
      return 'dns_failure';
    }

    return 'unknown';
  }
}
