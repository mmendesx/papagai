import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './entities/api-key.entity.js';
import { InstanceConfig } from '../instances/entities/instance-config.entity.js';
import { AccountApiKeyPermission } from './api-key-permissions.js';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(InstanceConfig)
    private readonly instanceRepo: Repository<InstanceConfig>,
  ) {}

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
  ): Promise<ApiKey & { key: string }> {
    const rawKey = this.generateRawKey('acct');
    const keyHash = this.hashKey(rawKey);
    const prefix = this.buildPrefix(rawKey);

    const record = this.apiKeyRepo.create({
      userId,
      instanceId: null,
      name,
      prefix,
      keyHash,
      enabled: true,
      expiresAt: expiresAt ?? null,
      permissions: permissions ?? null,
    });

    const saved = await this.apiKeyRepo.save(record);
    return { ...saved, key: rawKey };
  }

  async listAccountKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { userId, instanceId: IsNull() },  // only account-scoped
      order: { createdAt: 'DESC' },
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
    const key = await this.apiKeyRepo.findOne({
      where: { id: keyId, userId },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    await this.apiKeyRepo.delete(keyId);
  }

  // ── Instance-scoped key management ─────────────────────────────────────

  async createInstanceKey(
    userId: string,
    instanceName: string,
    name: string,
    expiresAt?: Date,
  ): Promise<ApiKey & { key: string }> {
    const instance = await this.instanceRepo.findOne({
      where: { userId, name: instanceName },
    });
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    const rawKey = this.generateRawKey('inst');
    const keyHash = this.hashKey(rawKey);
    const prefix = this.buildPrefix(rawKey);

    const record = this.apiKeyRepo.create({
      userId,
      instanceId: instance.id,
      name,
      prefix,
      keyHash,
      enabled: true,
      expiresAt: expiresAt ?? null,
    });

    const saved = await this.apiKeyRepo.save(record);
    return { ...saved, key: rawKey };
  }

  async listInstanceKeys(
    userId: string,
    instanceName: string,
  ): Promise<ApiKey[]> {
    const instance = await this.instanceRepo.findOne({
      where: { userId, name: instanceName },
    });
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    return this.apiKeyRepo.find({
      where: { userId, instanceId: instance.id },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  // ── Key validation (used by ApiKeyAuthGuard) ────────────────────────────

  async validateKey(
    rawKey: string,
  ): Promise<{
    userId: string;
    instanceId: number | null;
    keyId: string;
    permissions: AccountApiKeyPermission[] | null;
  }> {
    const keyHash = this.hashKey(rawKey);

    // Timing-safe lookup: hash first, then find by hash
    const key = await this.apiKeyRepo.findOne({
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
      void this.apiKeyRepo.update(key.id, { enabled: false });
      throw new UnauthorizedException('API key has expired');
    }

    // Fire-and-forget lastUsedAt update — does not block the request
    void this.apiKeyRepo.update(key.id, { lastUsedAt: new Date() });

    return {
      userId: key.userId,
      instanceId: key.instanceId,
      keyId: key.id,
      permissions: (key.permissions as AccountApiKeyPermission[] | null) ?? null,
    };
  }

  // ── Instance scope check (used by ApiKeyAuthGuard) ─────────────────────

  async instanceMatchesKey(
    userId: string,
    instanceName: string,
    keyInstanceId: number,
  ): Promise<boolean> {
    const instance = await this.instanceRepo.findOne({
      where: { userId, name: instanceName },
      select: { id: true },
    });
    return instance?.id === keyInstanceId;
  }
}
