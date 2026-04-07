# 🦜 Papagai

**The parrot that delivers your messages.**

Papagai is a self-hosted, multi-device WhatsApp gateway that exposes a REST API for managing WhatsApp sessions, sending all message types, and receiving events via webhooks. It ships with a web dashboard and a built-in API documentation page, all served from a single origin.

---

## Features

- **Multi-instance session management** — create, connect via QR scan, disconnect, and delete WhatsApp instances independently
- **Outbound messaging** — text, images, audio, voice notes, video, documents, stickers, location, reactions, and interactive button messages
- **Inbound message handling** — all message types captured, media auto-downloaded and served as static files
- **Per-instance webhooks** — configurable URL, custom headers, event filter (message, qr, connected, disconnected, …), enable/disable toggle
- **JWT authentication** — registration and login; all instance routes are protected
- **Web dashboard** — Angular SPA for managing instances, monitoring status, scanning QR codes, and configuring webhooks
- **Built-in API docs** — interactive reference page at `/docs`, no external tool required
- **Auto-reconnect** — sessions reconnect automatically on connection drop

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | NestJS 11, TypeScript 5.7, Node 22 |
| Database | PostgreSQL 16 + TypeORM |
| Cache / session state | Redis 7 |
| WhatsApp | `@whiskeysockets/baileys` (whaileys fork) |
| Frontend | Angular 19, Taiga UI, Tailwind CSS |
| Container | Docker, Docker Compose |

---

## Prerequisites

- **Docker + Docker Compose** — for the recommended dev path
- **Node 22 + npm** — for running the backend or frontend outside Docker
- **Git**

---

## Getting Started

### Option A — Docker (recommended)

The dev compose stack starts PostgreSQL, Redis, and the NestJS backend with hot-reload. Dev secrets are pre-baked — no `.env` file needed.

```bash
git clone https://github.com/mmendesx/papagai.git
cd papagai
make dev
```

Or without Make:

```bash
docker compose -f docker-compose.dev.yml up
```

Once running:

- App → `http://localhost:3000`
- Register your first user → `http://localhost:3000/register`

Backend source is mounted into the container; changes to `src/` trigger an automatic NestJS restart via `nest start --watch`.

> **Expose ports for local tooling** (psql, redis-cli): add `-f docker-compose.ports.yml` if you have a ports override file, or manually map ports in the dev compose file.

---

### Option B — Local development (Angular HMR)

Use this path when iterating on the Angular frontend with hot module replacement.

**Step 1 — Start infrastructure (db + redis) via Docker:**

```bash
make infra
# equivalent: docker compose up -d db redis
```

**Step 2 — Configure environment:**

```bash
cp .env.example .env
# Dev defaults are already filled in — edit only if your ports differ
```

**Step 3 — Install and start the backend:**

```bash
npm install
npm run start:dev       # NestJS API on http://localhost:3000
```

**Step 4 — Install and start the Angular dev server (separate terminal):**

```bash
npm install --prefix client
npm run start --prefix client   # Angular on http://localhost:4200
```

API requests from the Angular dev server are proxied to port 3000 via `client/proxy.conf.json` — no CORS configuration needed.

- App (with HMR) → `http://localhost:4200`
- API directly → `http://localhost:3000`

---

## Environment Variables

Dev defaults are pre-set in `docker-compose.dev.yml` and in `.env.example`. For production, **`APP_KEY` and `JWT_SECRET` must be set** — the production compose will fail-fast without them.

| Variable | Dev default | Description |
|----------|-------------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Runtime environment |
| `APP_KEY` | `dev-app-key` | Application secret — **change in production** |
| `JWT_SECRET` | `dev-jwt-secret` | JWT signing secret — **change in production** |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `papagai` | PostgreSQL user |
| `DB_PASS` | `papagai` | PostgreSQL password |
| `DB_NAME` | `papagai` | PostgreSQL database name |
| `REDIS_URL` | `redis://localhost:6380` | Redis connection string |
| `MEDIA_DIR` | `./media` | Directory for downloaded inbound media |
| `INSTANCES_DIR` | `./instances` | Directory for Baileys session data |
| `MAX_INSTANCES` | `10` | Maximum concurrent WhatsApp instances |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |

---

## API Reference

The full interactive reference is available in-app at **`/docs`** once the server is running.

| Group | Endpoints |
|-------|-----------|
| Authentication | `POST /api/auth/login` · `POST /api/auth/register` |
| Instances | `GET /api/instances` · `POST /api/instances/create` · `DELETE /api/instances/:name` |
| Status & QR | `GET /api/instances/:name/status` · `GET /api/instances/:name/qr` |
| Messaging | `POST /api/instances/:name/send/*` (text, image, audio, video, document, sticker, location, reaction, buttons) |
| Webhooks | `PATCH /api/instances/:name/webhook` |
| Contacts & Chats | `GET /api/instances/:name/contact/:number` · `GET /api/instances/:name/chats` |

All instance routes require an `Authorization: Bearer <token>` header obtained from the login endpoint.

---

## Testing

**Unit tests:**

```bash
npm test
```

**End-to-end tests** (require a running PostgreSQL instance):

```bash
docker compose up -d db
# wait for the healthcheck, then:
npm run test:e2e
```

**With coverage:**

```bash
npm run test:cov
```

---

## Production

The production stack requires `APP_KEY` and `JWT_SECRET` set in your environment or a `.env` file at the repo root — the compose file will reject startup without them.

```bash
cp .env.example .env
# Set APP_KEY and JWT_SECRET to strong random values

make prod/build
# equivalent: docker compose up -d --build
```

The multi-stage `Dockerfile` builds the NestJS backend and Angular SPA, then serves both from a single Node 22-alpine container on port 3000.
