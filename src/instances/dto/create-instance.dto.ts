import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhook?: string;

  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;
}
