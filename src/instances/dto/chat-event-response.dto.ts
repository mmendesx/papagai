import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatEventResponseDto {
  @ApiProperty({
    enum: ['chat_updated', 'chat_read', 'history_synced', 'heartbeat'],
    example: 'chat_updated',
  })
  type!: string;

  @ApiProperty({ example: 1710000000000 })
  timestamp!: number;

  @ApiPropertyOptional({ example: '5511999999999@s.whatsapp.net' })
  chatId?: string;

  @ApiPropertyOptional({ enum: ['incoming', 'outgoing'], example: 'incoming' })
  source?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Current chat summary for chat events',
  })
  chat?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Most recent stored message for chat update events',
  })
  message?: Record<string, unknown>;
}
