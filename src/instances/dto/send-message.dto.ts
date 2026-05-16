import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsUrl,
  IsBoolean,
  IsNumber,
  IsBase64,
  IsArray,
  IsDefined,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ValidateIf,
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
  template = 'template',
}

export class TextBodyDto {
  @ApiProperty({ example: 'Hello from Papagai!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096, { message: 'O texto não pode exceder 4096 caracteres' })
  body!: string;
}

export class MediaDto {
  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @ValidateIf((o) => !o.data)
  @IsNotEmpty({ message: 'link or data is required' })
  @IsUrl({ require_tld: false, require_protocol: true })
  link?: string;

  @ApiPropertyOptional({ example: '<base64-encoded-content>' })
  @IsOptional()
  @IsString()
  @IsBase64()
  @MaxLength(22_369_622)
  data?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @ValidateIf((o) => Boolean(o.data))
  @IsNotEmpty({ message: 'mimetype is required when data is provided' })
  @IsString()
  @MaxLength(128)
  mimetype?: string;

  @ApiPropertyOptional({ example: 'Check this out!' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

export class AudioDto {
  @ApiPropertyOptional({ example: 'https://example.com/audio.mp3' })
  @ValidateIf((o) => !o.data)
  @IsNotEmpty({ message: 'link or data is required' })
  @IsUrl({ require_tld: false, require_protocol: true })
  link?: string;

  @ApiPropertyOptional({ example: '<base64-encoded-content>' })
  @IsOptional()
  @IsString()
  @IsBase64()
  @MaxLength(22_369_622)
  data?: string;

  @ApiPropertyOptional({ example: 'audio/mpeg' })
  @ValidateIf((o) => Boolean(o.data))
  @IsNotEmpty({ message: 'mimetype is required when data is provided' })
  @IsString()
  @MaxLength(128)
  mimetype?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Send as push-to-talk (voice note)',
  })
  @IsOptional()
  @IsBoolean()
  ptt?: boolean;
}

export class DocumentDto {
  @ApiPropertyOptional({ example: 'https://example.com/doc.pdf' })
  @ValidateIf((o) => !o.data)
  @IsNotEmpty({ message: 'link or data is required' })
  @IsUrl({ require_tld: false, require_protocol: true })
  link?: string;

  @ApiPropertyOptional({ example: '<base64-encoded-content>' })
  @IsOptional()
  @IsString()
  @IsBase64()
  @MaxLength(22_369_622)
  data?: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @ValidateIf((o) => Boolean(o.data))
  @IsNotEmpty({ message: 'mimetype is required when data is provided' })
  @IsString()
  @MaxLength(128)
  mimetype?: string;

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
  @ApiPropertyOptional({ example: 'https://example.com/sticker.webp' })
  @ValidateIf((o) => !o.data)
  @IsNotEmpty({ message: 'link or data is required' })
  @IsUrl({ require_tld: false, require_protocol: true })
  link?: string;

  @ApiPropertyOptional({ example: '<base64-encoded-content>' })
  @IsOptional()
  @IsString()
  @IsBase64()
  @MaxLength(22_369_622)
  data?: string;

  @ApiPropertyOptional({ example: 'image/webp' })
  @ValidateIf((o) => Boolean(o.data))
  @IsNotEmpty({ message: 'mimetype is required when data is provided' })
  @IsString()
  @MaxLength(128)
  mimetype?: string;
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

export class TemplateLanguageDto {
  @ApiProperty({ example: 'pt_BR' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class TemplateDto {
  @ApiProperty({ example: 'hello_world' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ type: () => TemplateLanguageDto })
  @ValidateNested()
  @Type(() => TemplateLanguageDto)
  language!: TemplateLanguageDto;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  components?: any[];
}

export class MetaMessageDto {
  @ApiProperty({
    example: '5511999999999',
    description: 'Recipient phone number without + prefix',
  })
  @IsString()
  @IsNotEmpty({ message: 'to é obrigatório' })
  to!: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.text,
    description: 'Message type',
  })
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

  @ApiPropertyOptional({
    type: () => TextBodyDto,
    description: 'Required when type=text',
  })
  @ValidateIf((o) => o.type === MessageType.text)
  @IsDefined()
  @ValidateNested()
  @Type(() => TextBodyDto)
  text?: TextBodyDto;

  @ApiPropertyOptional({
    type: () => MediaDto,
    description: 'Required when type=image',
  })
  @ValidateIf((o) => o.type === MessageType.image)
  @IsDefined()
  @ValidateNested()
  @Type(() => MediaDto)
  image?: MediaDto;

  @ApiPropertyOptional({
    type: () => MediaDto,
    description: 'Required when type=video',
  })
  @ValidateIf((o) => o.type === MessageType.video)
  @IsDefined()
  @ValidateNested()
  @Type(() => MediaDto)
  video?: MediaDto;

  @ApiPropertyOptional({
    type: () => AudioDto,
    description: 'Required when type=audio',
  })
  @ValidateIf((o) => o.type === MessageType.audio)
  @IsDefined()
  @ValidateNested()
  @Type(() => AudioDto)
  audio?: AudioDto;

  @ApiPropertyOptional({
    type: () => DocumentDto,
    description: 'Required when type=document',
  })
  @ValidateIf((o) => o.type === MessageType.document)
  @IsDefined()
  @ValidateNested()
  @Type(() => DocumentDto)
  document?: DocumentDto;

  @ApiPropertyOptional({
    type: () => StickerDto,
    description: 'Required when type=sticker',
  })
  @ValidateIf((o) => o.type === MessageType.sticker)
  @IsDefined()
  @ValidateNested()
  @Type(() => StickerDto)
  sticker?: StickerDto;

  @ApiPropertyOptional({
    type: () => LocationDto,
    description: 'Required when type=location',
  })
  @ValidateIf((o) => o.type === MessageType.location)
  @IsDefined()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    type: () => ReactionDto,
    description: 'Required when type=reaction',
  })
  @ValidateIf((o) => o.type === MessageType.reaction)
  @IsDefined()
  @ValidateNested()
  @Type(() => ReactionDto)
  reaction?: ReactionDto;

  @ApiPropertyOptional({
    type: () => InteractiveDto,
    description: 'Required when type=interactive',
  })
  @ValidateIf((o) => o.type === MessageType.interactive)
  @IsDefined()
  @ValidateNested()
  @Type(() => InteractiveDto)
  interactive?: InteractiveDto;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    description: 'Required when type=contacts',
  })
  @ValidateIf((o) => o.type === MessageType.contacts)
  @IsDefined()
  @IsArray()
  contacts?: any[];

  @ApiPropertyOptional({
    type: () => TemplateDto,
    description: 'Required when type=template',
  })
  @ValidateIf((o) => o.type === MessageType.template)
  @IsDefined()
  @ValidateNested()
  @Type(() => TemplateDto)
  template?: TemplateDto;
}
