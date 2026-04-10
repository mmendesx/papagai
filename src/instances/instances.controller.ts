import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard.js';
import * as QRCode from 'qrcode';
import { InstancesService } from './instances.service.js';
import { CreateInstanceDto } from './dto/create-instance.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { MetaMessageDto } from './dto/send-message.dto.js';
import { PaginateQueryDto } from './dto/paginate-query.dto.js';

export const ALLOWED_WEBHOOK_EVENTS = [
  'message',
  'message_update',
  'qr',
  'connected',
  'disconnected',
] as const;

@Controller('api/instances')
@UseGuards(JwtAuthGuard)
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Post('create')
  async createInstance(@Req() req: Request, @Body() dto: CreateInstanceDto) {
    const userId = (req['user'] as JwtPayload).sub;
    if (dto.webhookEvents) {
      const invalid = dto.webhookEvents.filter(
        (e) =>
          !ALLOWED_WEBHOOK_EVENTS.includes(
            e as (typeof ALLOWED_WEBHOOK_EVENTS)[number],
          ),
      );
      if (invalid.length > 0) {
        throw new HttpException(
          `Invalid webhook event(s): ${invalid.join(', ')}. Allowed: ${ALLOWED_WEBHOOK_EVENTS.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    try {
      await this.instancesService.createInstance(
        userId,
        dto.name,
        dto.webhook,
        dto.webhookHeaders,
        dto.webhookEnabled,
        dto.webhookEvents,
      );
      return {
        success: true,
        instance: dto.name,
        message: `🦜 Papagai ${dto.name} criado com sucesso! Escaneie o QR code para começar.`,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':name/messages')
  async sendMessage(
    @Req() req: Request,
    @Param('name') name: string,
    @Body() dto: MetaMessageDto,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    try {
      const result = await this.instancesService.sendMessage(userId, name, dto);
      const messageId = result?.key?.id ?? result?.messages?.[0]?.id ?? '';
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: dto.to, wa_id: dto.to }],
        messages: [{ id: messageId }],
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':name/qr')
  async getQR(@Req() req: Request, @Param('name') name: string) {
    const userId = (req['user'] as JwtPayload).sub;
    const instance = this.instancesService.getInstance(userId, name);
    if (!instance) {
      throw new HttpException(
        `Papagai ${name} não encontrado`,
        HttpStatus.NOT_FOUND,
      );
    }
    const qr = this.instancesService.getQR(userId, name);
    if (qr) {
      const qrImageData = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
      }).catch(() => null);
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
  async getContact(
    @Req() req: Request,
    @Param('name') name: string,
    @Param('number') number: string,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    try {
      return await this.instancesService.getContactInfo(userId, name, number);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':name/chats')
  async getChats(
    @Req() req: Request,
    @Param('name') name: string,
    @Query('include_messages') includeMessages?: string,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    try {
      const chats = await this.instancesService.getChats(
        userId,
        name,
        includeMessages === 'true',
      );
      return { instance: name, total: chats.length, chats };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':name/chats/:chatId/read')
  markChatRead(
    @Req() req: Request,
    @Param('name') name: string,
    @Param('chatId') chatId: string,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    const normalised = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    this.instancesService.markChatRead(userId, name, normalised);
    return { ok: true };
  }

  @Get(':name/chats/:chatId/messages')
  async getChatMessages(
    @Req() req: Request,
    @Param('name') name: string,
    @Param('chatId') rawChatId: string,
    @Query('limit', new DefaultValuePipe(100), new ParseIntPipe({ optional: false }))
    limit: number,
  ) {
    const userId = (req['user'] as JwtPayload).sub;

    // Validate chatId format: digits-only or a full JID (any suffix)
    const CHAT_ID_RE = /^[0-9]+(@[\w.-]+)?$/;
    if (!CHAT_ID_RE.test(rawChatId)) {
      throw new HttpException(
        `chatId "${rawChatId}" is invalid. Expected digits or a full JID (e.g. 5511999999999 or 5511999999999@s.whatsapp.net)`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Clamp limit
    const clampedLimit = Math.min(Math.max(limit, 1), 500);

    // Normalise: append @s.whatsapp.net only when caller passes bare digits
    const chatId = rawChatId.includes('@')
      ? rawChatId
      : `${rawChatId}@s.whatsapp.net`;

    try {
      const messages = this.instancesService.getChatMessages(
        userId,
        name,
        chatId,
        clampedLimit,
      );
      return { instance: name, chatId, total: messages.length, messages };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        msg,
        msg.includes('não encontrado') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':name/metrics')
  async getMetrics(@Req() req: Request, @Param('name') name: string) {
    const userId = (req['user'] as JwtPayload).sub;
    try {
      const metrics = this.instancesService.getMetrics(userId, name);
      return { instance: name, metrics };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        msg,
        msg.includes('não encontrado') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':name/status')
  async getStatus(@Req() req: Request, @Param('name') name: string) {
    const userId = (req['user'] as JwtPayload).sub;
    const instance = this.instancesService.getInstance(userId, name);
    if (!instance) {
      throw new HttpException(
        `Papagai ${name} não encontrado`,
        HttpStatus.NOT_FOUND,
      );
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
  async listInstances(@Req() req: Request, @Query() query: PaginateQueryDto) {
    const userId = (req['user'] as any).sub;
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const { instances, total } = this.instancesService.getInstances(userId, {
      page,
      limit,
    });
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const message = `🦜 Você tem ${total} ${total === 1 ? 'papagai' : 'papagais'}`;
    return { instances, total, page, limit, totalPages, message };
  }

  @Patch(':name/webhook')
  async updateWebhook(
    @Req() req: Request,
    @Param('name') name: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    if (dto.events) {
      const invalid = dto.events.filter(
        (e) => !ALLOWED_WEBHOOK_EVENTS.includes(e as any),
      );
      if (invalid.length > 0) {
        throw new HttpException(
          `Invalid webhook event(s): ${invalid.join(', ')}. Allowed: ${ALLOWED_WEBHOOK_EVENTS.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    try {
      const instance = await this.instancesService.updateWebhookConfig(
        userId,
        name,
        {
          webhookUrl: dto.webhookUrl,
          webhookHeaders: dto.webhookHeaders,
          webhookEnabled: dto.enabled,
          webhookEvents: dto.events,
        },
      );
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
  async disconnectInstance(@Req() req: Request, @Param('name') name: string) {
    const userId = (req['user'] as JwtPayload).sub;
    const success = await this.instancesService.disconnectInstance(
      userId,
      name,
    );
    if (success) {
      return {
        message: `🦜 Papagai ${name} foi dormir. Até logo!`,
        instance: name,
      };
    }
    throw new HttpException(
      `Papagai ${name} não encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }
}
