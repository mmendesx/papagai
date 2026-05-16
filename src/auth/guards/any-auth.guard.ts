import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ApiKeyAuthGuard } from './api-key-auth.guard.js';

function isEvolutionCompatRequest(req: Request): boolean {
  return (
    req.method === 'GET' &&
    /^\/chat\/getBase64FromMediaMessage\/[^/]+$/.test(req.path)
  );
}

@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const alias = req.headers['apikey'];
    if (
      isEvolutionCompatRequest(req) &&
      typeof alias === 'string' &&
      !req.headers['x-api-key']
    ) {
      req.headers['x-api-key'] = alias;
    }

    if (req.headers['x-api-key']) {
      // Throws UnauthorizedException / ForbiddenException on failure
      return this.apiKeyGuard.canActivate(context);
    }

    // Falls back to JWT — throws UnauthorizedException if missing/invalid
    return this.jwtGuard.canActivate(context);
  }
}
