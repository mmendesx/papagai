import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Nome da instância inválido: use apenas letras, números, _ e -',
  })
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhook?: string;

  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEvents?: string[];
}
