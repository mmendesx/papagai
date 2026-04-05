# PRD: Database Persistence & Session Restoration

**Spec**: tasks/specs/spec-4-database-persistence.md
**Status**: TODO

---

## Summary

Add PostgreSQL (Docker) to persist instance configurations and auto-restore all WhatsApp connections
on startup — eliminating the need to re-scan QR codes after every restart. Baileys auth credentials
stay on the filesystem (Docker volume); the database stores only instance metadata (name, webhook
URL, headers). A `docker-compose.yml` and `Dockerfile` are added to run the full stack.

---

## BDD Scenarios

### Feature: Instance Persistence

#### Scenario 1 — New instance saved to DB on create
```
Given the server is running with a connected PostgreSQL
When POST /instances/create is called with {"name": "papagai01", "webhook": "https://..."}
Then the response is {success: true}
And a record exists in the instances table with name="papagai01" and webhook_url="https://..."
And the Baileys auth files are written to ./instances/papagai01/
```

#### Scenario 2 — Instance deleted from DB on disconnect
```
Given an instance "papagai01" exists in DB and in memory
When DELETE /instances/papagai01 is called
Then the response confirms deletion
And no record exists in the instances table with name="papagai01"
And the socket is closed
```

#### Scenario 3 — Instance without webhook persisted
```
Given the server is running
When POST /instances/create is called with only {"name": "papagai02"} (no webhook)
Then webhook_url is NULL in the DB record
And webhook_headers is '{}' in the DB record
```

---

### Feature: Session Restoration on Startup

#### Scenario 4 — All instances restored on startup without QR
```
Given "papagai01" exists in DB with its auth files intact in ./instances/papagai01/
When the server restarts
Then onModuleInit() queries the DB and finds "papagai01"
And createInstance("papagai01") is called during startup
And Baileys loads existing auth from ./instances/papagai01/creds.json
And the instance connects to WhatsApp WITHOUT generating a new QR code
And GET /instances/papagai01/status returns {connected: true}
```

#### Scenario 5 — Instance with missing auth files gets new QR
```
Given "papagai01" exists in DB but ./instances/papagai01/ was deleted
When the server restarts
And onModuleInit() calls createInstance("papagai01")
Then Baileys creates fresh auth state
And GET /instances/papagai01/qr returns {status: "qr", qr: "<string>"}
```

#### Scenario 6 — Multiple instances all restored
```
Given DB contains "papagai01", "papagai02", "papagai03" with auth files intact
When the server restarts
Then all 3 instances are restored in parallel during onModuleInit()
And GET /instances returns {total: 3}
```

#### Scenario 7 — Empty DB on fresh start (no instances to restore)
```
Given the DB is empty (first run or all instances deleted)
When the server starts
Then onModuleInit() completes without error
And GET /instances returns {total: 0}
```

---

### Feature: Docker Stack

#### Scenario 8 — docker-compose up starts the full stack
```
Given Docker and Docker Compose are installed
When `docker-compose up` is run from the project root
Then PostgreSQL starts and is healthy
And the Papagai app starts after PostgreSQL is ready
And GET http://localhost:3000/instances returns 200
```

#### Scenario 9 — Auth files survive container restart via volume
```
Given a running Docker stack where "papagai01" has scanned QR
When docker-compose restart is run
Then ./instances/papagai01/ is still present (mounted volume)
And "papagai01" reconnects without a new QR on restart
```

#### Scenario 10 — DB unreachable on startup → app exits with error
```
Given the DB is not available (e.g. wrong credentials)
When the Papagai app tries to start
Then the app logs a clear DB connection error
And exits with a non-zero code
```

---

## Tasks

| ID | Title | Files | Size | Depends on |
|---|---|---|---|---|
| ICT-1 | Install DB packages + add env vars + update config | `package.json`, `.env`, `src/config/configuration.ts` | S | — |
| ICT-2 | Create TypeORM entity + register in modules | `src/instances/entities/instance-config.entity.ts`, `src/instances/instances.module.ts`, `src/app.module.ts`, `src/whatsapp/whatsapp.module.ts` | S | ICT-1 |
| ICT-3 | Persist instance on create + delete on disconnect + restore on startup | `src/whatsapp/whatsapp.service.ts` | M | ICT-2 |
| ICT-4 | Dockerfile + docker-compose.yml | `Dockerfile`, `docker-compose.yml`, `.dockerignore` | S | ICT-1 |

**Totals**: 4 tasks — S: 3, M: 1, L: 0
**Execution order**: [ICT-1 ∥ ICT-4] → ICT-2 → ICT-3

---

## ICT-1: Packages + Env + Config

**`package.json`** — add to `dependencies`:
```json
"@nestjs/typeorm": "^11.0.0",
"pg": "^8.13.0",
"typeorm": "^0.3.20"
```
Add to `devDependencies`:
```json
"@types/pg": "^8.11.0"
```

**`.env`** — append:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=papagai
DB_PASS=papagai
DB_NAME=papagai
```

**`src/config/configuration.ts`** — add `db` block to the returned object:
```typescript
db: {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER || 'papagai',
  pass: process.env.DB_PASS || 'papagai',
  name: process.env.DB_NAME || 'papagai',
},
```

---

## ICT-2: Entity + Module Registration

**`src/instances/entities/instance-config.entity.ts`** (NEW):
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('instances')
export class InstanceConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'webhook_url', nullable: true, type: 'varchar', length: 2048 })
  webhookUrl: string | null;

  @Column({ name: 'webhook_headers', type: 'jsonb', default: '{}' })
  webhookHeaders: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**`src/app.module.ts`** — add `TypeOrmModule.forRootAsync()`:
```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get('db.host'),
    port: config.get<number>('db.port'),
    username: config.get('db.user'),
    password: config.get('db.pass'),
    database: config.get('db.name'),
    entities: [InstanceConfig],
    synchronize: true,  // auto-create table in dev
  }),
}),
```

**`src/instances/instances.module.ts`** — add `TypeOrmModule.forFeature([InstanceConfig])` to imports.

**`src/whatsapp/whatsapp.module.ts`** — add `TypeOrmModule.forFeature([InstanceConfig])` to imports (WhatsappService injects the repo).

---

## ICT-3: WhatsappService DB Integration

**File**: `src/whatsapp/whatsapp.service.ts`

### Imports to add:
```typescript
import { OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstanceConfig } from '../instances/entities/instance-config.entity.js';
```

### Class signature change:
```typescript
export class WhatsappService implements OnModuleDestroy, OnModuleInit {
```

### Constructor injection:
```typescript
constructor(
  private configService: ConfigService,
  private webhookService: WebhookService,
  @InjectRepository(InstanceConfig)
  private instanceConfigRepo: Repository<InstanceConfig>,
) { ... }
```

### New `onModuleInit()`:
```typescript
async onModuleInit(): Promise<void> {
  const configs = await this.instanceConfigRepo.find();
  this.logger.log(`Restoring ${configs.length} instance(s) from database...`);
  await Promise.allSettled(
    configs.map(async (config) => {
      try {
        await this.createInstance(config.name, config.webhookUrl ?? undefined, config.webhookHeaders);
        this.logger.log(`Restored instance "${config.name}"`);
      } catch (error) {
        this.logger.error(`Failed to restore instance "${config.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );
}
```

### In `createInstance()` — save to DB after socket setup:
After `this.registerSocketEvents(instance)`, add:
```typescript
// Persist config (skip if already exists — called during restore)
await this.instanceConfigRepo.upsert(
  { name: instanceName, webhookUrl: webhookUrl ?? null, webhookHeaders: webhookHeaders ?? {} },
  ['name'],
);
```

### In `disconnectInstance()` — delete from DB:
Before `return true`, add:
```typescript
await this.instanceConfigRepo.delete({ name: instanceName });
```

### `reconnectInstance()` — NO DB changes (config already in DB).

---

## ICT-4: Dockerfile + docker-compose.yml

**`Dockerfile`**:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S papagai && adduser -S papagai -G papagai
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER papagai
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**`docker-compose.yml`**:
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: papagai
      POSTGRES_PASSWORD: papagai
      POSTGRES_DB: papagai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U papagai"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PORT: 3000
      NODE_ENV: production
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: papagai
      DB_PASS: papagai
      DB_NAME: papagai
      INSTANCES_DIR: /app/instances
      MEDIA_DIR: /app/media
    volumes:
      - instances_data:/app/instances
      - media_data:/app/media
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  instances_data:
  media_data:
```

**`.dockerignore`**:
```
node_modules
dist
instances
media
.env.local
*.tsbuildinfo
```

---

## Implementation Notes

- `synchronize: true` auto-creates the `instances` table in dev — acceptable, document it
- Use `upsert(['name'])` in `createInstance()` so restore calls (which re-invoke createInstance) don't fail with unique constraint violations
- `Promise.allSettled()` in `onModuleInit()` ensures one failing restore doesn't block others
- The `reconnectInstance()` method creates a new socket but keeps the existing DB record — correct
- In Docker, `DB_HOST=db` (the service name) — in local dev, `DB_HOST=localhost`
- The Dockerfile runs as non-root user `papagai` — volumes must be writable by this user

---

## Local Dev Quick Start (without Docker)

```bash
# Start just PostgreSQL
docker run -d --name papagai-db \
  -e POSTGRES_USER=papagai \
  -e POSTGRES_PASSWORD=papagai \
  -e POSTGRES_DB=papagai \
  -p 5432:5432 \
  postgres:16-alpine

# Run app normally
npm run build && node dist/main.js
```
