# PRD — Papagai: Multi-instance WhatsApp Gateway
**Spec:** `tasks/specs/spec-1-papagai-whatsapp-gateway.md`

---

## BDD Scenarios

### Feature: Instance Management

**Scenario 1 — Create a new instance**
```
Given no instance named "meuPapagai" exists
When POST /instances/create with {"name": "meuPapagai"}
Then response 201 with {success: true, instance: "meuPapagai"}
And a Baileys socket is initiated for that instance
And auth state directory ./instances/meuPapagai/ is created
```

**Scenario 2 — Reject duplicate instance name**
```
Given an instance named "meuPapagai" already exists
When POST /instances/create with {"name": "meuPapagai"}
Then response 400 with an error message indicating name conflict
```

**Scenario 3 — Get QR code before scan**
```
Given instance "meuPapagai" exists and QR has been generated
When GET /instances/meuPapagai/qr
Then response 200 with {qr: "...", status: "pending", instance: "meuPapagai"}
```

**Scenario 4 — Get connected status after scan**
```
Given instance "meuPapagai" is connected (QR was scanned)
When GET /instances/meuPapagai/qr
Then response 200 with {status: "connected", phoneNumber: "..."}
```

**Scenario 5 — List all instances**
```
Given instances "papagai1" and "papagai2" exist
When GET /instances
Then response 200 with {total: 2, instances: [{name, connected, startTime}, ...]}
```

**Scenario 6 — Get instance status**
```
Given instance "meuPapagai" is connected
When GET /instances/meuPapagai/status
Then response 200 with {name, connected, startTime, uptime, phoneNumber}
```

**Scenario 7 — Get status of non-existent instance**
```
Given no instance named "ghost" exists
When GET /instances/ghost/status
Then response 404
```

**Scenario 8 — Disconnect instance**
```
Given instance "meuPapagai" exists
When DELETE /instances/meuPapagai
Then the socket is closed
And instance is removed from the registry
And response 200 with success message
```

**Scenario 9 — Delete non-existent instance**
```
Given no instance named "ghost" exists
When DELETE /instances/ghost
Then response 404
```

---

### Feature: Outbound Messaging

**Scenario 10 — Send text message**
```
Given instance "meuPapagai" is connected
When POST /instances/meuPapagai/send/text with {"to": "5511999999999", "text": "Olá"}
Then the message is sent via Baileys socket
And response 200 with {success: true, messageId: "..."}
```

**Scenario 11 — Send text to disconnected instance**
```
Given instance "meuPapagai" exists but is not connected
When POST /instances/meuPapagai/send/text with {"to": "...", "text": "Olá"}
Then response 400 with message indicating instance is not connected
```

**Scenario 12 — Send buttons message**
```
Given instance "meuPapagai" is connected
When POST /instances/meuPapagai/send/buttons with title, buttons array [{id, text}], and footer
Then response 200 with {success: true, messageId: "..."}
```

**Scenario 13 — Send image from HTTP URL**
```
Given instance "meuPapagai" is connected
When POST /instances/meuPapagai/send/image with {"to": "...", "url": "https://...", "caption": "foto"}
Then the image is downloaded and sent via Baileys
And response 200 with {success: true, messageId: "..."}
```

**Scenario 14 — Send voice note**
```
Given instance "meuPapagai" is connected
When POST /instances/meuPapagai/send/voice with {"to": "...", "url": "https://..."}
Then audio is sent with ptt: true (voice note format)
And response 200 with {success: true, messageId: "..."}
```

**Scenario 15 — Send location**
```
Given instance "meuPapagai" is connected
When POST /instances/meuPapagai/send/location with valid lat/lng
Then response 200 with {success: true, messageId: "..."}
```

**Scenario 16 — Send reaction to a message**
```
Given instance "meuPapagai" is connected
When POST /instances/meuPapagai/send/reaction with {to, messageId, reaction: "👍"}
Then a reaction message is sent referencing the original messageId
And response 200 with {success: true, messageId: "..."}
```

---

### Feature: Inbound Message Handling & Webhooks

**Scenario 17 — Webhook sent on text message receipt**
```
Given instance "meuPapagai" has webhookUrl configured
When a text message arrives from "5511999999999"
Then a POST is made to webhookUrl
And body contains {event: "message", instance: "meuPapagai", from: "5511999999999", messageType: "text", text: "..."}
And headers include X-Papagai-Instance and X-Papagai-Event
```

**Scenario 18 — Webhook sent on image message receipt**
```
Given instance "meuPapagai" has webhookUrl configured
When an image message arrives
Then the image is downloaded to ./media/
And webhook body contains {event: "message", messageType: "image", image: {url: "/media/...", mimetype: "..."}}
```

**Scenario 19 — Webhook sent on QR generation**
```
Given instance "meuPapagai" has webhookUrl configured
When Baileys generates a QR code
Then webhook body contains {event: "qr", instance: "meuPapagai", qr: "..."}
```

**Scenario 20 — Webhook sent on connection**
```
Given instance "meuPapagai" has webhookUrl configured
When the WhatsApp connection status becomes "open"
Then webhook body contains {event: "connected", phoneNumber: "..."}
```

**Scenario 21 — Webhook failure is silent**
```
Given instance "meuPapagai" has webhookUrl pointing to an unreachable server
When any event occurs (message, connect, etc.)
Then the error is logged but no exception propagates
And the application continues running normally
```

**Scenario 22 — No webhook if webhookUrl is null**
```
Given instance "meuPapagai" was created without a webhookUrl
When a message is received
Then no HTTP request is made
```

---

### Feature: Auto-reconnect

**Scenario 23 — Auto-reconnect on non-logout disconnect**
```
Given instance "meuPapagai" is connected
When connection closes with a non-logout status code
Then {event: "disconnected", willReconnect: true} webhook is sent
And after ~5 seconds the socket is recreated and reconnects
```

**Scenario 24 — No reconnect on logout**
```
Given instance "meuPapagai" is connected
When connection closes with loggedOut reason
Then {event: "disconnected", willReconnect: false} webhook is sent
And the instance is removed from the registry permanently
```

---

### Feature: Contact & Chat Info

**Scenario 25 — Get contact information**
```
Given instance "meuPapagai" is connected
When GET /instances/meuPapagai/contact/5511999999999
Then response 200 with {phoneNumber, pushName, verifiedName, isBusiness, profilePicture, status}
```

**Scenario 26 — Get chats list**
```
Given instance "meuPapagai" is connected
When GET /instances/meuPapagai/chats
Then response 200 with {instance: "meuPapagai", total: N, chats: [{phoneNumber, pushName, unreadCount, ...}]}
```

---

### Feature: Error Handling

**Scenario 27 — Invalid request body returns structured 400**
```
Given the API is running
When POST /instances/create with {"name": "ab"} (too short)
Then response 400 from ValidationPipe
And body contains {statusCode: 400, timestamp, path, message}
```

**Scenario 28 — HttpException returns structured error response**
```
Given the API is running
When an HttpException is thrown in any handler (e.g. NotFoundException, BadRequestException)
Then HttpExceptionFilter returns {statusCode, timestamp, path, message, error}
And the response status code matches the exception's status
```
> Note: `@Catch(HttpException)` only intercepts NestJS `HttpException` subclasses. Raw `Error` throws fall through to NestJS's default handler. If catch-all behavior is needed, use `@Catch()` with no argument — decide at ICT-3 implementation time.

---

## Implementation Tasks

> Tasks are ordered by dependency. Each task is independently implementable once its dependencies are complete.
> Sizes: S = < 50 lines, M = 50–150 lines, L = > 150 lines

---

### Phase 1 — Foundation

#### ICT-1 [S] Update package.json with all dependencies
**Scenarios:** All (build prerequisite)
**Description:** Add required production and dev dependencies to `package.json`. Do NOT run `npm install` — just update the file. The executor skill will handle install.
**File:** `package.json`
**Changes:**
- Add to `dependencies`: `@nestjs/config ^3.2.0`, `@nestjs/axios ^3.0.2`, `@nestjs/schedule ^4.1.0`, `@whiskeysockets/baileys ^6.7.0`, `@hapi/boom ^10.0.1`, `axios ^1.7.2`, `class-validator ^0.14.1`, `class-transformer ^0.5.1`, `multer ^1.4.5-lts.1`, `uuid ^10.0.0`
- Add to `devDependencies`: `@types/multer ^1.4.12`, `@types/uuid ^10.0.0`
- **Do NOT add** `qrcode-terminal` or `pino` — QR codes are delivered via webhook (not printed to terminal) and NestJS `Logger` is used throughout, making both packages dead weight

---

#### ICT-2 [S] Create config/configuration.ts
**Scenarios:** All (config prerequisite)
**Description:** Config factory that maps env vars to a typed object consumed by `ConfigService`.
**File:** `src/config/configuration.ts`
**Output:**
```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mediaDir: process.env.MEDIA_DIR || './media',
  instancesDir: process.env.INSTANCES_DIR || './instances',
  defaultWebhook: process.env.DEFAULT_WEBHOOK || null,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024,
  maxInstances: parseInt(process.env.MAX_INSTANCES, 10) || 10,
  logLevel: process.env.LOG_LEVEL || 'debug',
});
```

---

#### ICT-3 [S] Create common/filters/http-exception.filter.ts
**Scenarios:** 27, 28
**Description:** Global exception filter. Use `@Catch(HttpException)` to handle NestJS HTTP exceptions. Logs method+url+status, returns structured JSON. If catch-all behavior (covering raw `Error` throws) is preferred, use `@Catch()` instead — either is acceptable, but the choice must be consistent with Scenario 28.
**File:** `src/common/filters/http-exception.filter.ts`
**Response shape:** `{statusCode, timestamp (ISO), path, message, error}`

---

#### ICT-4 [S] Create common/interceptors/logging.interceptor.ts
**Scenarios:** All (observability)
**Description:** Global interceptor. Logs `METHOD /url - Nms` after each request completes using `tap`.
**File:** `src/common/interceptors/logging.interceptor.ts`

---

### Phase 2 — Type Definitions

#### ICT-5 [S] Create whatsapp/interfaces/whatsapp.interface.ts
**Scenarios:** All (type prerequisite)
**Description:** Define all shared interfaces: `Instance`, `Button`, `MediaFile`, `WebhookData`, `ChatInfo`, `ContactInfo`.
**File:** `src/whatsapp/interfaces/whatsapp.interface.ts`
**Key note:** `Instance.socket` is typed as `WASocket` from `@whiskeysockets/baileys`.

---

### Phase 3 — Webhook Module

#### ICT-6 [S] Create webhook/webhook.service.ts
**Scenarios:** 17–22
**Description:** Injectable service. Single method `sendWebhook(instance, data)`. Uses `HttpService` (from `@nestjs/axios`). POSTs to `instance.webhookUrl` with standard headers + custom headers. Timeout 5000ms. Errors caught and logged, never thrown.
**File:** `src/webhook/webhook.service.ts`
**Depends on:** ICT-5

---

#### ICT-7 [S] Create webhook/webhook.controller.ts
**Scenarios:** (test utility)
**Description:** `@Controller('webhook-test')`. Single `POST /webhook-test` endpoint that logs body+headers and returns `{received: true, timestamp, message}`. No authentication needed.
**File:** `src/webhook/webhook.controller.ts`

---

#### ICT-8 [S] Create webhook/webhook.module.ts
**Scenarios:** N/A (wiring)
**Description:** Module importing `HttpModule`, providing `WebhookService` and `WebhookController`, exporting `WebhookService`.
**File:** `src/webhook/webhook.module.ts`
**Depends on:** ICT-6, ICT-7

---

### Phase 4 — WhatsApp Core

#### ICT-9 [L] Create whatsapp/whatsapp.service.ts
**Scenarios:** 1–26 (core service)
**Description:** The central service. Implements `OnModuleDestroy`. Contains:
- `instances: Map<string, Instance>` and `qrCodes: Map<string, string>` as private state
- `createInstance(name, webhookUrl?, webhookHeaders?)` — creates Baileys socket, registers event handlers
- `handleIncomingMessage(instance, msg)` — dispatches to webhook with fully populated `WebhookData`
- `downloadMedia(msg, type)` — downloads to `./media/`, returns `MediaFile`
- `sendWebhook(instance, data)` — delegates to `WebhookService`
- `reconnectInstance(name)` — called after 5s delay on non-logout close
- All `send*` methods (text, buttons, image, audio, voice, video, document, sticker, location, reaction)
- `getContactInfo`, `getChats`, `getInstance`, `getQR`, `getInstances`, `disconnectInstance`
- `onModuleDestroy` — closes all sockets

**File:** `src/whatsapp/whatsapp.service.ts`
**Depends on:** ICT-5, ICT-6

**Baileys config notes:**
```typescript
makeWASocket({
  auth: state,
  printQRInTerminal: false,
  browser: [`Papagai-${name}`, 'Chrome', '120.0.0.0'],
  syncFullHistory: false,
  markOnlineOnConnect: true,
  defaultQueryTimeoutMs: 60000,
  generateHighQualityLinkPreview: true,
  patchMessageBeforeSending: (msg) => { /* deep clone if has buttons/media */ }
})
```

**Media download:** use `downloadContentFromMessage` from baileys, write stream chunks to file.

**JID normalization:** `to.includes('@') ? to : `${to}@s.whatsapp.net``

---

#### ICT-10 [S] Create whatsapp/whatsapp.module.ts
**Scenarios:** N/A (wiring)
**Description:** Module importing `HttpModule` and `WebhookModule`, providing `WhatsappService`, exporting `WhatsappService`.
**File:** `src/whatsapp/whatsapp.module.ts`
**Depends on:** ICT-8, ICT-9

---

### Phase 5 — Instances Module

#### ICT-11 [S] Create instances/dto/create-instance.dto.ts
**Scenarios:** 1, 2, 27
**Description:** `CreateInstanceDto` with `class-validator` decorators:
- `name`: `@IsString`, `@MinLength(3)`, `@MaxLength(30)` — required
- `webhook`: `@IsOptional`, `@IsUrl({ require_tld: false })` — optional
- `webhookHeaders`: `@IsOptional`, `@IsObject()` — optional, `Record<string, string>`

**File:** `src/instances/dto/create-instance.dto.ts`

---

#### ICT-12 [S] Create instances/dto/send-message.dto.ts
**Scenarios:** 10–16
**Description:** Multiple DTOs in one file:
- `ButtonDto`: `{id: string, text: string}`
- `SendTextDto`: `{to, text, options?}`
- `SendButtonsDto`: `{to, title, buttons: ButtonDto[], footer?}`
- `SendMediaDto`: `{to, url, caption?}` — used for image/audio/voice/video/sticker
- `SendReactionDto`: `{to, messageId, reaction}`
- `SendLocationDto`: `{to, latitude (@Min(-90) @Max(90)), longitude (@Min(-180) @Max(180)), name?, address?}`

All use `class-validator` decorators.
**File:** `src/instances/dto/send-message.dto.ts`

---

#### ICT-13 [S] Create instances/instances.service.ts
**Scenarios:** 1–26
**Description:** Thin delegation layer. Injects `WhatsappService`. Each method logs with `Logger` then delegates. No business logic here.
**File:** `src/instances/instances.service.ts`
**Methods:** `createInstance`, `getInstance`, `getQR`, `sendText`, `sendButtons`, `sendImage`, `sendAudio`, `sendVoice`, `sendVideo`, `sendDocument`, `sendSticker`, `sendLocation`, `sendReaction`, `getContactInfo`, `getChats`, `getInstances`, `disconnectInstance`
**Depends on:** ICT-9

---

#### ICT-14 [L] Create instances/instances.controller.ts
**Scenarios:** 1–18, 25–26
**Description:** `@Controller('instances')`. Maps all REST endpoints. Catches errors and re-throws as `HttpException`. Returns consistent success shapes with emoji messages.
**File:** `src/instances/instances.controller.ts`
**Key endpoints and return shapes:**
- `POST /create` → `{success, instance, message}`
- `GET /:name/qr` → `{qr?, status, instance?, phoneNumber?, message}` or 404
- `POST /:name/send/*` → `{success, messageId, message}` or 400
- `GET /:name/status` → `{name, connected, startTime, uptime, phoneNumber}` or 404
- `GET /` → `{total, instances, message}`
- `DELETE /:name` → `{message, instance}` or 404
- `GET /:name/contact/:number` → contact info object
- `GET /:name/chats` → `{instance, total, chats}`

**Depends on:** ICT-12, ICT-13

---

#### ICT-15 [S] Create instances/instances.module.ts
**Scenarios:** N/A (wiring)
**Description:** Module importing `WhatsappModule`, providing `InstancesService` and `InstancesController`, exporting `InstancesService`.
**File:** `src/instances/instances.module.ts`
**Depends on:** ICT-10, ICT-13, ICT-14

---

### Phase 6 — Media Module

#### ICT-16 [S] Create media/media.service.ts
**Scenarios:** N/A (placeholder)
**Description:** Empty `@Injectable()` class. Placeholder for future media management logic (cleanup, conversion, etc.).
**File:** `src/media/media.service.ts`

---

#### ICT-17 [S] Create media/media.module.ts
**Scenarios:** N/A (wiring)
**Description:** Module providing and exporting `MediaService`.
**File:** `src/media/media.module.ts`
**Depends on:** ICT-16

---

### Phase 7 — Tests

#### ICT-20 [S] Unit tests for HttpExceptionFilter
**Scenarios:** 27, 28
**Description:** Test the filter in isolation using a mock `ArgumentsHost`. Verify:
- Response body shape: `{statusCode, timestamp, path, message, error}`
- `timestamp` is a valid ISO string
- Status code on response matches the exception's status
- Error message is correctly extracted from both string and object exception responses

**File:** `src/common/filters/http-exception.filter.spec.ts`
**Depends on:** ICT-3

---

#### ICT-21 [S] Unit tests for WebhookService
**Scenarios:** 17, 21, 22
**Description:** Test webhook delivery logic using a mock `HttpService`. Verify:
- POST is made to `instance.webhookUrl` with `X-Papagai-Instance` and `X-Papagai-Event` headers
- Custom `webhookHeaders` are merged into the request headers
- When `webhookUrl` is `null`, no HTTP request is made (Scenario 22)
- When the HTTP call throws, the error is caught and not re-thrown (Scenario 21)

**File:** `src/webhook/webhook.service.spec.ts`
**Depends on:** ICT-6

---

#### ICT-22 [S] Unit tests for DTO validation
**Scenarios:** 2, 27
**Description:** Use `plainToInstance` + `validate()` from `class-validator` to test constraints without booting the app. Verify:
- `CreateInstanceDto`: `name` < 3 chars fails, `name` > 30 chars fails, valid name passes, invalid URL for `webhook` fails
- `SendLocationDto`: latitude outside [-90, 90] fails, longitude outside [-180, 180] fails, valid values pass
- `ButtonDto`: both `id` and `text` required

**File:** `src/instances/dto/create-instance.dto.spec.ts`
**Depends on:** ICT-11, ICT-12

---

#### ICT-23 [M] Unit tests for InstancesController
**Scenarios:** 1–16, 25–26, 7, 9
**Description:** Test the controller in isolation using a mock `InstancesService` (jest mock). Cover:
- `POST /create`: success shape `{success, instance, message}`, and that errors from service are re-thrown as `HttpException`
- `GET /:name/qr`: returns QR shape when QR present, connected shape when connected, 404 when instance missing
- `GET /:name/status`: success shape with all fields, 404 for missing instance
- `DELETE /:name`: success shape, 404 for missing instance
- `POST /:name/send/text`: success shape with `messageId`, 400 when service throws
- `GET /:name/chats`: returns `{instance, total, chats}` shape
- `GET /:name/contact/:number`: returns contact info

**File:** `src/instances/instances.controller.spec.ts`
**Depends on:** ICT-13, ICT-14

---

#### ICT-24 [S] Unit tests for WhatsappService non-Baileys logic
**Scenarios:** 2, 8, 22, 24
**Description:** Test the parts of `WhatsappService` that don't require a live Baileys connection. Mock `makeWASocket` at the module level. Verify:
- `createInstance` throws when an instance with that name already exists (Scenario 2)
- `getInstances()` returns the correct shape from the internal Map
- `getQR(name)` returns null when no QR is stored
- `disconnectInstance(name)` returns `false` when instance doesn't exist (Scenario 9 equivalent)
- `disconnectInstance(name)` removes instance from Map and returns `true` when it exists (Scenario 8)
- Webhook is NOT called when `webhookUrl` is null (Scenario 22)

**Note:** For `createInstance` with a mocked socket, stub the event handlers (`.ev.on`) so they don't fire.

**File:** `src/whatsapp/whatsapp.service.spec.ts`
**Depends on:** ICT-9

---

#### ICT-25 [S] E2e test for validation error shape
**Scenarios:** 27
**Description:** Boot the full NestJS app with `supertest`. Send a request that will fail `ValidationPipe`, assert the response body matches `{statusCode: 400, timestamp, path, message}`.
- `POST /instances/create` with `{"name": "ab"}` → expect 400 with structured body
- Assert `timestamp` is present (ISO format)
- Assert `path` is `/instances/create`

**File:** `test/validation.e2e-spec.ts`
**Depends on:** ICT-18, ICT-19

---

### Phase 8 — Wiring

#### ICT-18 [S] Update app.module.ts
**Scenarios:** All (root module)
**Description:** Replace the bare scaffold with full wiring. Remove `AppController` and `AppService` references.
**File:** `src/app.module.ts`
**Imports:** `ConfigModule.forRoot({load: [configuration], isGlobal: true, envFilePath: ['.env', '.env.local']})`, `ScheduleModule.forRoot()`, `InstancesModule`, `WebhookModule`, `MediaModule`
**Depends on:** ICT-2, ICT-8, ICT-15, ICT-17

---

#### ICT-19 [S] Update main.ts
**Scenarios:** 27, 28 (global pipes/filters), all (CORS, static)
**Description:** Replace minimal bootstrap with full setup:
- `NestFactory.create<NestExpressApplication>(AppModule)`
- `useGlobalPipes(new ValidationPipe({whitelist: true, transform: true, forbidNonWhitelisted: false}))`
- `useGlobalFilters(new HttpExceptionFilter())`
- `useGlobalInterceptors(new LoggingInterceptor())`
- `enableCors({origin: '*', methods: [...], credentials: true})`
- `useStaticAssets(join(__dirname, '..', 'media'), {prefix: '/media/'})`
- `app.listen(port)` where port from `process.env.PORT || 3000`
- Console art banner on startup

**File:** `src/main.ts`
**Depends on:** ICT-3, ICT-4, ICT-18

---

## Task Summary

| ID | Size | File | Phase |
|---|---|---|---|
| ICT-1 | S | `package.json` | Foundation |
| ICT-2 | S | `src/config/configuration.ts` | Foundation |
| ICT-3 | S | `src/common/filters/http-exception.filter.ts` | Foundation |
| ICT-4 | S | `src/common/interceptors/logging.interceptor.ts` | Foundation |
| ICT-5 | S | `src/whatsapp/interfaces/whatsapp.interface.ts` | Types |
| ICT-6 | S | `src/webhook/webhook.service.ts` | Webhook |
| ICT-7 | S | `src/webhook/webhook.controller.ts` | Webhook |
| ICT-8 | S | `src/webhook/webhook.module.ts` | Webhook |
| ICT-9 | L | `src/whatsapp/whatsapp.service.ts` | WhatsApp Core |
| ICT-10 | S | `src/whatsapp/whatsapp.module.ts` | WhatsApp Core |
| ICT-11 | S | `src/instances/dto/create-instance.dto.ts` | Instances |
| ICT-12 | S | `src/instances/dto/send-message.dto.ts` | Instances |
| ICT-13 | S | `src/instances/instances.service.ts` | Instances |
| ICT-14 | L | `src/instances/instances.controller.ts` | Instances |
| ICT-15 | S | `src/instances/instances.module.ts` | Instances |
| ICT-16 | S | `src/media/media.service.ts` | Media |
| ICT-17 | S | `src/media/media.module.ts` | Media |
| ICT-18 | S | `src/app.module.ts` | Wiring |
| ICT-19 | S | `src/main.ts` | Wiring |
| ICT-20 | S | `src/common/filters/http-exception.filter.spec.ts` | Tests |
| ICT-21 | S | `src/webhook/webhook.service.spec.ts` | Tests |
| ICT-22 | S | `src/instances/dto/create-instance.dto.spec.ts` | Tests |
| ICT-23 | M | `src/instances/instances.controller.spec.ts` | Tests |
| ICT-24 | S | `src/whatsapp/whatsapp.service.spec.ts` | Tests |
| ICT-25 | S | `test/validation.e2e-spec.ts` | Tests |

**Totals:** 25 tasks — S: 21, M: 1, L: 3

---

## Dependency Graph

```
ICT-1 (pkg.json) ──────────────────────────────────────────┐
ICT-2 (config) ─────────────────────────────────┐          │
ICT-3 (filter) ──────────────────────────────────────────┐ │
ICT-4 (interceptor) ─────────────────────────────────────┤ │
ICT-5 (interfaces) ─┬──────────────────────────┐         │ │
ICT-6 (webhook.svc) ┘                           │         │ │
ICT-7 (webhook.ctrl)─┐                          │         │ │
ICT-8 (webhook.mod) ─┴─────────────────┐        │         │ │
ICT-9 (wa.service) ←── ICT-5, ICT-6   │        │         │ │
ICT-10 (wa.module) ←── ICT-8, ICT-9   │        │         │ │
ICT-11 (create.dto)─┐                  │        │         │ │
ICT-12 (send.dto) ──┤                  │        │         │ │
ICT-13 (inst.svc) ──┤← ICT-9          │        │         │ │
ICT-14 (inst.ctrl) ─┤← ICT-12,ICT-13 │        │         │ │
ICT-15 (inst.mod) ──┘← ICT-10,13,14  │        │         │ │
ICT-16 (media.svc)─┐                  │        │         │ │
ICT-17 (media.mod)─┘                  │        │         │ │
ICT-18 (app.mod) ←── ICT-2,8,15,17   │        │         │ │
ICT-19 (main.ts) ←── ICT-3,4,18      └────────┘         └─┘
ICT-20 (filter.spec) ←── ICT-3
ICT-21 (webhook.spec) ←── ICT-6
ICT-22 (dto.spec) ←── ICT-11, ICT-12
ICT-23 (ctrl.spec) ←── ICT-13, ICT-14
ICT-24 (wa.service.spec) ←── ICT-9
ICT-25 (e2e.spec) ←── ICT-18, ICT-19
```

## Notes for Executor

1. **Delete `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`** — these are scaffold files not part of the design
2. **Create `.env`** from the template in the spec before running the app
3. **Run `npm install`** after ICT-1 before implementing anything else
4. **ICT-9 is the critical path** — the largest task (~300+ lines); keep each method under 40 lines; extract a `fetchBuffer(url)` helper to avoid repeating the HTTP/fs fetch logic in every send* method
5. **Baileys testability (ICT-24)**: `makeWASocket` must be mockable. In `WhatsappService`, call it through a thin wrapper or factory so tests can stub it. At minimum, mock the module: `jest.mock('@whiskeysockets/baileys', () => ({ default: jest.fn(), ... }))`
6. **Baileys import**: use `import makeWASocket, { ... } from '@whiskeysockets/baileys'` (default + named imports)
7. **Node.js 18+** required; verify before running
8. **Tests run from project root**: `npm test` (unit) and `npm run test:e2e` (e2e). ICT-25 needs the app to bind a real port — use `app.listen(0)` for a random port in e2e setup
