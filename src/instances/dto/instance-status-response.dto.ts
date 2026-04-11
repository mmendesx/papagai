import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstanceStatusResponseDto {
  @ApiProperty({ example: 'my-whatsapp', description: 'Instance name' })
  name: string;

  @ApiProperty({
    example: 'connected',
    enum: ['connected', 'disconnected', 'connecting', 'qr_required'],
    description: 'Current connection status',
  })
  status: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgo...',
    description: 'QR code as base64 data URL, present when status=qr_required',
  })
  qr?: string;
}
