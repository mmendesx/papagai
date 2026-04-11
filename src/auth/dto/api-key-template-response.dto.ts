import { ApiProperty } from '@nestjs/swagger';
import {
  AccountApiKeyPermission,
  ACCOUNT_API_KEY_PERMISSIONS,
  AccountApiKeyTemplateId,
  ACCOUNT_API_KEY_TEMPLATE_IDS,
} from '../api-key-permissions.js';

export class ApiKeyTemplateItemResponseDto {
  @ApiProperty({
    enum: ACCOUNT_API_KEY_TEMPLATE_IDS,
    enumName: 'AccountApiKeyTemplateId',
    example: AccountApiKeyTemplateId.READ_ONLY,
    description: 'Default permission template identifier.',
  })
  id: AccountApiKeyTemplateId;

  @ApiProperty({ example: 'Read-only' })
  name: string;

  @ApiProperty({
    example:
      'Can read profile, instances, status, contacts, chats, metrics, and events.',
  })
  description: string;

  @ApiProperty({
    isArray: true,
    enum: ACCOUNT_API_KEY_PERMISSIONS,
    enumName: 'AccountApiKeyPermission',
    description: 'Permission keys granted by this template.',
  })
  permissions: AccountApiKeyPermission[];
}

export class ApiKeyTemplateListResponseDto {
  @ApiProperty({
    type: [ApiKeyTemplateItemResponseDto],
    description: 'Default permission templates for account-scoped API keys.',
  })
  templates: ApiKeyTemplateItemResponseDto[];
}