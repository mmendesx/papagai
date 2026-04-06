import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import * as QRCode from 'qrcode';
import { InstancesService } from './instances.service.js';
import { CreateInstanceDto } from './dto/create-instance.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { MetaMessageDto } from './dto/send-message.dto.js';

export const ALLOWED_WEBHOOK_EVENTS = ['message', 'message_update', 'qr', 'connected', 'disconnected'] as const;

@Controller('api/instances')
@UseGuards(JwtAuthGuard)
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Post('create')
  async createInstance(@Body() dto: CreateInstanceDto) {
    if (dto.webhookEvents) {
      const invalid = dto.webhookEvents.filter((e) => !ALLOWED_WEBHOOK_EVENTS.includes(e as (typeof ALLOWED_WEBHOOK_EVENTS)[number]));
      if (invalid.length > 0) {
        throw new HttpException(
          `Invalid webhook event(s): ${invalid.join(', ')}. Allowed: ${ALLOWED_WEBHOOK_EVENTS.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    try {
      await this.instancesService.createInstance(dto.name, dto.webhook, dto.webhookHeaders, dto.webhookEnabled, dto.webhookEvents);
      return {
        success: true,
        instance: dto.name,
        message: `🦜 Papagai ${dto.name} criado com sucesso! Escaneie o QR code para começar.`,
      };
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/messages')
  async sendMessage(@Param('name') name: string, @Body() dto: MetaMessageDto) {
    try {
      const result = await this.instancesService.sendMessage(name, dto);
      const messageId = result?.key?.id ?? result?.messages?.[0]?.id ?? '';
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: dto.to, wa_id: dto.to }],
        messages: [{ id: messageId }],
      };
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/qr')
  async getQR(@Param('name') name: string) {
    const instance = this.instancesService.getInstance(name);
    if (!instance) {
      throw new HttpException(`Papagai ${name} não encontrado`, HttpStatus.NOT_FOUND);
    }
    const qr = this.instancesService.getQR(name);
    if (qr) {
      const qrImageData = await QRCode.toDataURL(qr, { width: 300, margin: 2 }).catch(() => null);
      return {
        qr,
        qrImageData,
        status: 'qr',
        instance: name,
        message: '🦜 Escaneie o QR code com seu WhatsApp',
      };
    }
    if (instance.connected) {
      return {
        status: 'connected',
        phoneNumber: instance.socket.user?.id?.split(':')[0],
        message: '🦜 Papagai conectado! Pronto para repetir mensagens.',
      };
    }
    return {
      status: 'connecting',
      instance: name,
      message: '🦜 Papagai está conectando ao WhatsApp, aguarde o QR code...',
    };
  }

  @Get(':name/contact/:number')
  async getContact(@Param('name') name: string, @Param('number') number: string) {
    try {
      return await this.instancesService.getContactInfo(name, number);
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/chats')
  async getChats(@Param('name') name: string, @Query('include_messages') includeMessages?: string) {
    try {
      const chats = await this.instancesService.getChats(name, includeMessages === 'true');
      return { instance: name, total: chats.length, chats };
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/status')
  async getStatus(@Param('name') name: string) {
    const instance = this.instancesService.getInstance(name);
    if (!instance) {
      throw new HttpException(`Papagai ${name} não encontrado`, HttpStatus.NOT_FOUND);
    }
    return {
      name: instance.name,
      connected: instance.connected,
      startTime: new Date(instance.startTime).toISOString(),
      uptime: Date.now() - instance.startTime,
      phoneNumber: instance.socket.user?.id?.split(':')[0],
      webhook: {
        url: instance.webhookUrl,
        headers: instance.webhookHeaders,
        enabled: instance.webhookEnabled,
        events: instance.webhookEvents,
      },
    };
  }

  @Get()
  async listInstances() {
    const instances = this.instancesService.getInstances();
    return {
      total: instances.length,
      instances,
      message: `🦜 Você tem ${instances.length} papagai${instances.length === 1 ? '' : 's'}`,
    };
  }

  @Patch(':name/webhook')
  async updateWebhook(@Param('name') name: string, @Body() dto: UpdateWebhookDto) {
    if (dto.events) {
      const invalid = dto.events.filter(e => !ALLOWED_WEBHOOK_EVENTS.includes(e as any));
      if (invalid.length > 0) {
        throw new HttpException(
          `Invalid webhook event(s): ${invalid.join(', ')}. Allowed: ${ALLOWED_WEBHOOK_EVENTS.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    try {
      const instance = await this.instancesService.updateWebhookConfig(name, {
        webhookUrl: dto.webhookUrl,
        webhookHeaders: dto.webhookHeaders,
        webhookEnabled: dto.enabled,
        webhookEvents: dto.events,
      });
      return {
        instance: name,
        webhook: {
          url: instance.webhookUrl,
          headers: instance.webhookHeaders,
          enabled: instance.webhookEnabled,
          events: instance.webhookEvents,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':name')
  async disconnectInstance(@Param('name') name: string) {
    const success = await this.instancesService.disconnectInstance(name);
    if (success) {
      return { message: `🦜 Papagai ${name} foi dormir. Até logo!`, instance: name };
    }
    throw new HttpException(`Papagai ${name} não encontrado`, HttpStatus.NOT_FOUND);
  }
}
