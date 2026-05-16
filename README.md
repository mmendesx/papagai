# Papagai

[![E2E Tests](https://github.com/mmendesx/papagai/actions/workflows/e2e.yml/badge.svg)](https://github.com/mmendesx/papagai/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**The self-hosted WhatsApp gateway for delivering messages through a REST API, webhooks, signed media URLs, and a web dashboard.**

Papagai is a multi-device WhatsApp gateway built for teams that want to run their own messaging infrastructure. It exposes a REST API for managing WhatsApp sessions, sending messages, receiving events through webhooks, and inspecting activity from an Angular dashboard served by the same backend.

Papagai is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. It uses the Baileys ecosystem to interact with WhatsApp Web protocols. Use it responsibly and make sure your usage complies with WhatsApp's terms and the laws that apply to your region.

---

## Features

- **Multi-instance session management**: create, connect with QR Code, disconnect, and delete independent WhatsApp instances.
- **Message sending**: text, images, audio, voice notes, video, documents, stickers, location, reactions, and interactive button messages.
- **Message receiving**: inbound events are transformed, enriched, and delivered through per-instance webhooks.
- **Signed media URLs**: downloaded media is exposed through expiring signed URLs instead of public static file paths.
- **Per-instance webhooks**: configurable URL, custom headers, event filters, enable/disable controls, retries, and SSRF validation.
- **JWT and API key authentication**: account access through JWT and scoped automation access through API keys.
- **Angular dashboard**: manage instances, monitor status, scan QR Codes, configure webhooks, and inspect chats.
- **Integrated API documentation**: interactive reference available at `/docs` when enabled.
- **Automatic reconnection**: sessions attempt to reconnect after connection drops.

---

## Tech Stack

| Layer         | Technology                                            |
| ------------- | ----------------------------------------------------- |
| Backend       | NestJS 11, TypeScript 5.7, Node 22                    |
| Database      | PostgreSQL 16 + Prisma                                |
| Cache / queue | Redis 7, ioredis, BullMQ                              |
| WhatsApp      | `@whiskeysockets/baileys` through the `whaileys` fork |
| Frontend      | Angular 19, Taiga UI, Tailwind CSS                    |
| Container     | Docker, Docker Compose                                |

---

## Requirements

- **Docker + Docker Compose** for the recommended development path.
- **Node 22 + npm** for running the backend or frontend outside Docker.
- **Git**.

---

## Quick Start

### Docker With Hot Reload

The development stack starts PostgreSQL, Redis, the NestJS backend, and the Angular dev server with hot reload. Development secrets are already defined in `docker-compose.dev.yml`, so no `.env` file is required for local development.

```bash
git clone https://github.com/mmendesx/papagai.git
cd papagai
make dev
```

Without Make:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

After startup:

- **Angular app with HMR**: `http://localhost:4200`
- **API directly**: `http://localhost:3000`
- **First user registration**: `http://localhost:4200/register`

How the development stack works:

- Source code is mounted into the containers through bind mounts.
- Changes in `src/` restart NestJS through `nest start --watch` in the `papagai-app` container.
- Changes in `client/src/` trigger Angular HMR through `ng serve` in the `papagai-client` container.
- The Angular dev server proxies `/api` to the backend container through `client/proxy.conf.docker.json`.

For local development without Docker, start only PostgreSQL and Redis with `make infra`, then run `npm run start:dev` and/or `npm run start --prefix client` on the host. The local Angular proxy file at `client/proxy.conf.json` points to `http://localhost:3000`.

---

## Database

The database schema is managed by Prisma in `prisma/schema.prisma`. Production migrations are controlled by versioned migration files. Apply pending migrations before starting the production app:

```bash
npm run prisma:migrate:deploy
```

### Prisma Scripts

| Script                          | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `npm run prisma:generate`       | Regenerates Prisma Client from the schema.             |
| `npm run prisma:migrate`        | Creates and applies a new development migration.       |
| `npm run prisma:migrate:deploy` | Applies pending production migrations without prompts. |
| `npm run prisma:studio`         | Opens Prisma Studio for visual database inspection.    |

To reset an existing development database and recreate the stack:

```bash
make down/v && make dev
```

---

## Environment Variables

Development defaults are defined in `docker-compose.dev.yml` and `.env.example`. In production, **`APP_KEY`, `JWT_SECRET`, and `BASE_URL` are required**. The production compose file intentionally fails startup when they are missing.

| Variable                 | Development default                                              | Description                                                                         |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `PORT`                   | `3000`                                                           | HTTP server port.                                                                   |
| `NODE_ENV`               | `development`                                                    | Runtime environment.                                                                |
| `APP_KEY`                | `dev-app-key`                                                    | Application signing secret. Change this in production.                              |
| `JWT_SECRET`             | `dev-jwt-secret`                                                 | JWT signing secret. Change this in production.                                      |
| `DATABASE_URL`           | `postgresql://papagai:papagai@db:5432/papagai`                   | PostgreSQL connection string used by Prisma.                                        |
| `DB_HOST`                | `localhost`                                                      | PostgreSQL host.                                                                    |
| `DB_PORT`                | `5432`                                                           | PostgreSQL port.                                                                    |
| `DB_USER`                | `papagai`                                                        | PostgreSQL user.                                                                    |
| `DB_PASS`                | `papagai`                                                        | PostgreSQL password.                                                                |
| `DB_NAME`                | `papagai`                                                        | PostgreSQL database name.                                                           |
| `REDIS_URL`              | `redis://localhost:6380` locally, `redis://redis:6379` in Docker | Redis connection string.                                                            |
| `MEDIA_DIR`              | `./media`                                                        | Directory for downloaded media.                                                     |
| `INSTANCES_DIR`          | `./instances`                                                    | Directory for Baileys session data.                                                 |
| `BASE_URL`               | `http://localhost:PORT`                                          | Public URL used to generate signed media links.                                     |
| `MEDIA_URL_TTL_SECONDS`  | `86400`                                                          | Signed media URL lifetime in seconds.                                               |
| `MAX_INSTANCES`          | `10`                                                             | Maximum number of concurrent WhatsApp instances.                                    |
| `LOG_LEVEL`              | `info`                                                           | Log verbosity: `debug`, `info`, `warn`, or `error`.                                 |
| `WBA_CREDENTIALS_SECRET` | falls back to `APP_KEY`                                          | Optional dedicated encryption secret for WhatsApp Business API credentials at rest. |
| `WBA_GRAPH_API_BASE_URL` | `https://graph.facebook.com`                                     | Base URL for Meta Cloud API requests.                                               |
| `WBA_GRAPH_API_VERSION`  | `v22.0`                                                          | Graph API version used by WBA sends and health checks.                              |
| `WBA_HTTP_TIMEOUT_MS`    | `15000`                                                          | Timeout in milliseconds for WBA Cloud API requests.                                 |

---

## API Reference

The full interactive API reference is available at **`/docs`** after the server is running and Swagger is enabled.

| Group              | Endpoints                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Authentication     | `POST /api/auth/login`, `POST /api/auth/register`                                            |
| Instances          | `GET /api/instances`, `POST /api/instances/create`, `DELETE /api/instances/:name`            |
| Status and QR      | `GET /api/instances/:name/status`, `GET /api/instances/:name/qr`                             |
| Messages           | `POST /api/instances/:name/messages` for web and WBA providers (including templates for WBA) |
| Webhooks           | `PATCH /api/instances/:name/webhook`                                                         |
| WBA Webhooks       | `GET /api/wba/webhook`, `POST /api/wba/webhook`                                              |
| Contacts and Chats | `GET /api/instances/:name/contact/:number`, `GET /api/instances/:name/chats`                 |

Protected routes accept either **JWT** through `Authorization: Bearer <token>` or an **API key** through `X-Api-Key: <key>`.

### API Key Scope

- **Account key (`ppg_acct_...`)**: created through `POST /api/auth/apikeys`; can access account routes and instance routes owned by the same user.
- **Instance key (`ppg_inst_...`)**: created through `POST /api/instances/:name/apikeys`; can access only the matching instance.
- Instance keys are blocked from account routes such as `GET /api/instances` and `POST /api/auth/apikeys` with **403 Forbidden**.
- Account keys can receive a `permissions` list to limit which endpoint groups are allowed.
- Account keys can also receive `permissionsTemplate` with one of the built-in templates: `read_only`, `operator`, `instance_manager`, or `account_admin`.
- If `permissions` is omitted, the account key keeps full access for backward compatibility.

---

## Testing

Unit tests:

```bash
npm test
```

End-to-end tests use in-memory doubles and do not require PostgreSQL or Redis:

```bash
npm run test:e2e
```

Coverage:

```bash
npm run test:cov
```

---

## Dependency Security

Known transitive dependency CVEs are handled through `overrides` in the backend and client `package.json` files. See [`docs/dependency-overrides.md`](docs/dependency-overrides.md) for the pinned versions and rationale.

Run audits before releasing a new version:

```bash
npm audit --audit-level=moderate
npm audit --audit-level=moderate --prefix client
```

---

## Production

The production stack requires `APP_KEY`, `JWT_SECRET`, and `BASE_URL` in the environment or in a root `.env` file. Startup is intentionally rejected when these values are missing.

```bash
cp .env.example .env
# Set APP_KEY and JWT_SECRET to strong random values.
# Set BASE_URL to the public application URL.

make prod/build
# Equivalent: docker compose up -d --build
```

The multi-stage `Dockerfile` builds the NestJS backend and Angular SPA, then serves both from one Node 22 Alpine container on port 3000.

The production compose file exposes only the application. PostgreSQL and Redis stay reachable only on the internal Docker network.

### Production Security Checklist

- Set a strong, unique `APP_KEY`.
- Set a strong, unique `JWT_SECRET`.
- Set `BASE_URL` to the public HTTPS origin used by clients and webhooks.
- Keep `SWAGGER_ENABLED=false` unless you intentionally want public API docs.
- Keep `WEBHOOK_ALLOW_PRIVATE_HOSTS=false` outside local development.
- Do not expose PostgreSQL or Redis ports to the public internet.
- Do not commit `.env`, media files, session data, database dumps, or local credentials.
- Run `npm run lint:ci`, `npm test`, `npm run test:e2e`, and dependency audits before publishing a release.

---

## License

MIT License. See [LICENSE](LICENSE).
