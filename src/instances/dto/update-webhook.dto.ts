import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWebhookDto {
  @ApiPropertyOptional({
    example: 'https://myapp.com/hook',
    description: 'Webhook endpoint URL',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @ApiPropertyOptional({
    example: { Authorization: 'Bearer token' },
    description: 'Custom HTTP headers',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable webhook delivery',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: ['message', 'disconnected'],
    type: [String],
    enum: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];
}
