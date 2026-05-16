import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstanceCapabilitiesDto {
  @ApiProperty({ example: true })
  qr!: boolean;

  @ApiProperty({ example: true })
  sendMessages!: boolean;

  @ApiProperty({ example: true })
  receiveMessages!: boolean;

  @ApiProperty({ example: false })
  chatHistorySync!: boolean;

  @ApiProperty({ example: false })
  contactLookup!: boolean;

  @ApiProperty({ example: false })
  markRead!: boolean;

  @ApiProperty({ example: true })
  templates!: boolean;
}

export class WbaStatusDto {
  @ApiPropertyOptional({ example: '123456789012345' })
  phoneNumberId?: string | null;

  @ApiPropertyOptional({ example: '2233445566778899' })
  businessAccountId?: string | null;

  @ApiPropertyOptional({ example: '+55 11 99999-9999' })
  displayPhoneNumber?: string | null;

  @ApiPropertyOptional({ example: '2026-05-15T12:10:00.000Z' })
  webhookConfiguredAt?: string | null;

  @ApiPropertyOptional({ example: '2026-05-15T12:12:00.000Z' })
  lastHealthCheckAt?: string | null;

  @ApiPropertyOptional({ example: 'healthy' })
  lastHealthCheckStatus?: string | null;

  @ApiProperty({ example: true })
  appSecretConfigured!: boolean;
}

export class InstanceStatusResponseDto {
  @ApiProperty({ example: 'my-whatsapp', description: 'Instance name' })
  name: string;

  @ApiProperty({
    example: 'web',
    enum: ['web', 'wba'],
    description: 'Instance provider',
  })
  provider!: 'web' | 'wba';

  @ApiProperty({ type: () => InstanceCapabilitiesDto })
  capabilities!: InstanceCapabilitiesDto;

  @ApiProperty({
    example: 'connected',
    enum: ['connected', 'disconnected', 'connecting', 'qr_required'],
    description: 'Current connection status',
  })
  status?: string;

  @ApiProperty({ example: true })
  connected?: boolean;

  @ApiPropertyOptional({ example: '2026-05-15T12:00:00.000Z' })
  startTime?: string;

  @ApiPropertyOptional({ example: 12000 })
  uptime?: number;

  @ApiPropertyOptional({ example: '+5511999999999' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    type: 'object',
    description: 'Current webhook configuration',
    additionalProperties: true,
  })
  webhook?: {
    url: string | null;
    headers: Record<string, string>;
    enabled: boolean;
    events: string[];
  };

  @ApiPropertyOptional({ type: () => WbaStatusDto })
  wba?: WbaStatusDto;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgo...',
    description: 'QR code as base64 data URL, present when status=qr_required',
  })
  qr?: string;
}
