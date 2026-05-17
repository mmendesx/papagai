import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccountApiKeyPermission,
  ACCOUNT_API_KEY_PERMISSIONS,
} from '../api-key-permissions.js';

export class ApiKeyResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'My integration' })
  name: string;

  @ApiProperty({
    example: 'ppg_acct_7x',
    description: 'First 12 characters of the key for identification',
  })
  prefix: string;

  @ApiPropertyOptional({
    example: 'ppg_acct_7xKqR3mNpL9vBsYtFgHjWcEu',
    description:
      'Full key — only present immediately after creation, never returned again',
  })
  key?: string;

  @ApiPropertyOptional({
    example: 42,
    description:
      'Instance ID this key is scoped to. Null for account-scoped keys.',
    nullable: true,
  })
  instanceId?: number | null;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  expiresAt?: Date;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2026-04-10T08:30:00.000Z' })
  lastUsedAt?: Date;

  @ApiPropertyOptional({
    isArray: true,
    enum: ACCOUNT_API_KEY_PERMISSIONS,
    description:
      'Permissions for account-scoped keys. Omitted/null means full account access.',
  })
  permissions?: AccountApiKeyPermission[];
}
