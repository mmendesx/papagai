import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WbaWebhookService } from './wba-webhook.service.js';

@ApiTags('WBA Webhook')
@Controller('api/wba/webhook')
export class WbaWebhookController {
  constructor(private readonly webhookService: WbaWebhookService) {}

  @ApiOperation({ summary: 'Verify Meta webhook subscription challenge' })
  @ApiQuery({ name: 'hub.mode', required: true, type: String })
  @ApiQuery({ name: 'hub.verify_token', required: true, type: String })
  @ApiQuery({ name: 'hub.challenge', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Webhook challenge accepted' })
  @ApiResponse({ status: 403, description: 'Invalid verify token' })
  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    return this.webhookService.verifyChallenge(mode, verifyToken, challenge);
  }

  @ApiOperation({ summary: 'Ingest Meta webhook payloads for WBA instances' })
  @ApiResponse({ status: 200, description: 'Webhook payload accepted' })
  @ApiResponse({ status: 403, description: 'Invalid webhook signature' })
  @HttpCode(HttpStatus.OK)
  @Post()
  ingest(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, any>,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    return this.webhookService.ingestWebhook(body, rawBody, signature);
  }
}
