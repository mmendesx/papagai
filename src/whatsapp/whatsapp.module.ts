import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { WebhookModule } from '../webhook/webhook.module.js';
import { WhatsappService } from './whatsapp.service.js';
import { ChatStoreService, REDIS_CLIENT } from './chat-store.service.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [HttpModule, WebhookModule, MediaModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('redisUrl') || 'redis://localhost:6379'),
      inject: [ConfigService],
    },
    WhatsappService,
    ChatStoreService,
  ],
  exports: [WhatsappService, ChatStoreService],
})
export class WhatsappModule {}
