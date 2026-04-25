# AGENTS.md — Papagai

> Source of truth for AI agents and developers.
> Read entirely before generating code.

---

## Stack

| Layer       | Technology                                                        |
|-------------|-------------------------------------------------------------------|
| Backend     | NestJS 11, TypeScript 5.7, Node 22                                |
| Database    | PostgreSQL + Prisma 6 ORM                                         |
| Cache/Queue | Redis (ioredis 5.4) + BullMQ 5.7                                  |
| WhatsApp    | Baileys (`@whiskeysockets/baileys` fork) — uses heavy `any` types |
| Auth        | JWT (passport-jwt) + API Keys + NestJS Throttler (Redis store)    |
| Frontend    | Angular 19, Taiga UI, Tailwind CSS, Signals, SSE via fetch-event-source |
| Testing     | Jest (unit + e2e), Playwright, Supertest                          |
| Pkg manager | npm                                                               |

---

## Project Structure

```
src/
├── auth/           # JWT/API-key guards, throttler, key CRUD
├── common/         # Filters, interceptors, decorators
├── config/         # NestJS ConfigModule (env vars)
├── health/         # Readiness/liveness probes
├── instances/      # Instance lifecycle controller + service
├── prisma/         # PrismaService module
├── webhook/        # BullMQ processor, URL validator, queue module
└── whatsapp/
    ├── chat-store.service.ts   # In-memory + Redis chat/message store
    ├── whatsapp.service.ts     # Baileys socket lifecycle, send, events
    ├── interfaces/             # Instance, WebhookData, ChatInfo types
    └── utils/                  # transformer, enricher, jid helpers, media
client/
└── src/app/
    ├── core/       # Singletons: auth, http, streaming
    ├── features/   # Domain modules (standalone Angular components)
    ├── shared/     # Reusable components, directives, pipes
    └── layouts/    # Shell: sidebar, header
test/               # E2E specs (Supertest against real DB)
```

---

## Architecture — Key Flows

### WhatsApp Event → Webhook
```
Baileys socket emits event
  → WhatsappService handler (messages.upsert, connection.update, …)
  → WebhookEnricher.enrich() transforms to WebhookData
  → WebhookService queues job in BullMQ (SSRF validation)
  → WebhookDeliveryProcessor retries (default: 3) with exponential backoff
```

### Real-Time Chat (SSE)
```
ChatStoreService maintains RxJS Subject per instance
  → InstancesService exposes streamChatEvents() → Observable<ChatRealtimeEvent>
  → InstancesController @Sse endpoint merges updates + 25s heartbeat
  → Angular frontend via fetch-event-source
```

### Auth
Two parallel guards: `AnyAuthGuard` tries API key first, falls back to JWT.
All instance routes require `AnyAuthGuard`. Auth routes use `AuthThrottlerGuard`.

---

## TypeScript + ESLint Conventions

### Async / Promises

- **Remove `async` from methods that don't `await`.**
  If the declared return type needs `Promise<T>`, return `Promise.resolve(value)` explicitly.
  ```ts
  // ✓
  getChats(userId: string): ChatInfo[] { … }

  // ✓ — interface requires Promise
  getContactInfo(): Promise<any> { return Promise.resolve(undefined); }

  // ✗ — lint error: require-await
  async getChats(userId: string): Promise<ChatInfo[]> { … }
  ```

- **Use `void` operator for fire-and-forget Promises** (no-floating-promises).
  ```ts
  void this.persistChatAsync(userId, instanceName, chatId, chat);
  void bootstrap();
  ```

- **Wrap Promise-returning callbacks** with `void` to satisfy no-misused-promises.
  ```ts
  // ✓
  sock.ev.on('connection.update', (update) => {
    void this.handleConnectionUpdate(instance, update);
  });
  sock.ev.on('creds.update', () => void instance.saveCreds());

  // ✗ — misused-promise: callback expected void but gets Promise
  sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(instance, update));
  ```

### Unused Parameters

Prefix intentionally-unused parameters with `_`. The ESLint rule `argsIgnorePattern: '^_'` applies.
```ts
getQR(_userId: string, _name: string): null { return null; }
```

### Type Assertions

Avoid unnecessary casts. Remove `as T` when TypeScript already knows the type.
Reserve `as` for genuine narrowing (e.g., `Object.values(x) as string[]` when
TypeScript can't infer the element type from `any`). Add `// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion` only when the cast is required for downstream type safety but ESLint can't see it.

### Baileys / `any` Types

Baileys uses extensive `any` internally. The rules `no-unsafe-member-access`,
`no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-return` are **warnings**, not errors.
Do not disable them file-wide — let them surface as warnings so gradual typing is visible.

### `eslint-disable` Comments

Use inline `// eslint-disable-next-line` (never file-wide disables) and only for:
1. Baileys-interop patterns where the `any` is unavoidable and documented
2. Jest patterns like `expect(mock.method)` (no-unbound-method)
3. `async () =>` in Jest `.rejects` chains (require-await — async is needed for Promise wrapping)

---

## Controller Conventions (NestJS)

- Controller methods are `async` **only if they `await` something**.
  NestJS handles both sync and async returns equally.
- Return types should match: if the method is not `async`, declare the return type
  as the plain value, not `Promise<T>`.
  ```ts
  // ✓
  getStatus(@Req() req: Request, @Param('name') name: string) { … }

  // ✓
  async sendMessage(@Body() dto: MetaMessageDto): Promise<MessageResultResponseDto> {
    const result = await this.instancesService.send(…);
    …
  }
  ```

---

## Service Conventions

- **WhatsappService** is stateful — it owns the Baileys socket map.
  All instance operations go through it; never import Baileys directly from controllers.

- **ChatStoreService** is the single source of truth for message/chat state.
  It writes to Redis asynchronously (`void this.persistChatAsync(…)`).
  The in-memory store is the read path; Redis is the durability path.

- **WebhookService** should only *enqueue* jobs. Delivery logic lives exclusively
  in `WebhookDeliveryProcessor`.

- **InstancesService** is the facade between controllers and the WhatsApp/Webhook
  layers. Controllers never import `WhatsappService` or `WebhookService` directly.

---

## Testing Conventions

- **Unit tests** live in `src/**/*.spec.ts`. They run without a database.
  Prisma is mocked via `src/__stubs__/prisma-client.ts`.
  Redis is mocked with a minimal in-memory shim.

- **E2E tests** live in `test/*.e2e-spec.ts`. They require a real Postgres + Redis
  (provided by Docker or the CI services block). Run with `npm run test:e2e`.

- **Test structure** — follow BDD naming, not method names:
  ```ts
  // ✓
  it('returns 404 when instance does not exist', …)

  // ✗
  it('test getInstance', …)
  ```

- **No shared mutable state between tests.** Each `it` block creates its own
  fixtures; `beforeEach` resets mocks.

- **Fake implementations** (e.g. `FakeWhatsappService`) mirror the real service
  interface exactly. When the interface changes, update the fake.

- **Avoid `async` in test callbacks** that have no `await`. Use `() =>` instead.
  Exception: Jest `.rejects` chains require `async () =>` so the thrown error
  becomes a rejected Promise — mark with `// eslint-disable-next-line @typescript-eslint/require-await`.

---

## Linting & Formatting

- Prettier is enforced on commit. Run `npx prettier --write "src/**/*.ts" "test/**/*.ts"`.
- ESLint uses `tsconfig.eslint.json` (includes spec + test files, excludes `src/generated/**`).
- No auto-fixable lint errors should reach the `dev` or `main` branches.
- `src/generated/**/*` is excluded from linting (Prisma client output — never edit manually).

---

## Environment Variables

| Variable                      | Required | Default                        | Notes                          |
|-------------------------------|----------|--------------------------------|--------------------------------|
| `DATABASE_URL`                | ✓        | —                              | Postgres connection string     |
| `JWT_SECRET`                  | ✓        | dev-placeholder (not prod)     | Must be strong in production   |
| `APP_KEY`                     | ✓        | —                              | API key signing secret         |
| `REDIS_URL`                   | ✓        | `redis://localhost:6379`       | —                              |
| `PORT`                        | —        | `3000`                         | —                              |
| `SWAGGER_ENABLED`             | —        | `true` (non-prod)              | Set `false` in production      |
| `WEBHOOK_ALLOW_PRIVATE_HOSTS` | —        | `false`                        | Dev only — enables localhost webhooks |
| `BASE_URL`                    | —        | `http://localhost:PORT`        | Used for upload URL generation |

Never commit `.env` files. Never log secrets.

---

## Security Rules

- **SSRF**: All webhook URLs are validated before delivery (DNS resolution +
  private-range block). The validator runs twice: at config time and at dispatch time.
- **API Keys**: Stored as bcrypt hashes. Plaintext is shown once on creation.
- **JWT**: Short-lived. Secret must not equal `DEV_JWT_SECRET_PLACEHOLDER` in production.
- **Input validation**: All controller DTOs use class-validator. Invalid requests
  are rejected at the boundary with HTTP 422.
- **No parameterized SQL** directly — all queries go through Prisma's type-safe API.

---

## Inviolable Rules

1. Controllers never import `WhatsappService`, `WebhookService`, or `ChatStoreService` directly. Use `InstancesService` as the facade.
2. Never edit `src/generated/**`. It is regenerated by `npx prisma generate`.
3. No `async` on methods without `await`. Use `Promise.resolve()` for sync-but-Promise-typed returns.
4. All Promise-returning event callbacks must use `void` operator.
5. Unused parameters must be prefixed with `_`.
6. No file-wide `eslint-disable`. Use line-level disables with a comment explaining why.
7. No hardcoded secrets, tokens, or credentials anywhere in source.
8. No `console.log` in production code paths. Use NestJS `Logger`.
9. E2E tests clean up after themselves. Never leave dirty state in the test database.
10. `FakeWhatsappService` in `test/helpers/` must stay in sync with `WhatsappService`'s public interface.
