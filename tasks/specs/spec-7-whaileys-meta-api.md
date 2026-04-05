# Spec 7 — whaileys@6.4.9 + Meta Cloud API Payload Format

## Overview

Papagai currently uses `@whiskeysockets/baileys@7.0.0-rc.9` which fails to connect to WhatsApp
servers and lacks native `interactiveMessage` support. This spec migrates to `whaileys@6.4.9` (the
fork used by unoapi-cloud that works reliably), fixes the connection using `fetchLatestWaWebVersion`
with proper headers, and replaces all proprietary send endpoints with a single
`POST /instances/:name/messages` endpoint that accepts the standard Meta Cloud API payload format
— making Papagai a drop-in replacement for any Meta WhatsApp Business API integration.

---

## Context

- **Project**: Papagai — NestJS 11 multi-instance WhatsApp REST gateway
- **Reference implementation**: `/Users/mmendesx/workspace/unoapi-cloud`
- **Key unoapi files**: `src/services/transformer.ts`, `src/services/socket.ts`
- **Existing infrastructure to keep**: Redis auth state, PostgreSQL persistence, webhook delivery,
  `onModuleInit` restoration, Docker Compose stack

---

## Actors

- **API consumers**: Any client that already speaks Meta Cloud API (n8n, ManyChat, custom code)
- **Papagai server**: NestJS app that translates Meta payloads → Baileys calls
- **WhatsApp**: Receives encrypted messages via whaileys socket

---

## Functional Requirements

### FR-1: Replace Baileys package

Replace `@whiskeysockets/baileys@7.0.0-rc.9` with `whaileys@6.4.9` using npm alias:
`"@whiskeysockets/baileys": "npm:whaileys@6.4.9"`. All existing imports from
`@whiskeysockets/baileys` continue to work unchanged (alias is transparent).

### FR-2: Fix WhatsApp connection

Replace `fetchLatestBaileysVersion` with `fetchLatestWaWebVersion` using the exact headers from
unoapi to bypass anti-bot detection:
```typescript
const headers = {
  'sec-fetch-site': 'none',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}
const { version, error } = await fetchLatestWaWebVersion({ headers })
```
Fall back to `fetchLatestBaileysVersion` if `fetchLatestWaWebVersion` returns an error. Add
`shouldResendMessageOn475AckError: true` to socket config.

### FR-3: Single unified send endpoint

Replace all 12 type-specific send endpoints with one:
```
POST /instances/:name/messages
```
Body accepts the standard Meta Cloud API message payload. All existing endpoints
(`/send/text`, `/send/image`, etc.) are **removed**.

### FR-4: Meta Cloud API payload support

The `/messages` endpoint accepts payloads for these `type` values:

| type | Meta payload shape |
|---|---|
| `text` | `{ type: "text", to: "...", text: { body: "..." } }` |
| `image` | `{ type: "image", to: "...", image: { link: "...", caption: "..." } }` |
| `audio` | `{ type: "audio", to: "...", audio: { link: "..." } }` |
| `video` | `{ type: "video", to: "...", video: { link: "...", caption: "..." } }` |
| `document` | `{ type: "document", to: "...", document: { link: "...", filename: "...", caption: "..." } }` |
| `sticker` | `{ type: "sticker", to: "...", sticker: { link: "..." } }` |
| `location` | `{ type: "location", to: "...", location: { latitude: 0, longitude: 0, name: "...", address: "..." } }` |
| `contacts` | `{ type: "contacts", to: "...", contacts: [{ name: { formatted_name: "..." }, phones: [{ phone: "..." }] }] }` |
| `reaction` | `{ type: "reaction", to: "...", reaction: { message_id: "...", emoji: "👍" } }` |
| `interactive` | see FR-5 |

### FR-5: Interactive messages via Meta payload

The `interactive` type supports:

**Buttons (quick_reply)**:
```json
{
  "type": "interactive",
  "to": "5561999990000",
  "interactive": {
    "type": "button",
    "header": { "type": "text", "text": "Header" },
    "body": { "text": "Choose an option" },
    "footer": { "text": "Footer" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_1", "title": "Yes" } },
        { "type": "reply", "reply": { "id": "btn_2", "title": "No" } }
      ]
    }
  }
}
```

**List**:
```json
{
  "type": "interactive",
  "to": "5561999990000",
  "interactive": {
    "type": "list",
    "body": { "text": "Select an option" },
    "action": {
      "button": "View options",
      "sections": [
        { "title": "Plans", "rows": [{ "id": "p1", "title": "Basic", "description": "R$ 29/mo" }] }
      ]
    }
  }
}
```

**CTA URL**:
```json
{
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "body": { "text": "Visit our store" },
    "action": { "name": "cta_url", "parameters": { "display_text": "Open store", "url": "https://..." } }
  }
}
```

**Copy code**:
```json
{
  "type": "interactive",
  "interactive": {
    "type": "cta_copy",
    "body": { "text": "Your Pix key" },
    "action": { "name": "cta_copy", "parameters": { "display_text": "Copy key", "copy_code": "chave@pix.com" } }
  }
}
```

### FR-6: Transformer layer

A pure function `toMessageContent(payload: MetaPayload): AnyMessageContent` in
`src/whatsapp/utils/transformer.ts` handles all type-specific translations from Meta format to
whaileys `AnyMessageContent`. The transformer is the only place that knows about Baileys internals.

### FR-7: Phone number utilities

A utility module `src/whatsapp/utils/jid.ts` exports:
- `phoneNumberToJid(phone: string): string` — converts phone number or existing JID to
  `XXXXXXXXXX@s.whatsapp.net`
- `jidToPhoneNumber(jid: string): string` — extracts bare number from JID
- Uses `awesome-phonenumber` for normalization; handles Brazilian 9th-digit variants

### FR-8: Standardised response format

All send operations return Meta-compatible response:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "5561999990000", "wa_id": "5561999990000" }],
  "messages": [{ "id": "MSGID" }]
}
```

### FR-9: Keep existing instance management endpoints

These are NOT Meta API and stay unchanged:
- `POST /instances/create`
- `GET /instances/:name/qr`
- `GET /instances/:name/status`
- `GET /instances`
- `DELETE /instances/:name`

---

## Technical Requirements

### Architecture

```
HTTP POST /instances/:name/messages
  → InstancesController.sendMessage()
  → transformer.toMessageContent(payload)   ← pure function, no I/O
  → WhatsappService.sendMessage(jid, content)
  → whaileys socket.sendMessage()
  → WhatsApp servers
```

The `WhatsappService` exposes a single generic `send(instanceName, to, content)` method instead
of 12 type-specific methods. All type routing happens in the transformer.

### Dependencies to add

| Package | Version | Purpose |
|---|---|---|
| `awesome-phonenumber` | `^6.8.0` | Phone number parsing/normalisation |

### Packages to change

| From | To |
|---|---|
| `@whiskeysockets/baileys: 7.0.0-rc.9` | `@whiskeysockets/baileys: npm:whaileys@6.4.9` |

### Packages to remove

- `qrcode-terminal` (terminal QR no longer needed)

### Socket config changes

```typescript
// Replace:
fetchLatestBaileysVersion

// With:
fetchLatestWaWebVersion({ headers: { 'sec-fetch-site': 'none', 'user-agent': '...' } })
// + fallback to fetchLatestBaileysVersion on error

// Add to makeWASocket config:
shouldResendMessageOn475AckError: true
```

### Files to create

| File | Purpose |
|---|---|
| `src/whatsapp/utils/transformer.ts` | Meta payload → AnyMessageContent |
| `src/whatsapp/utils/jid.ts` | phoneNumberToJid, jidToPhoneNumber |

### Files to modify

| File | Change |
|---|---|
| `package.json` | Replace baileys, add awesome-phonenumber |
| `src/whatsapp/whatsapp.service.ts` | Replace 12 send methods with `send()`, fix connection |
| `src/instances/instances.service.ts` | Replace 12 proxy methods with `sendMessage()` |
| `src/instances/instances.controller.ts` | Remove 12 endpoints, add `POST :name/messages` |
| `src/instances/dto/send-message.dto.ts` | Replace all DTOs with `MetaMessageDto` |

### Files to delete

| File | Reason |
|---|---|
| `src/instances/dto/send-message.dto.ts` (bulk) | Replaced by single MetaMessageDto |

### API contract

**New endpoint:**
```
POST /instances/:name/messages
Content-Type: application/json

{
  "messaging_product": "whatsapp",  // optional, ignored
  "to": "5561999990000",
  "type": "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contacts" | "reaction" | "interactive",
  // ... type-specific fields
}

→ 200 OK
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "5561999990000", "wa_id": "5561999990000" }],
  "messages": [{ "id": "<messageId>" }]
}

→ 400 Bad Request
{ "statusCode": 400, "message": "...", "error": "HttpException" }
```

---

## Non-functional Requirements

### Compatibility
- The new `/messages` endpoint must accept exactly the same payload format as Meta's official
  WhatsApp Cloud API so that existing integrations (n8n, etc.) work without modification.

### No behaviour regression
- Instance creation, QR scanning, Redis auth, PostgreSQL persistence, `onModuleInit` restoration,
  and webhook delivery must all continue to work identically.

---

## Dependencies

- `whaileys@6.4.9` — available on npm
- `awesome-phonenumber@^6.8.0` — available on npm
- Redis + PostgreSQL infrastructure — already implemented (spec-4, spec-5)
- unoapi transformer reference — `/Users/mmendesx/workspace/unoapi-cloud/src/services/transformer.ts`

---

## Constraints

- Do NOT keep the 12 old type-specific send endpoints — clean break
- Do NOT introduce a compatibility shim or dual-route layer
- Keep all non-send instance management endpoints unchanged
- The transformer must be a pure function (no DB, no Redis, no HTTP calls)
- whaileys must be imported via the `@whiskeysockets/baileys` alias — no import path changes

---

## Open Questions

None — sufficient context from unoapi reference implementation to proceed.
