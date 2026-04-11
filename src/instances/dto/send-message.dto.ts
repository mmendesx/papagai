import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsUrl,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MessageType {
  text = 'text',
  image = 'image',
  audio = 'audio',
  video = 'video',
  document = 'document',
  sticker = 'sticker',
  location = 'location',
  reaction = 'reaction',
  interactive = 'interactive',
  contacts = 'contacts',
}

export class TextBodyDto {
  @ApiProperty({ example: 'Hello from Papagai!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096, { message: 'O texto não pode exceder 4096 caracteres' })
  body!: string;
}

export class MediaDto {
  @ApiProperty({ example: 'https://example.com/image.jpg' })
  @IsUrl()
  link!: string;

  @ApiPropertyOptional({ example: 'Check this out!' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

export class AudioDto {
  @ApiProperty({ example: 'https://example.com/audio.mp3' })
  @IsUrl()
  link!: string;

  @ApiPropertyOptional({ example: false, description: 'Send as push-to-talk (voice note)' })
  @IsOptional()
  @IsBoolean()
  ptt?: boolean;
}

export class DocumentDto {
  @ApiProperty({ example: 'https://example.com/doc.pdf' })
  @IsUrl()
  link!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @ApiPropertyOptional({ example: 'report.pdf' })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class StickerDto {
  @ApiProperty({ example: 'https://example.com/sticker.webp' })
  @IsUrl()
  link!: string;
}

export class LocationDto {
  @ApiProperty({ example: -23.5505 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -46.6333 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class ReactionDto {
  @ApiProperty({ example: 'BAE5...' })
  @IsString()
  @IsNotEmpty()
  message_id!: string;

  @ApiProperty({ example: '👍' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  emoji!: string;
}

export class InteractiveDto {
  @ApiProperty({ example: 'button' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  action?: any;

  @ApiPropertyOptional()
  @IsOptional()
  body?: any;

  @ApiPropertyOptional()
  @IsOptional()
  footer?: any;

  @ApiPropertyOptional()
  @IsOptional()
  header?: any;
}

export class MetaMessageDto {
  @ApiProperty({ example: '5511999999999', description: 'Recipient phone number without + prefix' })
  @IsString()
  @IsNotEmpty({ message: 'to é obrigatório' })
  to!: string;

  @ApiProperty({ enum: MessageType, example: MessageType.text, description: 'Message type' })
  @IsEnum(MessageType)
  type!: MessageType;

  @ApiPropertyOptional({ example: 'whatsapp', default: 'whatsapp' })
  @IsOptional()
  @IsString()
  messaging_product?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimetype?: string;

  @ApiPropertyOptional({ type: () => TextBodyDto, description: 'Required when type=text' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TextBodyDto)
  text?: TextBodyDto;

  @ApiPropertyOptional({ type: () => MediaDto, description: 'Required when type=image' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDto)
  image?: MediaDto;

  @ApiPropertyOptional({ type: () => MediaDto, description: 'Required when type=video' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDto)
  video?: MediaDto;

  @ApiPropertyOptional({ type: () => AudioDto, description: 'Required when type=audio' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AudioDto)
  audio?: AudioDto;

  @ApiPropertyOptional({ type: () => DocumentDto, description: 'Required when type=document' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentDto)
  document?: DocumentDto;

  @ApiPropertyOptional({ type: () => StickerDto, description: 'Required when type=sticker' })
  @IsOptional()
  @ValidateNested()
  @Type(() => StickerDto)
  sticker?: StickerDto;

  @ApiPropertyOptional({ type: () => LocationDto, description: 'Required when type=location' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({ type: () => ReactionDto, description: 'Required when type=reaction' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReactionDto)
  reaction?: ReactionDto;

  @ApiPropertyOptional({ type: () => InteractiveDto, description: 'Required when type=interactive' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InteractiveDto)
  interactive?: InteractiveDto;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' }, description: 'Required when type=contacts' })
  @IsOptional()
  contacts?: any[];
}
