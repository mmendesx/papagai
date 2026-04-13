import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import {
  validateOrThrow,
  WebhookUrlInvalidError,
} from './webhook-url-validator.js';
import {
  WEBHOOK_DELIVERY_QUEUE,
  WebhookJobData,
} from './webhook-queue.module.js';

export type { WebhookJobData };

@Injectable()
@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { instanceName, webhookUrl, webhookHeaders, event, payload } =
      job.data;
    const allowPrivate =
      this.configService.get<boolean>('webhookAllowPrivateHosts') ?? false;

    // Re-validate on every attempt — SSRF addresses should never be retried
    try {
      await validateOrThrow(webhookUrl, { allowPrivate });
    } catch (error: unknown) {
      if (error instanceof WebhookUrlInvalidError) {
        this.logger.warn(
          `Webhook blocked (SSRF): instance=${instanceName} url=${this.extractHostname(webhookUrl)} — moving to failed`,
        );
        await job.moveToFailed(new Error('SSRF-blocked address'), job.token ?? '');
        return;
      }
      throw error;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Papagai-Instance': instanceName,
      'X-Papagai-Event': event,
      ...webhookHeaders,
    };

    try {
      await firstValueFrom(
        this.httpService.post(webhookUrl, payload, {
          headers,
          maxRedirects: 0,
          timeout: 5000,
          validateStatus: (s) => s >= 200 && s < 300,
        }),
      );
      if (job.attemptsMade > 0) {
        this.logger.log(
          `Webhook delivered on retry: instance=${instanceName} event=${event} attempt=${job.attemptsMade + 1}`,
        );
      }
    } catch (error: unknown) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        // Final attempt — log before BullMQ moves to failed
        const category = this.classifyError(error);
        this.logger.warn(
          `Webhook delivery exhausted: instance=${instanceName} event=${event} category=${category} attempts=${job.attemptsMade + 1}`,
        );
      }
      throw error; // Let BullMQ handle retry scheduling
    }
  }

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '<invalid>';
    }
  }

  private classifyError(error: unknown): string {
    const err = error as {
      code?: string;
      message?: string;
      response?: { status?: number };
    };
    if (err.response?.status) return `http_${err.response.status}`;
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
      return 'timeout';
    if (err.code === 'ECONNREFUSED') return 'refused';
    if (err.code === 'ENOTFOUND') return 'dns_failure';
    return 'unknown';
  }
}
