import { ApiProperty } from '@nestjs/swagger';

export class MessageResultResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the message was sent successfully',
  })
  success: boolean;

  @ApiProperty({
    example: 'BAE5A7B2B5E2491F',
    description: 'WhatsApp message ID',
  })
  messageId: string;
}
