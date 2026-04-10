import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AuthThrottlerGuard.name);

  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: 429,
        message: 'Muitas tentativas. Tente novamente em alguns instantes.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        throw error;
      }
      this.logger.warn(`AuthThrottlerGuard failed open: ${error instanceof Error ? error.message : String(error)}`);
      return true;
    }
  }
}
