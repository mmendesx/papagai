import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'ProviderWbaConsistency', async: false })
class ProviderWbaConsistencyValidator implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateInstanceDto;
    if (dto.provider === 'wba') {
      return dto.wba !== undefined;
    }
    return dto.wba === undefined;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateInstanceDto;
    if (dto.provider === 'wba') {
      return 'wba configuration is required when provider is wba';
    }
    return 'wba configuration must not be provided when provider is web';
  }
}

export class WbaCreateConfigDto {
  @ApiProperty({ example: '123456789012345' })
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  businessAccountId!: string;

  @ApiProperty({ example: '987654321098765' })
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  phoneNumberId!: string;

  @ApiProperty({ example: '+55 11 99999-9999' })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  displayPhoneNumber!: string;

  @ApiProperty({ example: 'EAAG...' })
  @IsString()
  @MinLength(10)
  accessToken!: string;

  @ApiPropertyOptional({ example: 'app-secret-value' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  appSecret?: string;

  @ApiPropertyOptional({ example: 'verify-token-value' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookVerifyToken?: string;
}

export class CreateInstanceDto {
  @ApiProperty({
    example: 'my-whatsapp',
    description:
      'Unique identifier for the instance. Only letters, numbers, _ and - allowed.',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Nome da instância inválido: use apenas letras, números, _ e -',
  })
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional({
    example: 'web',
    enum: ['web', 'wba'],
    default: 'web',
    description: 'Instance provider type. Defaults to web.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(web|wba)$/)
  provider: 'web' | 'wba' = 'web';

  @ApiPropertyOptional({
    type: () => WbaCreateConfigDto,
    description: 'Required when provider is wba.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WbaCreateConfigDto)
  wba?: WbaCreateConfigDto;

  @Validate(ProviderWbaConsistencyValidator)
  providerWbaConsistency!: boolean;

  @ApiPropertyOptional({
    example: 'https://myapp.com/webhook',
    description: 'URL to receive webhook events',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhook?: string;

  @ApiPropertyOptional({
    example: { 'x-secret': 'abc123' },
    description: 'Custom HTTP headers sent with each webhook request',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether to send webhook events',
  })
  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @ApiPropertyOptional({
    example: ['message', 'connected'],
    description: 'Webhook events to subscribe to',
    type: [String],
    enum: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEvents?: string[];
}
