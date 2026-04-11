import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccountApiKeyTemplateId,
  AccountApiKeyPermission,
  ACCOUNT_API_KEY_PERMISSIONS,
  ACCOUNT_API_KEY_TEMPLATE_IDS,
} from '../api-key-permissions.js';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My integration', description: 'Human-readable label for this key' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00Z',
    description: 'Expiry date in ISO 8601 format. Omit for a key that never expires.',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({
    isArray: true,
    enum: ACCOUNT_API_KEY_PERMISSIONS,
    description:
      'Optional permissions for account-scoped keys. Omit to grant full account scope (legacy behavior).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(AccountApiKeyPermission, { each: true })
  permissions?: AccountApiKeyPermission[];

  @ApiPropertyOptional({
    enum: ACCOUNT_API_KEY_TEMPLATE_IDS,
    description:
      'Optional default permission template for account-scoped keys. Ignored if permissions is provided explicitly.',
  })
  @IsOptional()
  @IsEnum(AccountApiKeyTemplateId)
  permissionsTemplate?: AccountApiKeyTemplateId;
}
