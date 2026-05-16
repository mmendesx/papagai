import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ENCRYPTION_VERSION = 'v1';
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

@Injectable()
export class WbaCredentialsService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(AES_GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      ENCRYPTION_VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(cipherText: string): string {
    const key = this.getEncryptionKey();
    const [version, ivB64, tagB64, bodyB64] = cipherText.split(':');
    if (version !== ENCRYPTION_VERSION || !ivB64 || !tagB64 || !bodyB64) {
      throw new Error('Invalid encrypted WBA credential format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(bodyB64, 'base64');
    if (
      iv.length !== AES_GCM_IV_BYTES ||
      authTag.length !== AES_GCM_TAG_BYTES
    ) {
      throw new Error('Invalid encrypted WBA credential payload');
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  }

  redact(value?: string | null): string | undefined {
    if (!value) return undefined;
    return '***redacted***';
  }

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get<string>('wbaCredentialsSecret', '');
    if (!secret || secret.trim().length < 16) {
      throw new Error(
        'WBA credential encryption secret is not configured. Set WBA_CREDENTIALS_SECRET or APP_KEY.',
      );
    }
    return createHash('sha256').update(secret).digest();
  }
}
