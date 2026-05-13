import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto.js';
import { JwtPayload } from './guards/jwt-auth.guard.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';
import { AnyAuthGuard } from './guards/any-auth.guard.js';
import { ApiKeyService } from './api-key.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { ApiKeyResponseDto } from './dto/api-key-response.dto.js';
import { ApiKeyTemplateListResponseDto } from './dto/api-key-template-response.dto.js';
import {
  AccountApiKeyPermission,
  AccountApiKeyTemplateId,
  listAccountApiKeyPermissionTemplates,
  resolvePermissionsTemplate,
} from './api-key-permissions.js';

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive a JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  async me(@Req() req: Request & { user: JwtPayload }) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post('apikeys')
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: 'Create an account-scoped API key' })
  @ApiResponse({
    status: 201,
    description: 'Key created — save the key value, it will not be shown again',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createApiKey(
    @Req() req: Request & { user: { sub: string } },
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    if (dto.permissions && dto.permissionsTemplate) {
      throw new BadRequestException(
        'Provide either permissions or permissionsTemplate, not both',
      );
    }

    const templatePermissions = dto.permissionsTemplate
      ? resolvePermissionsTemplate(dto.permissionsTemplate)
      : resolvePermissionsTemplate(AccountApiKeyTemplateId.INSTANCE_MANAGER);

    const finalPermissions = dto.permissions ?? templatePermissions ?? [];

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    const result = await this.apiKeyService.createAccountKey(
      req.user.sub,
      dto.name,
      expiresAt,
      finalPermissions,
    );
    return {
      id: result.id,
      name: result.name,
      prefix: result.prefix,
      key: result.key,
      expiresAt: result.expiresAt ?? undefined,
      enabled: result.enabled,
      createdAt: result.createdAt,
      lastUsedAt: result.lastUsedAt ?? undefined,
      permissions:
        (result.permissions as AccountApiKeyPermission[]) ?? undefined,
    };
  }

  @Get('apikeys/templates')
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiSecurity('apiKey')
  @ApiOperation({
    summary: 'List default permission templates for account-scoped API keys',
  })
  @ApiOkResponse({
    description: 'Default templates',
    type: ApiKeyTemplateListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getApiKeyTemplates() {
    return { templates: listAccountApiKeyPermissionTemplates() };
  }

  @Get('apikeys')
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: 'List account-scoped API keys' })
  @ApiResponse({
    status: 200,
    description: 'List of keys (no plaintext key values)',
    type: [ApiKeyResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listApiKeys(
    @Req() req: Request & { user: { sub: string } },
  ): Promise<ApiKeyResponseDto[]> {
    const keys = await this.apiKeyService.listAccountKeys(req.user.sub);
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      expiresAt: k.expiresAt ?? undefined,
      enabled: k.enabled,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? undefined,
      permissions: (k.permissions as AccountApiKeyPermission[]) ?? undefined,
    }));
  }

  @Delete('apikeys/:id')
  @UseGuards(AnyAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({ status: 204, description: 'Key revoked' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeApiKey(
    @Req() req: Request & { user: { sub: string } },
    @Param('id') id: string,
  ): Promise<void> {
    await this.apiKeyService.revokeKey(req.user.sub, id);
  }
}
