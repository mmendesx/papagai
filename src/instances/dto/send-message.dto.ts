import { IsString, IsOptional } from 'class-validator';

export class MetaMessageDto {
  @IsString()
  to!: string;

  @IsString()
  type!: string;

  @IsOptional()
  messaging_product?: string;

  @IsOptional()
  text?: any;

  @IsOptional()
  image?: any;

  @IsOptional()
  audio?: any;

  @IsOptional()
  video?: any;

  @IsOptional()
  document?: any;

  @IsOptional()
  sticker?: any;

  @IsOptional()
  location?: any;

  @IsOptional()
  contacts?: any;

  @IsOptional()
  reaction?: any;

  @IsOptional()
  interactive?: any;


}
