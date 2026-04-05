# Spec 6 — Interactive Message Delivery Debug

## Overview

Interactive messages (buttons, list, cta-url, copy-code) return a `messageId` from the API but
never appear on the recipient's mobile device. WhatsApp Web shows "This message couldn't load.
Open the message on your phone to view it." — this is expected because `nativeFlowMessage` is a
mobile-only format. The real problem is mobile delivery failure.

The current implementation bypasses Baileys' `sendMessage` using `generateWAMessageFromContent` +
`relayMessage` + `proto.Message.fromObject`. This path was chosen to avoid a content-validation
error, but it may not be producing a correctly encrypted multidevice message.

---

## Context

- **Project**: Papagai — NestJS 11 multi-instance WhatsApp gateway
- **Library**: `@whiskeysockets/baileys` 7.0.0-rc.9
- **Affected endpoints**: `/send/interactive-buttons`, `/send/list`, `/send/cta-url`, `/send/copy-code`
- **Working**: `/send/text`, `/send/image`, all other non-interactive endpoints
- **Symptom**: API returns `{ success: true, messageId: "..." }`, mobile receives nothing
- **WhatsApp Web**: shows "This message couldn't load" (expected — mobile-only format)

---

## Root Cause Hypotheses

### H1 — `relayMessage` bypass skips per-device encryption
`sendMessage` internally calls `patchMessageBeforeSending`, fetches participant devices via
`getUSyncDevices`, and encrypts the message per recipient device via Signal. `relayMessage` is the
low-level transport layer — calling it directly with a pre-built `proto.Message` may skip device
key lookup and produce a message only decryptable by the sender's own devices.

### H2 — `proto.Message.fromObject({ interactiveMessage })` nesting mismatch
`generateWAMessageFromContent` expects the second argument to be a `proto.Message` instance. If the
content is wrapped at the wrong nesting level (e.g., `message.message.interactiveMessage` instead
of `message.interactiveMessage`), the ciphertext is built from a malformed payload that WhatsApp
servers accept but recipients cannot decrypt.

### H3 — `messageVersion` value
The current value is `1`. Some WhatsApp clients require `messageVersion: 2` for `nativeFlowMessage`
to be rendered. Version `1` may be accepted by the server but silently ignored by the mobile client.

### H4 — `sendMessage` with `as any` cast actually works in 7.x
Baileys 7.0.0-rc.9 may have relaxed the content validation that caused the original "Invalid media
type" error. The earlier fix (session obs 3177) may no longer be necessary, and `sendMessage` with
an `as any` cast might deliver correctly via the full multidevice path.

---

## Functional Requirements

### FR-1: Diagnostic logging

Before sending, log the JSON-serialized `interactiveMessage` object and the `msg.message` object
produced by `generateWAMessageFromContent`, at `DEBUG` level, so the exact proto payload can be
inspected in server logs.

### FR-2: Test `sendMessage` path as primary approach

Try `socket.sendMessage(jid, { interactiveMessage: payload } as any)` directly. This uses the full
Baileys send pipeline including device key resolution, per-device encryption, and
`patchMessageBeforeSending`. If it works, replace `sendInteractive` entirely.

### FR-3: Fallback — patch `generateWAMessage` wrapping

If FR-2 still triggers validation errors, investigate whether the content needs to be passed as
`proto.Message.fromObject({ message: { interactiveMessage } })` (double-nested) instead of
`proto.Message.fromObject({ interactiveMessage })`.

### FR-4: Try `messageVersion: 2`

Test with `messageVersion: 2` on the `nativeFlowMessage` for all four interactive types to
determine if mobile rendering depends on the version number.

### FR-5: Verify delivery via message ACK

After sending, log the message key and check whether `messages.update` events are emitted with
`status: 'DELIVERED'` for that messageId. If no delivery receipt arrives within 10 seconds, the
message was not received by any device.

---

## Technical Requirements

### Architecture

All changes are contained to `src/whatsapp/whatsapp.service.ts`. No new files, no new endpoints, no
DTO changes. The fix must preserve the same public method signatures.

### Change surface

| File | Change |
|---|---|
| `src/whatsapp/whatsapp.service.ts` | Replace `sendInteractive` private method; add debug logging |

### Approach priority

1. **First**: try `sendMessage(jid, { interactiveMessage } as any)` — simplest, uses full Baileys pipeline
2. **If that fails with validation error**: use `generateWAMessage` (not `generateWAMessageFromContent`) which internally calls `patchMessageBeforeSending` and handles device encryption
3. **Last resort**: keep `relayMessage` but verify the proto nesting with diagnostic logs first

### `sendMessage` approach (preferred)

```typescript
private async sendInteractive(instance: Instance, jid: string, interactiveMessage: object): Promise<any> {
  return instance.socket.sendMessage(jid, { interactiveMessage } as any);
}
```

### `generateWAMessage` approach (fallback)

```typescript
import { generateWAMessage } from '@whiskeysockets/baileys';

private async sendInteractive(instance: Instance, jid: string, interactiveMessage: object): Promise<any> {
  const msg = await generateWAMessage(jid, { interactiveMessage } as any, {
    userJid: instance.socket.user?.id ?? '',
    logger: this.baileysLogger,
  });
  await (instance.socket as any).relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}
```

---

## Constraints

- All existing interactive endpoints must continue working after the fix
- No new npm packages
- No changes to DTOs, controllers, or service interface
- `sendButtons` (deprecated) is not affected — it uses `sendMessage` already

## Open Questions

None — sufficient information to begin implementation.
