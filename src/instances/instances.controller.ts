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
  HttpCode,
  HttpException,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Sse,
  MessageEvent,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Observable, interval, map, merge } from 'rxjs';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard.js';
import { AnyAuthGuard } from '../auth/guards/any-auth.guard.js';
import * as QRCode from 'qrcode';
import { InstancesService } from './instances.service.js';
import { ApiKeyService } from '../auth/api-key.service.js';
import { CreateApiKeyDto } from '../auth/dto/create-api-key.dto.js';
import { ApiKeyResponseDto } from '../auth/dto/api-key-response.dto.js';
import { CreateInstanceDto } from './dto/create-instance.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { MetaMessageDto } from './dto/send-message.dto.js';
import { PaginateQueryDto } from './dto/paginate-query.dto.js';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { InstanceStatusResponseDto } from './dto/instance-status-response.dto.js';
import { MessageResultResponseDto } from './dto/message-result-response.dto.js';
import { UploadResponseDto } from './dto/upload-response.dto.js';

export const ALLOWED_WEBHOOK_EVENTS = [
  'message',
  'message_update',
  'qr',
  'connected',
  'disconnected',
] as const;

@ApiTags('Instances')
@ApiBearerAuth('bearer')
@ApiSecurity('apiKey')
@Controller('api/instances')
@UseGuards(AnyAuthGuard)
export class InstancesController {
  constructor(
    private readonly instancesService: InstancesService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @ApiOperation({ summary: 'Create a new WhatsApp instance' })
  @ApiResponse({ status: 201, description: 'Instance created successfully', type: InstanceStatusResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid webhook event or instance creation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Instance name already in use' })
  @ApiResponse({ status: 422, description: 'Validation error' })
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

  @ApiOperation({ summary: 'Send a WhatsApp message' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'Message sent', type: MessageResultResponseDto })
  @ApiResponse({ status: 400, description: 'Send failed or invalid message type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'Get QR code for WhatsApp pairing' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'QR code or connection status', type: InstanceStatusResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'Get contact profile information' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (no +)', example: '5511999999999' })
  @ApiResponse({ status: 200, description: 'Contact info' })
  @ApiResponse({ status: 400, description: 'Lookup failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @ApiOperation({ summary: 'List chats for this instance' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiQuery({ name: 'include_messages', required: false, type: Boolean, description: 'Include recent messages in each chat' })
  @ApiResponse({ status: 200, description: 'List of chats' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'Stream chat updates for this instance (SSE)' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'SSE stream with chat updates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @Sse(':name/events')
  streamChatEvents(
    @Req() req: Request,
    @Param('name') name: string,
  ): Observable<MessageEvent> {
    const userId = (req['user'] as JwtPayload).sub;

    try {
      const updates$ = this.instancesService.streamChatEvents(userId, name).pipe(
        map((evt) => ({
          type: evt.type,
          data: evt,
        })),
      );

      // Keep-alive helps avoid proxy idle timeouts on long-lived SSE streams.
      const heartbeat$ = interval(25000).pipe(
        map(() => ({
          type: 'heartbeat',
          data: { type: 'heartbeat', timestamp: Date.now() },
        })),
      );

      return merge(updates$, heartbeat$);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        msg,
        msg.includes('não encontrado') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiOperation({ summary: 'Mark a chat as read' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiParam({ name: 'chatId', description: 'Chat JID or phone number', example: '5511999999999@s.whatsapp.net' })
  @ApiResponse({ status: 200, description: 'Chat marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'Get message history for a chat' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiParam({ name: 'chatId', description: 'Chat JID or bare phone number', example: '5511999999999' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of messages to return (1-500, default 100)' })
  @ApiResponse({ status: 200, description: 'Chat messages' })
  @ApiResponse({ status: 400, description: 'Invalid chatId format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'Get usage metrics for this instance' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'Instance metrics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'Get instance connection status' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'Instance status', type: InstanceStatusResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @ApiOperation({ summary: 'List all instances (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated instance list', type: [InstanceStatusResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @ApiOperation({ summary: 'Update webhook configuration for an instance' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @ApiResponse({ status: 400, description: 'Invalid webhook event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 422, description: 'Validation error' })
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

  @ApiOperation({ summary: 'Upload a media file for use in messages' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'File to upload (max 16 MB)' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded, returns public URL', type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'No file provided or file type not allowed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 413, description: 'File exceeds 16 MB limit' })
  @HttpCode(HttpStatus.CREATED)
  @Post(':name/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const rawName = (req.params as Record<string, string>).name ?? '';
          if (!/^[a-zA-Z0-9_-]+$/.test(rawName)) {
            return cb(new BadRequestException('Invalid instance name'), false as any);
          }
          const dir = join(process.cwd(), 'uploads', rawName);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ALLOWED_MIME_TYPES = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'video/mp4',
          'audio/ogg',
          'audio/mpeg',
          'audio/aac',
        ];
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type not allowed: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadFile(
    @Req() req: Request,
    @Param('name') name: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const userId = (req['user'] as JwtPayload).sub;
    const instance = this.instancesService.getInstance(userId, name);
    if (!instance) {
      try { unlinkSync(file.path); } catch { /* best-effort cleanup */ }
      throw new HttpException(`Instance ${name} not found`, HttpStatus.NOT_FOUND);
    }

    const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const url = `${baseUrl}/uploads/${encodeURIComponent(name)}/${file.filename}`;
    return { url };
  }

  @ApiOperation({ summary: 'Disconnect and delete a WhatsApp instance' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'Instance disconnected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
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

  @Post(':name/apikeys')
  @ApiOperation({ summary: 'Create an instance-scoped API key' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 201, description: 'Instance-scoped key created — save the key value, it will not be shown again', type: ApiKeyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  async createInstanceApiKey(
    @Req() req: Request,
    @Param('name') name: string,
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    if (
      (dto.permissions && dto.permissions.length > 0) ||
      dto.permissionsTemplate
    ) {
      throw new HttpException(
        'Instance-scoped API keys do not support account-scope permission templates',
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = (req['user'] as JwtPayload).sub;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    const result = await this.apiKeyService.createInstanceKey(userId, name, dto.name, expiresAt);
    return {
      id: result.id,
      name: result.name,
      prefix: result.prefix,
      key: result.key,
      expiresAt: result.expiresAt ?? undefined,
      enabled: result.enabled,
      createdAt: result.createdAt,
      lastUsedAt: result.lastUsedAt ?? undefined,
    };
  }

  @Get(':name/apikeys')
  @ApiOperation({ summary: 'List API keys scoped to this instance' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiResponse({ status: 200, description: 'List of instance-scoped keys', type: [ApiKeyResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  async listInstanceApiKeys(
    @Req() req: Request,
    @Param('name') name: string,
  ): Promise<ApiKeyResponseDto[]> {
    const userId = (req['user'] as JwtPayload).sub;
    const keys = await this.apiKeyService.listInstanceKeys(userId, name);
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      expiresAt: k.expiresAt ?? undefined,
      enabled: k.enabled,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? undefined,
    }));
  }

  @Delete(':name/apikeys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an instance-scoped API key' })
  @ApiParam({ name: 'name', description: 'Instance name', example: 'my-instance' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({ status: 204, description: 'Key revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  async revokeInstanceApiKey(
    @Req() req: Request,
    @Param('name') _name: string,
    @Param('id') id: string,
  ): Promise<void> {
    const userId = (req['user'] as JwtPayload).sub;
    await this.apiKeyService.revokeKey(userId, id);
  }
}
