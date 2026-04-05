# Spec 3 — WhatsApp Interactive Messages

## Overview

The existing `/send/buttons` endpoint uses Baileys' deprecated `buttonsMessage` format, which
WhatsApp is phasing out. This spec adds four new interactive message types built on the modern
`interactiveMessage` / `nativeFlowMessage` protobuf path supported by Baileys 7.0.0-rc.9.

The deprecated `/send/buttons` endpoint and its supporting code are retained as-is for backward
compatibility. All new message types are purely additive.

---

## Context

- **Project**: Papagai — NestJS 11 multi-instance WhatsApp REST gateway
- **Library**: `@whiskeysockets/baileys` 7.0.0-rc.9 (already installed)
- **Baileys send pattern**: `socket.sendMessage(jid, { interactiveMessage: { ... } } as any)`
- **JID resolution**: all `to` fields go through `resolveJid()` for Brazilian number support

---

## Functional Requirements

### FR-1: Interactive Reply Buttons (`POST /instances/:name/send/interactive-buttons`)

Send a message with up to 3 tappable reply buttons. When a recipient taps a button, WhatsApp
delivers a `button_response` event to the sender.

- `body` (required) — main message text
- `buttons` (required) — array of 1–3 objects each with `id` and `displayText`
- `header` (optional) — header text shown above the body
- `footer` (optional) — footer text shown below the buttons
- Uses `quick_reply` button type in `nativeFlowMessage.buttons`
- `buttonParamsJson`: `{"display_text":"<displayText>","id":"<id>"}`

### FR-2: List Message (`POST /instances/:name/send/list`)

Send a message with a single "list button" that, when tapped, opens a scrollable list organised into sections.

- `body` (required) — main message text
- `buttonText` (required) — label on the list-open button
- `sections` (required) — array of 1+ sections, each with `title` and `rows[]`
  - each row: `id` (required), `title` (required), `description` (optional)
- `header` (optional), `footer` (optional)
- Uses `single_select` button type
- `buttonParamsJson`: `{"title":"<buttonText>","sections":[{"title":"...","rows":[{"header":"","title":"...","description":"...","id":"..."}]}]}`

### FR-3: CTA URL Button (`POST /instances/:name/send/cta-url`)

Send a message with a single button that opens a URL in the device's browser when tapped.

- `body` (required) — main message text
- `buttonText` (required) — label on the button
- `url` (required) — valid URL (`@IsUrl()`)
- `header` (optional), `footer` (optional)
- Uses `cta_url` button type
- `buttonParamsJson`: `{"display_text":"<buttonText>","url":"<url>","merchant_url":"<url>"}`

### FR-4: Copy Code Button (`POST /instances/:name/send/copy-code`)

Send a message with a single "copy" button that copies a string to the device clipboard when tapped.
Primary use cases: Pix keys, OTP codes, coupon codes, referral codes.

- `body` (required) — main message text
- `buttonText` (required) — label on the button
- `code` (required) — the string to copy; must not be empty (`@IsNotEmpty()`)
- `header` (optional), `footer` (optional)
- Uses `cta_copy` button type
- `buttonParamsJson`: `{"display_text":"<buttonText>","copy_code":"<code>"}`

---

## Technical Design

### Baileys `interactiveMessage` Structure

```typescript
{
  interactiveMessage: {
    header: { text?: string, hasMediaAttachment: false },
    body: { text: string },
    footer: { text?: string },
    nativeFlowMessage: {
      buttons: [{ name: string, buttonParamsJson: string }]
    }
  }
}
```

### Button `name` Values

| Type | `name` |
|---|---|
| Interactive reply buttons | `quick_reply` |
| List message | `single_select` |
| CTA URL | `cta_url` |
| Copy code | `cta_copy` |

### Change Surface

| File | Change |
|---|---|
| `src/instances/dto/send-message.dto.ts` | Add 4 top-level DTOs + 3 nested child DTOs |
| `src/whatsapp/interfaces/whatsapp.interface.ts` | Add `InteractiveButton`, `ListSection`, `ListRow` |
| `src/whatsapp/whatsapp.service.ts` | Add 4 send methods |
| `src/instances/instances.service.ts` | Add 4 proxy methods |
| `src/instances/instances.controller.ts` | Add 4 endpoints |

---

## API Contracts

### POST `/instances/:name/send/interactive-buttons`
```json
{ "to": "5561999990000", "body": "Escolha:", "header": "Bem-vindo", "footer": "Bot",
  "buttons": [{"id":"btn_yes","displayText":"Sim"},{"id":"btn_no","displayText":"Não"}] }
→ { "success": true, "messageId": "<string>", "message": "🦜 Papagai enviou botões interativos" }
```

### POST `/instances/:name/send/list`
```json
{ "to": "5561999990000", "body": "Selecione:", "buttonText": "Ver opções",
  "sections": [{"title":"Planos","rows":[{"id":"p1","title":"Básico","description":"R$ 29/mês"}]}] }
→ { "success": true, "messageId": "<string>", "message": "🦜 Papagai enviou a lista" }
```

### POST `/instances/:name/send/cta-url`
```json
{ "to": "5561999990000", "body": "Acesse nossa loja:", "buttonText": "Abrir loja", "url": "https://loja.exemplo.com.br" }
→ { "success": true, "messageId": "<string>", "message": "🦜 Papagai enviou o link" }
```

### POST `/instances/:name/send/copy-code`
```json
{ "to": "5561999990000", "body": "Sua chave Pix:", "buttonText": "Copiar chave", "code": "chave@pix.com.br" }
→ { "success": true, "messageId": "<string>", "message": "🦜 Papagai enviou o código" }
```

---

## Constraints

- `/send/buttons` is not removed or modified
- All `to` fields go through `resolveJid()` for Brazilian number normalisation
- No new packages — `class-validator` and `class-transformer` already present
- `interactiveMessage` cast via `as any` when calling `sendMessage`
- `header.hasMediaAttachment` must be `false` (boolean), never omitted
