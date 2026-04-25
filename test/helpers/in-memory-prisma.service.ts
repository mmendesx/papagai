import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type ApiKeyRecord = {
  id: string;
  userId: string;
  instanceId: number | null;
  name: string;
  prefix: string;
  keyHash: string;
  enabled: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  permissions: string[];
  createdAt: Date;
};

type InstanceRecord = {
  id: number;
  userId: string;
  name: string;
  webhookUrl: string | null;
  webhookHeaders: Record<string, string>;
  webhookEnabled: boolean;
  webhookEvents: string[];
  createdAt: Date;
};

type SelectShape = Record<string, boolean> | undefined;

function applySelect<T extends Record<string, any>>(
  record: T,
  select?: SelectShape,
): Partial<T> {
  if (!select) {
    return { ...record };
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, record[key]]),
  ) as Partial<T>;
}

function p2002(message: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError(message, {
    code: 'P2002',
    clientVersion: 'in-memory-e2e',
  });
}

@Injectable()
export class InMemoryPrismaService {
  private users = new Map<string, UserRecord>();
  private apiKeys = new Map<string, ApiKeyRecord>();
  private instances = new Map<number, InstanceRecord>();
  private nextInstanceId = 1;

  readonly user = {
    create: ({
      data,
    }: {
      data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>;
    }) => {
      const email = data.email.toLowerCase();
      if ([...this.users.values()].some((user) => user.email === email)) {
        throw p2002('Unique constraint failed on the fields: (`email`)');
      }

      const now = new Date();
      const user: UserRecord = {
        id: randomUUID(),
        name: data.name,
        email,
        passwordHash: data.passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(user.id, user);
      return Promise.resolve({ ...user });
    },

    findUnique: ({
      where,
      select,
    }: {
      where: { id?: string; email?: string };
      select?: SelectShape;
    }) => {
      const user = where.id
        ? this.users.get(where.id)
        : [...this.users.values()].find(
            (candidate) => candidate.email === where.email,
          );
      return Promise.resolve(user ? applySelect(user, select) : null);
    },
  };

  readonly apiKey = {
    create: ({
      data,
      select,
    }: {
      data: Omit<ApiKeyRecord, 'id' | 'createdAt' | 'lastUsedAt'> & {
        lastUsedAt?: Date | null;
      };
      select?: SelectShape;
    }) => {
      const now = new Date();
      const record: ApiKeyRecord = {
        id: randomUUID(),
        userId: data.userId,
        instanceId: data.instanceId,
        name: data.name,
        prefix: data.prefix,
        keyHash: data.keyHash,
        enabled: data.enabled,
        expiresAt: data.expiresAt ?? null,
        lastUsedAt: data.lastUsedAt ?? null,
        permissions: data.permissions ?? [],
        createdAt: now,
      };
      this.apiKeys.set(record.id, record);
      return Promise.resolve(applySelect(record, select));
    },

    findMany: ({
      where,
      select,
    }: {
      where: { userId?: string; instanceId?: number | null };
      orderBy?: { createdAt?: 'asc' | 'desc' };
      select?: SelectShape;
    }) => {
      return Promise.resolve(
        [...this.apiKeys.values()]
          .filter(
            (key) => where.userId === undefined || key.userId === where.userId,
          )
          .filter((key) =>
            where.instanceId === undefined
              ? true
              : key.instanceId === where.instanceId,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((key) => applySelect(key, select)),
      );
    },

    findUnique: ({
      where,
      select,
    }: {
      where: { keyHash?: string; id?: string };
      select?: SelectShape;
    }) => {
      const key = where.id
        ? this.apiKeys.get(where.id)
        : [...this.apiKeys.values()].find(
            (candidate) => candidate.keyHash === where.keyHash,
          );
      return Promise.resolve(key ? applySelect(key, select) : null);
    },

    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<ApiKeyRecord>;
    }) => {
      const existing = this.apiKeys.get(where.id);
      if (!existing) {
        throw new Error(`API key ${where.id} not found`);
      }
      Object.assign(existing, data);
      return Promise.resolve({ ...existing });
    },

    deleteMany: ({ where }: { where: { id?: string; userId?: string } }) => {
      let count = 0;
      for (const [id, key] of this.apiKeys.entries()) {
        if (where.id !== undefined && key.id !== where.id) continue;
        if (where.userId !== undefined && key.userId !== where.userId) continue;
        this.apiKeys.delete(id);
        count++;
      }
      return Promise.resolve({ count });
    },
  };

  readonly instanceConfig = {
    findMany: () =>
      Promise.resolve(
        [...this.instances.values()].map((instance) => ({ ...instance })),
      ),

    findUnique: ({
      where,
      select,
    }: {
      where: { userId_name: { userId: string; name: string } };
      select?: SelectShape;
    }) => {
      const record = this.findInstance(
        where.userId_name.userId,
        where.userId_name.name,
      );
      return Promise.resolve(record ? applySelect(record, select) : null);
    },

    upsert: ({
      where,
      create,
      update,
    }: {
      where: { userId_name: { userId: string; name: string } };
      create: Omit<InstanceRecord, 'id' | 'createdAt'>;
      update: Partial<InstanceRecord>;
    }) => {
      const existing = this.findInstance(
        where.userId_name.userId,
        where.userId_name.name,
      );
      if (existing) {
        Object.assign(existing, update);
        return Promise.resolve({ ...existing });
      }

      const record: InstanceRecord = {
        id: this.nextInstanceId++,
        userId: create.userId,
        name: create.name,
        webhookUrl: create.webhookUrl ?? null,
        webhookHeaders: create.webhookHeaders ?? {},
        webhookEnabled: create.webhookEnabled ?? false,
        webhookEvents: create.webhookEvents ?? [],
        createdAt: new Date(),
      };
      this.instances.set(record.id, record);
      return Promise.resolve({ ...record });
    },

    updateMany: ({
      where,
      data,
    }: {
      where: { userId: string; name: string };
      data: Partial<InstanceRecord>;
    }) => {
      const existing = this.findInstance(where.userId, where.name);
      if (!existing) {
        return Promise.resolve({ count: 0 });
      }
      Object.assign(existing, data);
      return Promise.resolve({ count: 1 });
    },

    deleteMany: ({ where }: { where: { userId?: string; name?: string } }) => {
      let count = 0;
      for (const [id, instance] of this.instances.entries()) {
        if (where.userId !== undefined && instance.userId !== where.userId)
          continue;
        if (where.name !== undefined && instance.name !== where.name) continue;
        this.instances.delete(id);
        for (const [keyId, key] of this.apiKeys.entries()) {
          if (key.instanceId === id) {
            this.apiKeys.delete(keyId);
          }
        }
        count++;
      }
      return Promise.resolve({ count });
    },
  };

  $queryRaw(): Promise<[{ '?column?': number }]> {
    return Promise.resolve([{ '?column?': 1 }]);
  }

  $executeRawUnsafe(): Promise<number> {
    this.reset();
    return Promise.resolve(0);
  }

  async $connect(): Promise<void> {}

  async $disconnect(): Promise<void> {}

  async onModuleInit(): Promise<void> {}

  async onModuleDestroy(): Promise<void> {}

  reset(): void {
    this.users.clear();
    this.apiKeys.clear();
    this.instances.clear();
    this.nextInstanceId = 1;
  }

  private findInstance(
    userId: string,
    name: string,
  ): InstanceRecord | undefined {
    return [...this.instances.values()].find(
      (instance) => instance.userId === userId && instance.name === name,
    );
  }
}
