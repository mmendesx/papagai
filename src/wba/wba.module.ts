import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { WbaCredentialsService } from './wba-credentials.service.js';
import { WbaClientService } from './wba-client.service.js';
import { WbaInstanceService } from './wba-instance.service.js';
import { WbaWebhookService } from './wba-webhook.service.js';
import { WbaWebhookController } from './wba-webhook.controller.js';

@Module({
  imports: [PrismaModule, WhatsappModule],
  providers: [
    WbaCredentialsService,
    WbaClientService,
    WbaInstanceService,
    WbaWebhookService,
  ],
  controllers: [WbaWebhookController],
  exports: [WbaInstanceService, WbaWebhookService, WbaCredentialsService],
})
export class WbaModule {}
