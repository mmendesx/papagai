# Spec 4 — Database Persistence & Session Restoration

## Overview

Papagai is fully stateless: instance configs (webhook URL, headers) live only in memory and are
lost on every restart. Baileys auth credentials DO persist to `./instances/<name>/` on disk
(820+ files per instance via `useMultiFileAuthState`), but no code reads those files at startup
to reconnect. This means every restart requires a new QR scan.

This spec adds PostgreSQL (via Docker) to store instance configurations, and adds startup
restoration logic so all previously created instances reconnect automatically — no new QR scan
required if the auth files are intact.

---

## Problem Statement

| Issue | Root Cause |
|---|---|
| QR required after every restart | No `OnModuleInit` logic to reload instances |
| Webhook URLs lost on restart | Instance metadata stored only in `Map<string, Instance>` |
| No record of what instances exist | Nothing writes instance configs to disk or DB |

Baileys auth files survive restarts (written by `saveCreds` callback). The missing piece is
instance configuration persistence and startup restoration.

---

## Architecture Decision

**Store in PostgreSQL:**
- Instance name, webhook URL, webhook headers (JSONB), timestamps

**Keep on filesystem (Docker volume):**
- Baileys auth state (`./instances/<name>/creds.json`, pre-keys, session files, etc.)
- These are already persisted by `useMultiFileAuthState` — no changes needed

**Docker Compose:**
- PostgreSQL 16 service
- Named volume for `./instances/` (auth files survive container restarts)
- Named volume for `./media/` (media files survive container restarts)

---

## Functional Requirements

### FR-1: Instance configs persisted on create
When `POST /instances/create` succeeds, a record is written to PostgreSQL with:
`name`, `webhookUrl`, `webhookHeaders`, `createdAt`.

### FR-2: Instance record deleted on disconnect
When `DELETE /instances/:name` is called, the PostgreSQL record is deleted alongside
closing the socket.

### FR-3: Auto-restore all instances on startup
When the NestJS app initializes (`OnModuleInit`), it queries PostgreSQL for all instance records
and calls `createInstance()` for each one. If Baileys auth files exist → connects without QR.
If auth files are missing → starts fresh (will generate a new QR).

### FR-4: Docker Compose runs the full stack
A single `docker-compose up` starts PostgreSQL and Papagai with all required env vars, mounted
volumes for `./instances/` and `./media/`.

### FR-5: DB connection is required for startup
If the database is unreachable at startup, the app logs a clear error and exits. Fail fast.

---

## Technical Design

### Database Schema

Single table: `instances`

```sql
CREATE TABLE instances (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  webhook_url VARCHAR(2048),
  webhook_headers JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### NestJS Integration

**Package**: `@nestjs/typeorm`, `typeorm`, `pg`

**TypeORM entity**: `src/instances/entities/instance-config.entity.ts`

**Changes to `WhatsappService`**:
- Implement `OnModuleInit`
- In `onModuleInit()`: query `InstanceConfigRepository`, call `createInstance()` for each record
- In `createInstance()`: save record to DB after socket is set up
- In `disconnectInstance()`: delete record from DB
- In `reconnectInstance()`: no DB change needed (config already persisted)

**`InstancesModule`** registers the TypeORM entity.
**`AppModule`** registers `TypeOrmModule.forRootAsync()` reading config from `ConfigService`.

### New Environment Variables

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=papagai
DB_PASS=papagai
DB_NAME=papagai
```

### Docker Compose Structure

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB }
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  app:
    build: .
    depends_on: [db]
    environment: { all env vars }
    volumes:
      - ./instances:/app/instances   # Baileys auth files
      - ./media:/app/media           # media files
    ports: ["3000:3000"]
```

**Dockerfile** (multi-stage, Node 22 Alpine):
- Stage 1: install deps + build
- Stage 2: copy dist + node_modules, run as non-root

---

## Non-Functional Requirements

- TypeORM `synchronize: true` in development (auto-creates table) — acceptable for this project size
- No migration tooling required for now
- Connection pool: default TypeORM settings
- The `instances/` directory must exist on both host and in container (created at startup if missing)
- DB config read from `ConfigService` — not hardcoded

---

## Change Surface

| File | Change |
|---|---|
| `docker-compose.yml` | NEW — PostgreSQL + app services |
| `Dockerfile` | NEW — multi-stage Node 22 Alpine |
| `.env` | Add `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` |
| `package.json` | Add `@nestjs/typeorm`, `typeorm`, `pg` |
| `src/config/configuration.ts` | Add `db` config block |
| `src/app.module.ts` | Add `TypeOrmModule.forRootAsync()` |
| `src/instances/entities/instance-config.entity.ts` | NEW — TypeORM entity |
| `src/instances/instances.module.ts` | Register `TypeOrmModule.forFeature([InstanceConfig])` |
| `src/whatsapp/whatsapp.service.ts` | Add `OnModuleInit`, DB save/delete, restore loop |
| `src/whatsapp/whatsapp.module.ts` | Import `TypeOrmModule.forFeature([InstanceConfig])` |

---

## Dependencies

| Dependency | Status |
|---|---|
| `@nestjs/typeorm` | Not installed — add to package.json |
| `typeorm` | Not installed — add to package.json |
| `pg` | Not installed — add to package.json |
| `@types/pg` | Not installed — add as devDependency |
| Docker + Docker Compose | Must be available on the host |
| PostgreSQL 16 Alpine | Pulled by Docker Compose |

---

## Constraints

- Auth files stay on filesystem — do NOT store them in the database
- The `reconnectInstance()` method must NOT write to DB (it re-uses the existing record)
- `synchronize: true` is acceptable in dev; add a note for production
- The app service in Docker Compose uses `network_mode: host` OR the db hostname must be `db`
- `instances/` directory creation on startup is already handled by `fs.mkdirSync` in `createInstance`
