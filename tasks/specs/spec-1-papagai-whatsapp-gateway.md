# Spec 1 — Papagai: Multi-instance WhatsApp Gateway

## Summary

Build a NestJS REST API (Papagai) that manages multiple WhatsApp connections simultaneously using the Baileys library. The system handles outbound messaging of all media types, receives inbound messages and delivers them to a configured webhook URL per instance, and persists auth state to disk so connections survive restarts.

---

## Context

- **Project**: `papagai` — NestJS 11 app scaffolded with `nest new`
- **Current state**: Bare scaffold only (`main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`)
- **Source design**: DeepSeek conversation in `reference/conversation.md`
- **WhatsApp library**: `@whiskeysockets/baileys` ^6.7.0 (multi-device)

---

## Functional Requirements

### FR-1: Instance Management
- Create a named WhatsApp instance with optional webhook URL and headers
- Duplicate instance names are rejected with a 400 error
- Each instance maintains its own Baileys socket and auth state on disk at `./instances/<name>/`
- List all instances with name, connection status, and start time
- Get QR code (base64) for unauthenticated instances, or connection status if already connected
- Get detailed status of a single instance (name, connected, uptime, phone number)
- Disconnect and remove an instance, closing its socket

### FR-2: Outbound Messaging
The following message types can be sent to any `to` number (accepts plain numbers or JIDs):
- **Text** — plain text with optional extra options
- **Buttons** — title + array of `{id, text}` buttons + optional footer
- **Image** — URL or local path, optional caption
- **Audio** — URL or local path, sent as audio file
- **Voice** — URL or local path, sent as voice note (PTT)
- **Video** — URL or local path, optional caption
- **Document** — URL or local path, filename, optional caption
- **Sticker** — URL or local path (WebP)
- **Location** — latitude, longitude, optional name and address
- **Reaction** — emoji reaction to a specific message ID

All outbound requests fail with 400 if the instance is not connected.

### FR-3: Inbound Message Handling
- Receive all incoming messages (non-fromMe only)
- Identify message type: text, image, audio, voice, video, document, sticker, location, contact, button_response, list_response, reaction, unknown
- For media messages: download content to `./media/` directory and expose URL via static serving at `/media/` prefix
- Deliver a structured `WebhookData` payload to the instance's configured webhook URL

### FR-4: Webhook Delivery
- On events: `qr`, `connected`, `disconnected`, `message`, `message_update`
- POST to `instance.webhookUrl` with headers including `X-Papagai-Instance` and `X-Papagai-Event`
- Additional custom headers from `webhookHeaders` config
- 5-second timeout; errors are logged and swallowed (fire-and-forget)
- No webhook is sent if `webhookUrl` is null

### FR-5: Auto-reconnect
- On connection close: if disconnect reason is NOT `loggedOut`, reconnect after 5 seconds by recreating the socket
- If reason IS `loggedOut`, remove instance from registry permanently

### FR-6: Contact & Chat Info
- Get contact info (phone, push name, verified name, business flag, profile picture URL, status message)
- List all chats (phone number, push name, unread count, last message, timestamp, isGroup)
- Optional `include_messages=true` query param on chats endpoint (accepted, passed through)

### FR-7: Media Directory Setup
- On startup, ensure `./media/` directory exists
- Static files served at `/media/` URL prefix

### FR-8: Test Webhook Endpoint
- `POST /webhook-test` — logs received body and headers, returns `{received: true, timestamp, message}`

---

## Non-Functional Requirements

- **Validation**: Global `ValidationPipe` with `whitelist: true`, `transform: true`, `forbidNonWhitelisted: false`
- **Error format**: Global `HttpExceptionFilter` returns `{statusCode, timestamp, path, message, error}`
- **Logging**: Global `LoggingInterceptor` logs `METHOD /path - Nms` per request; `Logger` per service
- **CORS**: All origins, all standard methods, credentials allowed
- **Config**: Environment variables loaded via `@nestjs/config` from `.env` and `.env.local`
- **Lifecycle**: `OnModuleDestroy` closes all sockets gracefully on shutdown
- **Max instances**: Configurable via `MAX_INSTANCES` env (default 10) — tracked but not enforced in v1
- **Node.js**: 18+ required (Baileys constraint)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment |
| `MEDIA_DIR` | `./media` | Directory for downloaded media |
| `INSTANCES_DIR` | `./instances` | Directory for auth state |
| `DEFAULT_WEBHOOK` | `null` | Default webhook URL (optional) |
| `MAX_FILE_SIZE` | `52428800` | Max upload size (bytes) |
| `MAX_INSTANCES` | `10` | Max concurrent instances |
| `LOG_LEVEL` | `debug` | Log level |

---

## Module Structure

```
src/
├── main.ts                          # Bootstrap with pipes, filters, interceptors, CORS, static
├── app.module.ts                    # Root module: ConfigModule, ScheduleModule, feature modules
├── config/
│   └── configuration.ts            # Config factory (env → typed object)
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       └── logging.interceptor.ts
├── whatsapp/
│   ├── interfaces/
│   │   └── whatsapp.interface.ts   # Instance, Button, MediaFile, WebhookData, ChatInfo, ContactInfo
│   ├── whatsapp.service.ts         # Core: socket management, send, receive, webhook, media
│   └── whatsapp.module.ts
├── webhook/
│   ├── webhook.service.ts          # HTTP POST to webhookUrl
│   ├── webhook.controller.ts       # POST /webhook-test
│   └── webhook.module.ts
├── instances/
│   ├── dto/
│   │   ├── create-instance.dto.ts  # name (3-30 chars), webhook?, webhookHeaders?
│   │   └── send-message.dto.ts     # SendTextDto, SendButtonsDto, SendMediaDto, SendReactionDto, SendLocationDto, ButtonDto
│   ├── instances.service.ts        # Thin delegation to WhatsappService
│   ├── instances.controller.ts     # All /instances/* endpoints
│   └── instances.module.ts
└── media/
    ├── media.service.ts            # Placeholder (expandable)
    └── media.module.ts
```

---

## Key Interfaces

```typescript
interface Instance {
  socket: WASocket;
  webhookUrl: string | null;
  webhookHeaders: Record<string, string>;
  name: string;
  connected: boolean;
  qr: string | null;
  saveCreds: () => Promise<void>;
  startTime: number;
}

interface Button { id: string; text: string; }

interface MediaFile {
  path: string; url: string; filename: string;
  mimetype: string; size: number; caption?: string | null; duration?: number;
}

interface WebhookData {
  event: string; instance: string; from?: string; pushName?: string;
  messageId?: string; messageType?: string; text?: string; timestamp?: number;
  isGroup?: boolean; groupId?: string | null;
  image?: MediaFile; audio?: MediaFile; voice?: MediaFile;
  video?: MediaFile; document?: MediaFile; sticker?: MediaFile;
  location?: { degreesLatitude: number; degreesLongitude: number; name?: string; address?: string; };
  contact?: { displayName: string; vcard: string; numbers: string[]; };
  buttonId?: string; selectedRowId?: string; reaction?: string;
  parentMessageId?: string; caption?: string | null; duration?: number;
  filename?: string; qr?: string; phoneNumber?: string; reason?: string;
  willReconnect?: boolean; updates?: any;
}
```

---

## API Endpoints

| Method | Path | Body/Params | Description |
|---|---|---|---|
| POST | `/instances/create` | `CreateInstanceDto` | Create instance |
| GET | `/instances` | — | List all instances |
| GET | `/instances/:name/qr` | — | QR code or connection status |
| GET | `/instances/:name/status` | — | Instance status |
| DELETE | `/instances/:name` | — | Disconnect instance |
| POST | `/instances/:name/send/text` | `SendTextDto` | Send text |
| POST | `/instances/:name/send/buttons` | `SendButtonsDto` | Send buttons |
| POST | `/instances/:name/send/image` | `SendMediaDto` | Send image |
| POST | `/instances/:name/send/audio` | `SendMediaDto` | Send audio |
| POST | `/instances/:name/send/voice` | `SendMediaDto` | Send voice note |
| POST | `/instances/:name/send/video` | `SendMediaDto` | Send video |
| POST | `/instances/:name/send/document` | body (any) | Send document |
| POST | `/instances/:name/send/sticker` | `SendMediaDto` | Send sticker |
| POST | `/instances/:name/send/location` | `SendLocationDto` | Send location |
| POST | `/instances/:name/send/reaction` | `SendReactionDto` | Send reaction |
| GET | `/instances/:name/contact/:number` | — | Get contact info |
| GET | `/instances/:name/chats` | `?include_messages=true` | List chats |
| POST | `/webhook-test` | any | Test webhook receiver |

---

## Dependencies to Add

**Production:** `@nestjs/config`, `@nestjs/axios`, `@nestjs/schedule`, `@whiskeysockets/baileys`, `@hapi/boom`, `axios`, `qrcode-terminal`, `pino`, `class-validator`, `class-transformer`, `multer`, `uuid`

**Dev:** `@types/multer`, `@types/uuid`, `@types/qrcode-terminal`

---

## Out of Scope (v1)

- Database persistence of messages or instance metadata
- Message queuing / retry on webhook failure
- Rate limiting
- API key authentication
- Group management (create/join/leave groups)
- Contact list management (add/block/unblock)
- `MAX_INSTANCES` enforcement
- `MediaService` implementation beyond placeholder
