import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GetBase64MessageKeyDto {
  @ApiProperty({ example: '3EB00C38AC4E1BA524D51E' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class GetBase64MessageDto {
  @ApiProperty({ type: GetBase64MessageKeyDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => GetBase64MessageKeyDto)
  key!: GetBase64MessageKeyDto;
}

export class GetBase64FromMediaMessageDto {
  @ApiProperty({ type: GetBase64MessageDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => GetBase64MessageDto)
  message!: GetBase64MessageDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  convertToMp4?: boolean;
}

export class GetBase64FromMediaMessageSizeDto {
  @ApiProperty({ example: 135348 })
  fileLength!: number;
}

export class GetBase64FromMediaMessageResponseDto {
  @ApiProperty({ example: 'imageMessage' })
  mediaType!: string;

  @ApiProperty({ example: '1710000000000_image.jpeg' })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimetype!: string;

  @ApiProperty({ type: GetBase64FromMediaMessageSizeDto })
  size!: GetBase64FromMediaMessageSizeDto;

  @ApiPropertyOptional({ example: 'Optional caption', nullable: true })
  caption?: string | null;

  @ApiProperty({ example: '/9j/4AAQSkZJRgABAQ...' })
  base64!: string;
}
