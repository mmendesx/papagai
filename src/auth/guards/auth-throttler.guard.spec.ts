import { AuthThrottlerGuard } from './auth-throttler.guard';
import { HttpException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

describe('AuthThrottlerGuard', () => {
  let guard: AuthThrottlerGuard;

  beforeEach(() => {
    guard = new (AuthThrottlerGuard as any)({}, {}, {});
    // mock internal properties
    (guard as any).logger = { warn: jest.fn() };
  });

  it('throwThrottlingException throws HttpException with 429', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    await expect(async () =>
      (guard as any).throwThrottlingException(),
    ).rejects.toThrow(HttpException);
    try {
      await (guard as any).throwThrottlingException();
    } catch (e) {
      expect(e.getStatus()).toBe(429);
      const body = e.getResponse();
      expect(body.statusCode).toBe(429);
      expect(body.message).toBe(
        'Muitas tentativas. Tente novamente em alguns instantes.',
      );
      expect(body.error).toBe('Too Many Requests');
    }
  });

  it('canActivate returns true when super succeeds', async () => {
    jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(true as any);
    const mockCtx = {} as ExecutionContext;
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
  });

  it('canActivate fails open when Redis throws non-429 error', async () => {
    jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockRejectedValue(new Error('ECONNREFUSED'));
    const mockCtx = {} as ExecutionContext;
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
    expect((guard as any).logger.warn).toHaveBeenCalled();
  });
});
