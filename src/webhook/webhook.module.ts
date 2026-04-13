import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookQueueModule } from './webhook-queue.module.js';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor.js';

@Module({
  imports: [HttpModule, WebhookQueueModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookDeliveryProcessor],
  exports: [WebhookService],
})
export class WebhookModule {}
