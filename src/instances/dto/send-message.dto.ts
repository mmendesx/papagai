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
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096, { message: 'O texto não pode exceder 4096 caracteres' })
  body!: string;
}

export class MediaDto {
  @IsUrl()
  link!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

export class AudioDto {
  @IsUrl()
  link!: string;

  @IsOptional()
  @IsBoolean()
  ptt?: boolean;
}

export class DocumentDto {
  @IsUrl()
  link!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

export class StickerDto {
  @IsUrl()
  link!: string;
}

export class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class ReactionDto {
  @IsString()
  @IsNotEmpty()
  message_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  emoji!: string;
}

export class InteractiveDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  action?: any;

  @IsOptional()
  body?: any;

  @IsOptional()
  footer?: any;

  @IsOptional()
  header?: any;
}

export class MetaMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'to é obrigatório' })
  to!: string;

  @IsEnum(MessageType)
  type!: MessageType;

  @IsOptional()
  @IsString()
  messaging_product?: string;

  @IsOptional()
  @IsString()
  mimetype?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TextBodyDto)
  text?: TextBodyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDto)
  image?: MediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDto)
  video?: MediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudioDto)
  audio?: AudioDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentDto)
  document?: DocumentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StickerDto)
  sticker?: StickerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReactionDto)
  reaction?: ReactionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InteractiveDto)
  interactive?: InteractiveDto;

  @IsOptional()
  contacts?: any[];
}
