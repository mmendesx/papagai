import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountApiKeyPermission } from './api-key-permissions.js';

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Key generation helpers ──────────────────────────────────────────────

  private generateRawKey(scope: 'acct' | 'inst'): string {
    // 24 random bytes → hex (48 chars) → first 32 chars as suffix
    const suffix = randomBytes(24).toString('hex').slice(0, 32);
    return `ppg_${scope}_${suffix}`;
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private buildPrefix(rawKey: string): string {
    return rawKey.slice(0, 12); // e.g. "ppg_acct_7xKq"
  }

  // ── Account-scoped key management ──────────────────────────────────────

  async createAccountKey(
    userId: string,
    name: string,
    expiresAt?: Date,
    permissions?: AccountApiKeyPermission[],
  ) {
    const rawKey = this.generateRawKey('acct');
    const keyHash = this.hashKey(rawKey);
    const prefix = this.buildPrefix(rawKey);

    const key = await this.prisma.apiKey.create({
      data: {
        userId,
        instanceId: null,
        name,
        prefix,
        keyHash,
        enabled: true,
        expiresAt: expiresAt ?? null,
        permissions: permissions ?? [],
      },
      select: {
        id: true,
        userId: true,
        instanceId: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        permissions: true,
        createdAt: true,
        // keyHash intentionally excluded
      },
    });

    return { ...key, key: rawKey };
  }

  listAccountKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, instanceId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        permissions: true,
        createdAt: true,
        // keyHash intentionally excluded
      },
    });
  }

  async revokeKey(userId: string, keyId: string): Promise<void> {
    const result = await this.prisma.apiKey.deleteMany({
      where: { id: keyId, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('API key not found');
    }
  }

  // ── Instance-scoped key management ─────────────────────────────────────

  async createInstanceKey(
    userId: string,
    instanceName: string,
    name: string,
    expiresAt?: Date,
  ) {
    const instance = await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name: instanceName } },
      select: { id: true },
    });
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    const rawKey = this.generateRawKey('inst');
    const keyHash = this.hashKey(rawKey);
    const prefix = this.buildPrefix(rawKey);

    const key = await this.prisma.apiKey.create({
      data: {
        userId,
        instanceId: instance.id,
        name,
        prefix,
        keyHash,
        enabled: true,
        expiresAt: expiresAt ?? null,
        permissions: [],
      },
      select: {
        id: true,
        userId: true,
        instanceId: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        permissions: true,
        createdAt: true,
        // keyHash intentionally excluded
      },
    });

    return { ...key, key: rawKey };
  }

  async listInstanceKeys(userId: string, instanceName: string) {
    const instance = await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name: instanceName } },
      select: { id: true },
    });
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    return this.prisma.apiKey.findMany({
      where: { userId, instanceId: instance.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        // keyHash intentionally excluded
      },
    });
  }

  // ── Key validation (used by ApiKeyAuthGuard) ────────────────────────────

  async validateKey(rawKey: string): Promise<{
    userId: string;
    instanceId: number | null;
    keyId: string;
    permissions: AccountApiKeyPermission[] | null;
  }> {
    const keyHash = this.hashKey(rawKey);

    // Timing-safe lookup: hash first, then find by hash
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        userId: true,
        instanceId: true,
        enabled: true,
        expiresAt: true,
        permissions: true,
      },
    });

    if (!key || !key.enabled) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      // Disable the expired key asynchronously (no await)
      void this.prisma.apiKey.update({
        where: { id: key.id },
        data: { enabled: false },
      });
      throw new UnauthorizedException('API key has expired');
    }

    // Fire-and-forget lastUsedAt update — does not block the request
    void this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: key.userId,
      instanceId: key.instanceId,
      keyId: key.id,
      permissions:
        (key.permissions as AccountApiKeyPermission[] | null) ?? null,
    };
  }

  // ── Instance scope check (used by ApiKeyAuthGuard) ─────────────────────

  async instanceMatchesKey(
    userId: string,
    instanceName: string,
    keyInstanceId: number,
  ): Promise<boolean> {
    const instance = await this.prisma.instanceConfig.findUnique({
      where: { userId_name: { userId, name: instanceName } },
      select: { id: true },
    });
    return instance?.id === keyInstanceId;
  }
}
