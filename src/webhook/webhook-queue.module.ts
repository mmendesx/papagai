import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';

export interface WebhookJobData {
  instanceName: string;
  webhookUrl: string;
  webhookEnabled: boolean;
  webhookEvents: string[];
  webhookHeaders: Record<string, string>;
  event: string;
  payload: Record<string, unknown>;
}

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE })],
  exports: [BullModule],
})
export class WebhookQueueModule {}
