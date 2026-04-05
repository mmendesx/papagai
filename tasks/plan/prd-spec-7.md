# PRD: whaileys@6.4.9 + Meta Cloud API Payload Format

**Spec**: tasks/specs/spec-7-whaileys-meta-api.md
**Status**: TODO

---

## Summary

Migrate Papagai from `@whiskeysockets/baileys@7.0.0-rc.9` to `whaileys@6.4.9` (the fork that
connects reliably to current WhatsApp servers), fix the connection bootstrap with
`fetchLatestWaWebVersion`, and replace all 12 type-specific send endpoints with a single
`POST /instances/:name/messages` endpoint that accepts the standard Meta Cloud API payload format.
A pure transformer function handles all Meta → Baileys translation. Existing infrastructure
(Redis, PostgreSQL, webhooks, QR, instance management) is unchanged.

---

## Behavior Scenarios

### Feature: Package Migration & Connection Fix

#### Scenario 1 — Instance connects to WhatsApp after package swap
```
Given whaileys@6.4.9 is installed as @whiskeysockets/baileys
When POST /instances/create is called and QR is scanned
Then the instance reaches connected=true
And GET /instances/:name/status returns { connected: true }
```

#### Scenario 2 — fetchLatestWaWebVersion used for connection
```
Given the server starts and creates a new instance
When the Baileys socket initialises
Then fetchLatestWaWebVersion is called with the correct User-Agent headers
And the resolved version is passed to makeWASocket
```

#### Scenario 3 — Falls back to fetchLatestBaileysVersion on network error
```
Given fetchLatestWaWebVersion returns an error
When the Baileys socket initialises
Then fetchLatestBaileysVersion is used as fallback
And the socket connects successfully
```

---

### Feature: Unified Send Endpoint

#### Scenario 4 — Text message via Meta payload
```
Given a connected instance "papagai01"
When POST /instances/papagai01/messages with { "type": "text", "to": "5561999990000", "text": { "body": "Hello!" } }
Then the recipient receives "Hello!" as a WhatsApp text message
And the response is { "messaging_product": "whatsapp", "messages": [{ "id": "<string>" }] }
```

#### Scenario 5 — Image message via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with { "type": "image", "to": "...", "image": { "link": "https://...", "caption": "Photo" } }
Then the recipient receives an image with caption "Photo"
And the response contains a messageId
```

#### Scenario 6 — Audio message via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with { "type": "audio", "to": "...", "audio": { "link": "https://..." } }
Then the recipient receives an audio message
```

#### Scenario 7 — Document message via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with { "type": "document", "to": "...", "document": { "link": "https://...", "filename": "report.pdf" } }
Then the recipient receives a document named "report.pdf"
```

#### Scenario 8 — Interactive buttons via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with interactive type "button" and 2 reply buttons
Then the recipient's mobile receives a message with 2 tappable buttons
And the response contains a messageId
```

#### Scenario 9 — Interactive list via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with interactive type "list" and sections
Then the recipient's mobile receives a list message
```

#### Scenario 10 — CTA URL button via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with interactive type "cta_url"
Then the recipient receives a message with a URL-opening button
```

#### Scenario 11 — Copy code button via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with interactive type "cta_copy"
Then the recipient receives a message with a copy-to-clipboard button
```

#### Scenario 12 — Location message via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with { "type": "location", "location": { "latitude": -15.7801, "longitude": -47.9292 } }
Then the recipient receives a location pin
```

#### Scenario 13 — Reaction via Meta payload
```
Given a connected instance
When POST /instances/:name/messages with { "type": "reaction", "reaction": { "message_id": "MSGID", "emoji": "👍" } }
Then a reaction is sent on the target message
```

#### Scenario 14 — Unknown type returns 400
```
Given a connected instance
When POST /instances/:name/messages with { "type": "unsupported_type", "to": "..." }
Then the response is 400 with a clear error message
```

#### Scenario 15 — Missing required field returns 400
```
Given a connected instance
When POST /instances/:name/messages with { "type": "text" } (missing "to" and "text.body")
Then the response is 400 with validation errors
```

#### Scenario 16 — Old /send/* endpoints are gone
```
Given the migrated server
When POST /instances/:name/send/text is called
Then the response is 404
```

---

### Feature: Phone Number Utilities

#### Scenario 17 — Brazilian number with 9th digit resolved
```
Given a Brazilian number "5561999990000" (13 digits)
When phoneNumberToJid("5561999990000") is called
Then it returns "5561999990000@s.whatsapp.net"
```

#### Scenario 18 — Existing JID passed through unchanged
```
Given a full JID "5561999990000@s.whatsapp.net"
When phoneNumberToJid("5561999990000@s.whatsapp.net") is called
Then it returns "5561999990000@s.whatsapp.net" unchanged
```

---

### Feature: Backwards Compatibility

#### Scenario 19 — Instance management endpoints unchanged
```
Given the migrated server
When POST /instances/create, GET /instances/:name/qr, DELETE /instances/:name are called
Then they respond exactly as before
```

#### Scenario 20 — Redis auth and PostgreSQL persistence unchanged
```
Given an instance connected before the migration
When the server restarts after migration
Then onModuleInit restores the instance from PostgreSQL
And Redis auth state is loaded without rescanning QR
```

---

## Tasks

### ICT-1: Replace baileys package + add awesome-phonenumber
- **What**: In `package.json`, change `"@whiskeysockets/baileys": "7.0.0-rc.9"` to `"@whiskeysockets/baileys": "npm:whaileys@6.4.9"`. Add `"awesome-phonenumber": "^6.8.0"` to dependencies. Remove `"patch-package"` from dependencies and `"postinstall": "patch-package"` from scripts if present. Run `npm install`.
- **Where**: `package.json`
- **Validated by**: Scenario 1
- **Estimate**: S

### ICT-2: Create JID utility module
- **What**: Create `src/whatsapp/utils/jid.ts` exporting `phoneNumberToJid(phone: string): string` and `jidToPhoneNumber(jid: string): string`. Model on unoapi's implementation at `/Users/mmendesx/workspace/unoapi-cloud/src/services/transformer.ts` lines 513–534 and 721–734. Use `parsePhoneNumber` from `awesome-phonenumber` for normalisation. `phoneNumberToJid` must pass through existing JIDs (containing `@`) unchanged.
- **Where**: `src/whatsapp/utils/jid.ts` (new file)
- **Validated by**: Scenarios 17, 18
- **Estimate**: S

### ICT-3: Create Meta → Baileys transformer
- **What**: Create `src/whatsapp/utils/transformer.ts` exporting a pure function `toMessageContent(payload: any): AnyMessageContent`. Handles types: `text`, `image`, `audio`, `video`, `document`, `sticker`, `location`, `contacts`, `reaction`, `interactive`. For `interactive`, handle sub-types: `button` (→ `nativeFlowMessage` quick_reply buttons), `list` (→ `nativeFlowMessage` single_select), `cta_url` (→ `nativeFlowMessage` cta_url), `cta_copy` (→ `nativeFlowMessage` cta_copy). Interactive header with `type: 4` and `subtitle: ''`. No `messageVersion` in `nativeFlowMessage`. Throws a descriptive error for unknown types. Model closely on unoapi's `toBaileysMessageContent` at transformer.ts lines 228–511.
- **Where**: `src/whatsapp/utils/transformer.ts` (new file)
- **Validated by**: Scenarios 4–13, 14
- **Estimate**: M

### ICT-4: Fix WhatsApp connection in WhatsappService
- **What**: In `createInstance()`, replace `fetchLatestBaileysVersion` with `fetchLatestWaWebVersion` using headers `{ 'sec-fetch-site': 'none', 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }`. Fall back to `fetchLatestBaileysVersion` if `fetchLatestWaWebVersion` returns an error. Add `shouldResendMessageOn475AckError: true` to `makeWASocket` config. Remove `qrcode-terminal` import and usage (print QR to terminal no longer needed — QR is already returned via webhook and API). Update Baileys import to add `fetchLatestWaWebVersion`.
- **Where**: `src/whatsapp/whatsapp.service.ts`
- **Validated by**: Scenarios 1, 2, 3
- **Estimate**: S
- **Depends on**: ICT-1

### ICT-5: Replace 12 send methods with single send() in WhatsappService
- **What**: Remove all 12 type-specific send methods (`sendText`, `sendButtons`, `sendImage`, `sendAudio`, `sendVoice`, `sendVideo`, `sendDocument`, `sendSticker`, `sendLocation`, `sendReaction`, `sendInteractiveButtons`, `sendList`, `sendCtaUrl`, `sendCopyCode`, `sendInteractive`). Replace with a single method: `async send(instanceName: string, to: string, content: any): Promise<any>`. This method calls `instance.socket.sendMessage(jid, content)` where `jid` comes from `phoneNumberToJid(to)`. Remove `resolveJid` and `normalizeJid` private methods (replaced by `phoneNumberToJid` from jid.ts). Keep all non-send methods: `createInstance`, `getInstance`, `getQR`, `getInstances`, `disconnectInstance`, `reconnectInstance`, `getContactInfo`, `getChats`, `onModuleInit`, `onModuleDestroy`.
- **Where**: `src/whatsapp/whatsapp.service.ts`
- **Validated by**: Scenarios 4–13, 16
- **Estimate**: M
- **Depends on**: ICT-2, ICT-4

### ICT-6: Replace InstancesService proxy methods
- **What**: Remove all 12 type-specific proxy methods. Replace with `async sendMessage(instanceName: string, payload: any): Promise<any>` that calls `toMessageContent(payload)` from the transformer and then `whatsappService.send(instanceName, payload.to, content)`. Import `toMessageContent` from the transformer utility.
- **Where**: `src/instances/instances.service.ts`
- **Validated by**: Scenarios 4–13
- **Estimate**: S
- **Depends on**: ICT-3, ICT-5

### ICT-7: Replace controller endpoints + DTO
- **What**: Remove all 12 `@Post(':name/send/*')` handlers and all existing DTOs in `send-message.dto.ts`. Add a single handler `@Post(':name/messages') async sendMessage(...)`. Create a minimal `MetaMessageDto` with `@IsString() to: string` and `@IsString() type: string` (all other fields are `@IsOptional()` and typed `any` since Meta payloads are deeply nested and class-validator can't validate their internals). Response format: `{ messaging_product: 'whatsapp', contacts: [{ input: to, wa_id: to }], messages: [{ id: messageId }] }`.
- **Where**: `src/instances/instances.controller.ts`, `src/instances/dto/send-message.dto.ts`
- **Validated by**: Scenarios 4–16, 19
- **Estimate**: S
- **Depends on**: ICT-6

---

## Open Questions

None.

## Dependencies

- `whaileys@6.4.9` — available on npm
- `awesome-phonenumber@^6.8.0` — available on npm
- unoapi reference: `/Users/mmendesx/workspace/unoapi-cloud/src/services/transformer.ts`
- Redis + PostgreSQL — already implemented (spec-4, spec-5)
