# PRD: Interactive Message Delivery Debug

**Spec**: tasks/specs/spec-6-interactive-message-debug.md
**Status**: TODO

---

## Summary

Interactive message endpoints return `{ success: true, messageId }` but recipients never receive
the messages on mobile. The current `generateWAMessageFromContent` + `relayMessage` bypass path
likely skips Baileys' per-device Signal encryption. The fix is to try `sendMessage(jid, { interactiveMessage } as any)` first — the full Baileys pipeline — and only fall back to lower-level
approaches if that triggers validation errors.

---

## Behavior Scenarios

### Feature: Interactive Message Delivery

#### Scenario 1 — sendMessage path delivers interactive buttons to mobile
```
Given a connected instance and a valid recipient JID
When POST /instances/:name/send/interactive-buttons is called with valid body + buttons
Then the recipient's mobile device receives a tappable button message
And the API response contains { success: true, messageId: "<string>" }
```

#### Scenario 2 — sendMessage path delivers list message to mobile
```
Given a connected instance and a valid recipient JID
When POST /instances/:name/send/list is called with body, buttonText, and sections
Then the recipient's mobile device receives a list message with a tap-to-open button
And the API response contains { success: true, messageId: "<string>" }
```

#### Scenario 3 — sendMessage path delivers CTA URL button to mobile
```
Given a connected instance and a valid recipient JID
When POST /instances/:name/send/cta-url is called with body, buttonText, and url
Then the recipient's mobile device receives a message with a URL-opening button
And the API response contains { success: true, messageId: "<string>" }
```

#### Scenario 4 — sendMessage path delivers copy-code button to mobile
```
Given a connected instance and a valid recipient JID
When POST /instances/:name/send/copy-code is called with body, buttonText, and code
Then the recipient's mobile device receives a message with a copy-to-clipboard button
And the API response contains { success: true, messageId: "<string>" }
```

#### Scenario 5 — WhatsApp Web shows "couldn't load" (expected, not a bug)
```
Given an interactive message was delivered to a recipient
When the recipient views it on WhatsApp Web
Then WhatsApp Web shows "This message couldn't load. Open the message on your phone to view it."
And this is expected behavior for nativeFlowMessage (mobile-only format)
```

#### Scenario 6 — sendMessage validation error falls back gracefully
```
Given sendMessage throws a validation/media-type error for interactiveMessage
When the error is caught
Then the error is surfaced to the caller with a clear message
And no silent failure occurs
```

#### Scenario 7 — Debug logs show serialized payload before send
```
Given LOG_LEVEL=debug
When any interactive message endpoint is called
Then the server logs contain the JSON-serialized interactiveMessage payload
So that proto structure can be inspected without code changes
```

---

## Tasks

### ICT-1: Replace sendInteractive with sendMessage path + debug logging
- **What**: Replace the `generateWAMessageFromContent` + `relayMessage` implementation of `sendInteractive` with `socket.sendMessage(jid, { interactiveMessage } as any)`. Add a `DEBUG`-level log of the payload before sending. If `sendMessage` throws a content-validation error, the error propagates normally (no silent fallback).
- **Where**: `src/whatsapp/whatsapp.service.ts` — `sendInteractive` private method only
- **Validated by**: Scenarios 1, 2, 3, 4, 6, 7
- **Estimate**: S

### ICT-2: Remove unused proto/generateWAMessageFromContent imports
- **What**: After ICT-1, remove `proto` and `generateWAMessageFromContent` from the Baileys import block if they are no longer referenced anywhere in the file.
- **Where**: `src/whatsapp/whatsapp.service.ts` — import block only
- **Validated by**: Build passes with 0 errors
- **Estimate**: S
- **Depends on**: ICT-1

---

## Open Questions

None.

## Dependencies

- `@whiskeysockets/baileys` 7.0.0-rc.9 — already installed
- No new packages required
