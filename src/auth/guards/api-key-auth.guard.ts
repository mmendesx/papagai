import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '../api-key.service.js';
import { resolveAccountPermissionForRequest } from '../api-key-permissions.js';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const rawKey = req.headers['x-api-key'] as string | undefined;

    if (!rawKey) {
      throw new UnauthorizedException();
    }

    const result = await this.apiKeyService.validateKey(rawKey);

    // Instance-scope enforcement: if the key is instance-scoped,
    // the request must target a named instance and that instance must match.
    if (result.instanceId !== null) {
      const instanceName = req.params['name'] as string | undefined;
      if (!instanceName) {
        throw new ForbiddenException(
          'Instance-scoped API key cannot access account-level routes',
        );
      }

      const matches = await this.apiKeyService.instanceMatchesKey(
        result.userId,
        instanceName,
        result.instanceId,
      );
      if (!matches) {
        throw new ForbiddenException(
          'API key is not authorized for this instance',
        );
      }
    } else if (result.permissions !== null) {
      // Null permissions means legacy/full account access.
      // A non-null list means explicit allowlist and must pass route mapping.
      const requiredPermission = resolveAccountPermissionForRequest(req);
      if (
        !requiredPermission ||
        !result.permissions.includes(requiredPermission)
      ) {
        throw new ForbiddenException(
          'API key is not authorized for this endpoint',
        );
      }
    }

    req['user'] = {
      sub: result.userId,
      authType: 'api_key',
      keyId: result.keyId,
      permissions: result.permissions,
    };
    return true;
  }
}
