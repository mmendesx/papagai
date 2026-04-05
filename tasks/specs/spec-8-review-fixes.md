# Spec: Spec-7 Review Fixes

## Overview

The spec-7 review identified five issues in the whaileys + Meta Cloud API implementation. Two
are blocking correctness bugs (broken reaction delivery, missing transformer tests). Three are
non-blocking quality issues (redundant fallback logic, wrong vCard line endings, misleading
runtime error for missing payload fields). This spec addresses all five in a single focused
pass.

---

## Actors

- **API consumers** sending reactions, contacts, or any message type via `POST /instances/:name/messages`
- **Papagai server** translating Meta payloads to Baileys calls via the transformer layer

---

## Functional Requirements

### FR-1: Reaction `remoteJid` must be set to the recipient's JID

The `reaction` case in `toMessageContent` currently sets `key.remoteJid: ''`. WhatsApp requires
`remoteJid` to equal the JID of the chat where the reaction is being sent. The transformer must
use `payload.to` (which is always present on the top-level Meta payload) converted via
`phoneNumberToJid` to populate `remoteJid`.

### FR-2: Transformer unit tests must exist

A `transformer.spec.ts` file must be created covering all message types handled by
`toMessageContent`. Minimum coverage:

| Input type | What to assert |
|---|---|
| `text` | Returns `{ text: 'Hello' }` |
| `image` | Returns correct `image.url` and `caption` |
| `audio` | Returns correct `audio.url`, `mimetype`, `ptt: false` |
| `video` | Returns correct `video.url` and `caption` |
| `document` | Returns correct `document.url`, `fileName`, `mimetype` |
| `sticker` | Returns correct `sticker.url` |
| `location` | Returns correct `degreesLatitude`, `degreesLongitude` |
| `contacts` | Returns correct `displayName` and one vcard string |
| `reaction` | Returns correct `react.text`, `react.key.id`, `react.key.remoteJid` (non-empty, equals converted `to`) |
| `interactive/button` | Returns `interactiveMessage` with `quick_reply` buttons |
| `interactive/list` | Returns `interactiveMessage` with `single_select` button |
| `interactive/cta_url` | Returns `interactiveMessage` with `cta_url` button |
| `interactive/cta_copy` | Returns `interactiveMessage` with `cta_copy` button |
| `interactive` with footer | Footer is present in output |
| `interactive` without footer | Footer is absent from output |
| unknown `type` | Throws `Error` containing the type name |
| unknown interactive sub-type | Throws `Error` containing the sub-type name |

### FR-3: vCard line endings must be CRLF

The `buildVcard` helper currently uses `\n` (LF) as the line separator. RFC 2426 (vCard 3.0)
requires `\r\n` (CRLF). All line separators in the vCard output — including between properties
and the BEGIN/END delimiters — must use `\r\n`.

### FR-4: Cleaner `fetchLatestWaWebVersion` fallback logic

The redundant ternary + conditional in `whatsapp.service.ts` must be simplified. The final logic
must be functionally equivalent but expressed without the dead assignment:

```typescript
// Before (redundant):
version = result.error ? undefined : result.version;
if (result.error) { /* fetch fallback */ }

// After (clean):
if (result.error) {
  const fallback = await fetchLatestBaileysVersion({}).catch(() => ({ version: undefined }));
  version = fallback.version;
} else {
  version = result.version;
}
```

### FR-5: Informative error for missing payload body field

When a caller sends `{ type: 'text', to: '...' }` without the `text` field, the transformer
currently throws `TypeError: Cannot read properties of undefined (reading 'body')`. This
surfaces as a 400 (the controller catches all errors) but with a misleading message.

The transformer must guard each type-specific access and throw a descriptive `Error` instead:

```typescript
case 'text':
  if (!payload.text?.body) throw new Error("Missing required field: text.body");
  return { text: payload.text.body };
```

Apply the same guard to the minimum required field for each type:

| type | Required field | Error message |
|---|---|---|
| `text` | `text.body` | `"Missing required field: text.body"` |
| `image` | `image.link` | `"Missing required field: image.link"` |
| `audio` | `audio.link` | `"Missing required field: audio.link"` |
| `video` | `video.link` | `"Missing required field: video.link"` |
| `document` | `document.link` | `"Missing required field: document.link"` |
| `sticker` | `sticker.link` | `"Missing required field: sticker.link"` |
| `location` | `location.latitude` + `location.longitude` | `"Missing required fields: location.latitude and location.longitude"` |
| `reaction` | `reaction.emoji` + `reaction.message_id` | `"Missing required fields: reaction.emoji and reaction.message_id"` |
| `interactive` | `interactive.body.text` | `"Missing required field: interactive.body.text"` |

`contacts` is already guarded (uses `?? []` and `?? {}`).

---

## Technical Requirements

### Architecture

All changes are confined to two files:
- `src/whatsapp/utils/transformer.ts` — FR-1, FR-3, FR-4 guards, FR-5 guards
- `src/whatsapp/whatsapp.service.ts` — FR-4 cleanup

One new file:
- `src/whatsapp/utils/transformer.spec.ts` — FR-2

No changes to controller, service, DTOs, or infrastructure.

### FR-1 implementation detail

The `toMessageContent` function currently has signature `(payload: any): any`. The `to` field
is already present on the top-level Meta payload (it's required by `MetaMessageDto`). Read it
directly from `payload.to` inside the `reaction` case — no signature change needed:

```typescript
case 'reaction': {
  if (!payload.reaction?.emoji || !payload.reaction?.message_id) {
    throw new Error('Missing required fields: reaction.emoji and reaction.message_id');
  }
  const to = payload.to ?? '';
  return {
    react: {
      text: payload.reaction.emoji,
      key: {
        id: payload.reaction.message_id,
        remoteJid: phoneNumberToJid(to),
      },
    },
  };
}
```

This requires importing `phoneNumberToJid` from `./jid.js` in `transformer.ts`.

### FR-2 test structure

`transformer.spec.ts` should NOT use NestJS testing infrastructure — it's a plain Jest unit test
of a pure function. No module setup, no DI, no mocks needed.

Pattern:
```typescript
import { toMessageContent } from './transformer';

describe('toMessageContent', () => {
  describe('text', () => {
    it('returns text body', () => {
      expect(toMessageContent({ type: 'text', to: '5511999', text: { body: 'Hi' } }))
        .toEqual({ text: 'Hi' });
    });
  });
  // ...
});
```

### FR-3 vCard implementation

```typescript
// Before:
const telLines = phones.map(...).join('\n');
return `BEGIN:VCARD\nVERSION:3.0\nFN:${formattedName}\n${telLines}\nEND:VCARD`;

// After:
const telLines = phones.map(...).join('\r\n');
return `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${formattedName}\r\n${telLines}\r\nEND:VCARD`;
```

---

## Non-functional Requirements

### Correctness
- Reaction delivery must not be broken by an empty `remoteJid`
- vCard output must be RFC 2426 compliant

### Test quality
- Each test asserts one behavior
- Tests are independent (pure function — no shared state)
- The transformer spec must run in under 50ms

---

## Dependencies

- `src/whatsapp/utils/jid.ts` — already implemented in spec-7; `phoneNumberToJid` needed for FR-1
- `@whiskeysockets/baileys` types — `transformer.ts` uses `any`, no additional type imports needed

---

## Constraints

- Do NOT change the `toMessageContent` function signature (no second parameter)
- Do NOT change any controller, DTO, or service files
- Do NOT modify any existing passing tests
- All 5 issues must be addressed in a single spec/PRD cycle

---

## Open Questions

None.
