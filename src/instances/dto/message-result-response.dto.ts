import { ApiProperty } from '@nestjs/swagger';

export class MessageContactResponseDto {
  @ApiProperty({ example: '5511999999999' })
  input!: string;

  @ApiProperty({ example: '5511999999999' })
  wa_id!: string;
}

export class MessageIdResponseDto {
  @ApiProperty({ example: 'BAE5A7B2B5E2491F' })
  id!: string;
}

export class MessageResultResponseDto {
  @ApiProperty({
    example: 'whatsapp',
    description: 'Messaging product identifier',
  })
  messaging_product!: string;

  @ApiProperty({
    type: () => [MessageContactResponseDto],
    description: 'Resolved recipient contact',
  })
  contacts!: MessageContactResponseDto[];

  @ApiProperty({
    type: () => [MessageIdResponseDto],
    description: 'Sent message identifiers',
  })
  messages!: MessageIdResponseDto[];
}
