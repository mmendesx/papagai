# Spec 5 — Redis Auth State for Baileys Sessions

## Overview

Spec-4 planned keeping Baileys auth credentials on the filesystem (./instances/<name>/) and
mounting them as a Docker volume. This spec replaces that approach with Redis: auth state is stored
in Redis instead of the filesystem, eliminating the need for the `instances_data` Docker volume and
any filesystem dependency for session persistence.

With Redis auth state, a container can be wiped and rebuilt without losing sessions. Auth data
survives as long as Redis data does (persistent via AOF/RDB).

---

## Relationship to Spec-4

This spec extends and partially modifies Spec-4:

| Spec-4 decision | Change in Spec-5 |
|---|---|
| `useMultiFileAuthState` (filesystem) | Replaced by `useRedisAuthState` (Redis) |
| `instances_data` Docker volume for auth files | Removed — Redis stores auth |
| `fs.mkdirSync(authDir)` in `createInstance` | Removed |
| Redis not present | Added to Docker Compose |

PostgreSQL from Spec-4 is unchanged — it still stores instance configs (name, webhook, headers).

---

## How Baileys Auth State Works

`useMultiFileAuthState(dir)` returns:
```typescript
{ state: AuthState, saveCreds: () => Promise<void> }
```

`AuthState` has two parts:
1. **`creds`** — main credentials JSON (identity keys, registration info, ~2KB)
2. **`keys`** — signal protocol key store with `get(type, ids)` and `set(data)` methods

Key types stored by Baileys:
- `pre-key` — one-time pre-keys for E2E encryption
- `session` — per-contact session state
- `sender-key` — group encryption keys
- `sender-key-memory` — in-memory optimization map
- `app-state-sync-key` — app state sync keys
- `app-state-sync-version` — version tracking
- `sender-message-key` — message keys

---

## Functional Requirements

### FR-1: Baileys auth state stored in Redis per instance
`creds` and all key types are stored in Redis. Auth survives Redis restarts if Redis persistence
(AOF or RDB) is enabled.

### FR-2: `useRedisAuthState(redis, instanceName)` replaces `useMultiFileAuthState`
A new utility function `src/whatsapp/utils/redis-auth-state.ts` implements the same interface as
`useMultiFileAuthState`. It is a drop-in replacement requiring only a Redis client and instance name.

### FR-3: Filesystem no longer used for auth
`createInstance()` no longer calls `fs.mkdirSync()` or `useMultiFileAuthState()`. No
`./instances/<name>/` directory is created.

### FR-4: Redis added to Docker Compose with persistence enabled
The `docker-compose.yml` (from Spec-4) adds a `redis` service with AOF persistence
(`appendonly yes`). The `instances_data` volume is removed.

### FR-5: Auth deleted from Redis on instance disconnect
When `disconnectInstance()` is called, all Redis keys for that instance are deleted (SCAN + DEL
with pattern `papagai:{name}:*`).

### FR-6: `REDIS_URL` environment variable
Redis connection configured via `REDIS_URL` env var (default: `redis://localhost:6379`).

---

## Technical Design

### Redis Key Scheme

```
papagai:{instanceName}:creds              → JSON string (creds object)
papagai:{instanceName}:keys:{type}:{id}   → JSON string (key data)
```

Example keys for instance `papagai01`:
```
papagai:papagai01:creds
papagai:papagai01:keys:pre-key:1
papagai:papagai01:keys:pre-key:2
papagai:papagai01:keys:session:5561...@s.whatsapp.net
papagai:papagai01:keys:app-state-sync-key:AAAAACd1
```

### `useRedisAuthState` Implementation

```typescript
import { Redis } from 'ioredis';
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';

export async function useRedisAuthState(redis: Redis, instanceName: string) {
  const prefix = `papagai:${instanceName}`;

  const readData = async (key: string) => {
    const data = await redis.get(key);
    return data ? JSON.parse(data, BufferJSON.reviver) : null;
  };

  const writeData = async (key: string, data: unknown) => {
    await redis.set(key, JSON.stringify(data, BufferJSON.replacer));
  };

  const creds = (await readData(`${prefix}:creds`)) ?? initAuthCreds();

  const keys = {
    async get<T>(type: string, ids: string[]): Promise<Record<string, T>> {
      const result: Record<string, T> = {};
      await Promise.all(
        ids.map(async (id) => {
          const value = await readData(`${prefix}:keys:${type}:${id}`);
          if (value) result[id] = value;
        }),
      );
      return result;
    },
    async set(data: Record<string, Record<string, unknown>>): Promise<void> {
      await Promise.all(
        Object.entries(data).flatMap(([type, entries]) =>
          Object.entries(entries).map(([id, value]) =>
            value != null
              ? writeData(`${prefix}:keys:${type}:${id}`, value)
              : redis.del(`${prefix}:keys:${type}:${id}`),
          ),
        ),
      );
    },
  };

  const saveCreds = async () => {
    await writeData(`${prefix}:creds`, creds);
  };

  return { state: { creds, keys }, saveCreds };
}
```

### Changes to `WhatsappService`

**Remove:**
```typescript
const instancesDir = this.configService.get<string>('instancesDir') || './instances';
const authDir = `${instancesDir}/${instanceName}`;
fs.mkdirSync(authDir, { recursive: true });
const { state, saveCreds } = await useMultiFileAuthState(authDir);
```

**Replace with:**
```typescript
const { state, saveCreds } = await useRedisAuthState(this.redis, instanceName);
```

**Inject Redis client:**
```typescript
constructor(
  private configService: ConfigService,
  private webhookService: WebhookService,
  @InjectRepository(InstanceConfig)
  private instanceConfigRepo: Repository<InstanceConfig>,
) {
  this.redis = new Redis(this.configService.get<string>('redisUrl') || 'redis://localhost:6379');
  // ...
}
private redis: Redis;
```

**On disconnect — delete all Redis keys for instance:**
```typescript
// In disconnectInstance(), after socket.end():
const keys = await this.redis.keys(`papagai:${instanceName}:*`);
if (keys.length) await this.redis.del(...keys);
```

### Changes to `configuration.ts`
Add:
```typescript
redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
```

### Updated `docker-compose.yml`

Add Redis service, remove `instances_data` volume:
```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

App service env change:
```yaml
REDIS_URL: redis://redis:6379
```

Remove `instances_data` from volumes and app mounts. Keep `media_data`.

---

## New Packages

| Package | Version | Purpose |
|---|---|---|
| `ioredis` | `^5.4.0` | Redis client (TypeScript-native, connection pooling) |
| `@types/ioredis` | Not needed | ioredis ships its own types |

---

## Change Surface

| File | Change |
|---|---|
| `package.json` | Add `ioredis` to dependencies |
| `.env` | Add `REDIS_URL=redis://localhost:6379` |
| `src/config/configuration.ts` | Add `redisUrl` field |
| `src/whatsapp/utils/redis-auth-state.ts` | NEW — `useRedisAuthState()` |
| `src/whatsapp/whatsapp.service.ts` | Inject Redis, replace `useMultiFileAuthState`, delete keys on disconnect |
| `docker-compose.yml` | Add `redis` service, remove `instances_data` volume, add `REDIS_URL` |

---

## Constraints

- `useRedisAuthState` must be a standalone function (not a NestJS service) — mirrors the Baileys pattern
- `BufferJSON.reviver` and `BufferJSON.replacer` must be used for correct serialization of Buffer objects in Baileys key data
- `initAuthCreds()` from Baileys initializes a fresh credential set when no Redis data exists
- Auth deletion on disconnect uses `KEYS` pattern scan — acceptable for dev scale; note `SCAN` is preferred for production with large key spaces
- `ioredis` client created in `WhatsappService` constructor (not via NestJS DI) for simplicity
- Redis persistence must be enabled (`appendonly yes`) or auth is lost on Redis restart
