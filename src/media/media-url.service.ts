import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_MEDIA_URL_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class MediaUrlService {
  constructor(private readonly configService: ConfigService) {}

  signPath(path: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const signature = this.createSignature(path, expires);

    return `${this.baseUrl}${path}?expires=${expires}&signature=${signature}`;
  }

  isSignedMediaUrl(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    if (parsed.origin !== new URL(this.baseUrl).origin) {
      return false;
    }

    if (
      !parsed.pathname.startsWith('/media/') &&
      !parsed.pathname.startsWith('/uploads/')
    ) {
      return false;
    }

    try {
      this.verifyPath(
        parsed.pathname,
        parsed.searchParams.get('expires') ?? '',
        parsed.searchParams.get('signature') ?? '',
      );
      return true;
    } catch {
      return false;
    }
  }

  verifyPath(path: string, expires: string, signature: string): void {
    if (!expires || !signature) {
      throw new BadRequestException('Missing media URL signature');
    }

    const expiresAt = Number(expires);
    if (!Number.isInteger(expiresAt)) {
      throw new BadRequestException('Invalid media URL expiry');
    }

    if (expiresAt < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('Media URL has expired');
    }

    const expected = this.createSignature(path, expiresAt);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new ForbiddenException('Invalid media URL signature');
    }
  }

  private get ttlSeconds(): number {
    return parseInt(
      process.env.MEDIA_URL_TTL_SECONDS ?? `${DEFAULT_MEDIA_URL_TTL_SECONDS}`,
      10,
    );
  }

  private get baseUrl(): string {
    return (
      process.env.BASE_URL ??
      `http://localhost:${process.env.PORT ?? this.configService.get<number>('port', 3000)}`
    );
  }

  private createSignature(path: string, expires: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${path}:${expires}`)
      .digest('hex');
  }

  private get signingSecret(): string {
    return [
      this.configService.get<string>('jwtSecret', ''),
      this.configService.get<string>('appKey', ''),
    ]
      .filter(Boolean)
      .join(':');
  }
}
