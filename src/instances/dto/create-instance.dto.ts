import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInstanceDto {
  @ApiProperty({ example: 'my-whatsapp', description: 'Unique identifier for the instance. Only letters, numbers, _ and - allowed.' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Nome da instância inválido: use apenas letras, números, _ e -',
  })
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional({ example: 'https://myapp.com/webhook', description: 'URL to receive webhook events' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhook?: string;

  @ApiPropertyOptional({ example: { 'x-secret': 'abc123' }, description: 'Custom HTTP headers sent with each webhook request', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;

  @ApiPropertyOptional({ example: true, default: false, description: 'Whether to send webhook events' })
  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @ApiPropertyOptional({ example: ['message', 'connected'], description: 'Webhook events to subscribe to', type: [String], enum: ['message', 'message_update', 'qr', 'connected', 'disconnected'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEvents?: string[];
}
