import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { WebhookModule } from '../webhook/webhook.module.js';
import { WhatsappService } from './whatsapp.service.js';
import { ChatStoreService, REDIS_CLIENT } from './chat-store.service.js';
import { InstanceConfig } from '../instances/entities/instance-config.entity.js';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([InstanceConfig]),
    WebhookModule,
  ],
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
