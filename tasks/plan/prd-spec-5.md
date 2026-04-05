# PRD: Redis Auth State for Baileys Sessions

**Spec**: tasks/specs/spec-5-redis-auth-state.md
**Depends on**: tasks/plan/prd-spec-4.md (PostgreSQL + Docker must be implemented first)
**Status**: TODO

---

## Summary

Replace `useMultiFileAuthState` (filesystem) with `useRedisAuthState` (Redis) for storing Baileys
session credentials. Auth state is stored in Redis using a structured key scheme
(`papagai:{name}:creds`, `papagai:{name}:keys:{type}:{id}`). The `instances_data` Docker volume
is eliminated. Redis is added to Docker Compose with AOF persistence.

---

## BDD Scenarios

### Feature: Redis Auth State

#### Scenario 1 — New instance stores creds in Redis
```
Given Redis is running
When POST /instances/create is called with {"name": "papagai01"}
And the QR is scanned and instance connects
Then redis.get("papagai:papagai01:creds") returns a non-null JSON object
And redis.keys("papagai:papagai01:keys:*") returns at least one key
And NO ./instances/papagai01/ directory is created on the filesystem
```

#### Scenario 2 — Session restored from Redis on restart (no QR)
```
Given "papagai01" credentials exist in Redis (from a previous connection)
And "papagai01" exists in PostgreSQL (from spec-4)
When the server restarts
Then onModuleInit() calls createInstance("papagai01")
And useRedisAuthState() loads creds from redis.get("papagai:papagai01:creds")
And Baileys connects WITHOUT generating a new QR
And GET /instances/papagai01/status returns {connected: true}
```

#### Scenario 3 — Fresh instance (no Redis data) generates QR
```
Given Redis has no keys for "papagai02"
When onModuleInit() restores "papagai02" from PostgreSQL
Then useRedisAuthState() calls initAuthCreds() for a fresh credential set
And GET /instances/papagai02/qr returns {status: "qr", qr: "<string>"}
```

#### Scenario 4 — Auth deleted from Redis on disconnect
```
Given "papagai01" has credentials in Redis (creds + N key entries)
When DELETE /instances/papagai01 is called
Then redis.keys("papagai:papagai01:*") returns an empty array
And the PostgreSQL record is also deleted (spec-4 behaviour preserved)
```

#### Scenario 5 — Redis persistence survives Redis restart
```
Given Redis is running with appendonly enabled
And "papagai01" has valid credentials in Redis
When the Redis container is restarted (docker-compose restart redis)
Then redis.get("papagai:papagai01:creds") still returns the credentials
And the app reconnects "papagai01" without a new QR on next app restart
```

#### Scenario 6 — BufferJSON serialization preserves Buffer objects
```
Given Baileys stores pre-key data containing Buffer fields
When useRedisAuthState saves a pre-key via keys.set()
Then the value is serialized with BufferJSON.replacer
And when retrieved via keys.get(), it is deserialized with BufferJSON.reviver
And the Buffer fields are correctly reconstructed as Buffer objects
```

---

### Feature: Docker Stack with Redis

#### Scenario 7 — docker-compose up includes Redis
```
Given the updated docker-compose.yml
When docker-compose up is run
Then a Redis 7 container starts with appendonly persistence
And the app connects to Redis at redis://redis:6379
And GET http://localhost:3000/instances returns 200
```

#### Scenario 8 — No instances/ volume in Docker Compose
```
Given the updated docker-compose.yml
When docker-compose config is inspected
Then there is no instances_data volume
And there is a redis_data volume
And the app service has no /app/instances volume mount
```

#### Scenario 9 — Redis unreachable → instance creation fails gracefully
```
Given Redis is down
When POST /instances/create is called
Then the response status is 400 or 500 with a clear error message
And the app continues running (other endpoints still respond)
```

---

## Tasks

| ID | Title | Files | Size | Depends on |
|---|---|---|---|---|
| ICT-1 | Add `ioredis` + `REDIS_URL` env + config | `package.json`, `.env`, `src/config/configuration.ts` | S | — |
| ICT-2 | Implement `useRedisAuthState()` utility | `src/whatsapp/utils/redis-auth-state.ts` | M | ICT-1 |
| ICT-3 | Update WhatsappService to use Redis auth | `src/whatsapp/whatsapp.service.ts` | S | ICT-2 |
| ICT-4 | Update docker-compose.yml (add Redis, remove instances volume) | `docker-compose.yml` | S | ICT-1 |

**Totals**: 4 tasks — S: 3, M: 1, L: 0
**Execution order**: ICT-1 → [ICT-2 ∥ ICT-4] → ICT-3

---

## ICT-1: Package + Env + Config

**`package.json`** — add to `dependencies`:
```json
"ioredis": "^5.4.0"
```

**`.env`** — append:
```
REDIS_URL=redis://localhost:6379
```

**`src/config/configuration.ts`** — add field:
```typescript
redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
```

---

## ICT-2: `useRedisAuthState` Utility

**File**: `src/whatsapp/utils/redis-auth-state.ts` (NEW)

```typescript
import { Redis } from 'ioredis';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

export async function useRedisAuthState(redis: Redis, instanceName: string) {
  const prefix = `papagai:${instanceName}`;

  const readData = async (key: string): Promise<any> => {
    const data = await redis.get(key);
    return data ? JSON.parse(data, BufferJSON.reviver) : null;
  };

  const writeData = async (key: string, data: unknown): Promise<void> => {
    await redis.set(key, JSON.stringify(data, BufferJSON.replacer));
  };

  const creds = (await readData(`${prefix}:creds`)) ?? initAuthCreds();

  const keys = {
    async get(type: string, ids: string[]): Promise<Record<string, any>> {
      const result: Record<string, any> = {};
      await Promise.all(
        ids.map(async (id) => {
          const value = await readData(`${prefix}:keys:${type}:${id}`);
          if (value != null) result[id] = value;
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

  const saveCreds = async (): Promise<void> => {
    await writeData(`${prefix}:creds`, creds);
  };

  return { state: { creds, keys }, saveCreds };
}
```

**Notes:**
- `BufferJSON.reviver` / `BufferJSON.replacer` handle Baileys' Buffer fields correctly
- `initAuthCreds()` creates a fresh credential set when no Redis data exists
- The `creds` object is mutated in place by Baileys — `saveCreds` captures the reference

---

## ICT-3: WhatsappService Update

**File**: `src/whatsapp/whatsapp.service.ts`

### Add import:
```typescript
import { Redis } from 'ioredis';
import { useRedisAuthState } from './utils/redis-auth-state.js';
```

### Remove import:
```typescript
// Remove: useMultiFileAuthState from '@whiskeysockets/baileys'
// Remove: import * as fs from 'fs'; (if only used for auth dir creation)
```

⚠️ Keep `fs` import if it's still used elsewhere (media downloads use `fs.writeFileSync`).

### Add Redis client field + init in constructor:
```typescript
private readonly redis: Redis;

constructor(
  private configService: ConfigService,
  private webhookService: WebhookService,
  @InjectRepository(InstanceConfig)
  private instanceConfigRepo: Repository<InstanceConfig>,
) {
  this.redis = new Redis(this.configService.get<string>('redisUrl') || 'redis://localhost:6379');
  this.mediaDir = this.configService.get<string>('mediaDir') || './media';
  if (!fs.existsSync(this.mediaDir)) {
    fs.mkdirSync(this.mediaDir, { recursive: true });
  }
}
```

### In `createInstance()` — replace filesystem auth with Redis:

**Remove these lines:**
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

### In `disconnectInstance()` — delete Redis keys:

After `instance.socket.end(undefined)` and before `return true`, add:
```typescript
const redisKeys = await this.redis.keys(`papagai:${instanceName}:*`);
if (redisKeys.length > 0) {
  await this.redis.del(...redisKeys);
}
```

### In `onModuleDestroy()` — close Redis connection:
```typescript
onModuleDestroy(): void {
  for (const [name, instance] of this.instances) {
    this.logger.log(`Shutting down instance "${name}"`);
    instance.socket.end(undefined);
  }
  this.instances.clear();
  this.qrCodes.clear();
  this.redis.disconnect();  // ADD THIS
}
```

---

## ICT-4: Update docker-compose.yml

**Add `redis` service:**
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

**Update `app` service:**
- Add `redis` to `depends_on` with `condition: service_healthy`
- Add env var: `REDIS_URL: redis://redis:6379`
- Remove volume mount: `- instances_data:/app/instances`

**Update `volumes` block:**
- Remove: `instances_data:`
- Add: `redis_data:`

---

## Implementation Notes

- `ioredis` is preferred over `redis` (node-redis) for better TypeScript support and connection resilience
- The `creds` object returned by Baileys is a plain object reference — mutations to it are captured by `saveCreds` without re-reading
- Keep `fs` import in `whatsapp.service.ts` — it's still needed for media file operations (`fs.writeFileSync`, `fs.readFileSync`, `fs.existsSync`, `fs.mkdirSync`)
- `redis.keys()` with a pattern is fine for dev-scale (< 10 instances × ~820 keys = ~8200 max keys total)
- For the `keys.get()` method: Baileys sometimes passes `undefined` values in the `ids` array — add a filter: `ids.filter(Boolean)` before the `Promise.all`
- The `useMultiFileAuthState` import can be removed from Baileys imports after this change
