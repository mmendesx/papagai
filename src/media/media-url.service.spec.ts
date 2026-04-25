import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { MediaUrlService } from './media-url.service.js';

describe('MediaUrlService', () => {
  const originalBaseUrl = process.env.BASE_URL;
  const originalTtl = process.env.MEDIA_URL_TTL_SECONDS;
  let service: MediaUrlService;

  beforeEach(() => {
    process.env.BASE_URL = 'https://papagai.example.com';
    process.env.MEDIA_URL_TTL_SECONDS = '60';
    service = new MediaUrlService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'jwtSecret') return 'test-jwt-secret';
        if (key === 'appKey') return 'test-app-key';
        if (key === 'port') return 3000;
        return fallback;
      }),
    } as unknown as ConfigService);
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL;
    } else {
      process.env.BASE_URL = originalBaseUrl;
    }

    if (originalTtl === undefined) {
      delete process.env.MEDIA_URL_TTL_SECONDS;
    } else {
      process.env.MEDIA_URL_TTL_SECONDS = originalTtl;
    }
  });

  it('signs and verifies a media path', () => {
    const signed = service.signPath('/media/123_image.jpg');
    const parsed = new URL(signed);

    expect(parsed.origin).toBe('https://papagai.example.com');
    expect(() =>
      service.verifyPath(
        parsed.pathname,
        parsed.searchParams.get('expires') ?? '',
        parsed.searchParams.get('signature') ?? '',
      ),
    ).not.toThrow();
  });

  it('rejects a tampered path', () => {
    const signed = service.signPath('/media/123_image.jpg');
    const parsed = new URL(signed);

    expect(() =>
      service.verifyPath(
        '/media/other.jpg',
        parsed.searchParams.get('expires') ?? '',
        parsed.searchParams.get('signature') ?? '',
      ),
    ).toThrow(ForbiddenException);
  });

  it('only trusts signed media URLs on the configured base URL', () => {
    const signed = service.signPath('/uploads/bot/file.jpg');
    const rewritten = signed.replace(
      'https://papagai.example.com',
      'http://127.0.0.1',
    );

    expect(service.isSignedMediaUrl(signed)).toBe(true);
    expect(service.isSignedMediaUrl(rewritten)).toBe(false);
  });
});
