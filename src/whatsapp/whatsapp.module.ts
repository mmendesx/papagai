import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookModule } from '../webhook/webhook.module.js';
import { WhatsappService } from './whatsapp.service.js';
import { InstanceConfig } from '../instances/entities/instance-config.entity.js';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([InstanceConfig]), WebhookModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
