import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ApiKeyAuthGuard } from './api-key-auth.guard.js';

@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    if (req.headers['x-api-key']) {
      // Throws UnauthorizedException / ForbiddenException on failure
      return this.apiKeyGuard.canActivate(context);
    }

    // Falls back to JWT — throws UnauthorizedException if missing/invalid
    return this.jwtGuard.canActivate(context) as Promise<boolean>;
  }
}
