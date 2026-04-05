# PRD: Spec-7 Review Fixes

**Spec**: tasks/specs/spec-8-review-fixes.md
**Status**: TODO

---

## Summary

Addresses five issues found in the spec-7 review: a broken reaction delivery bug (`remoteJid`
always empty), missing transformer unit tests, wrong vCard line endings (LF vs CRLF), redundant
fallback logic in the connection bootstrap, and misleading TypeErrors when payload body fields
are absent. Changes are confined to `transformer.ts`, `whatsapp.service.ts`, and a new
`transformer.spec.ts`.

---

## Behavior Scenarios

### Feature: Reaction Delivery Fix

#### Scenario 1 — Reaction carries the correct remoteJid
```
Given a connected instance "papagai01"
When POST /instances/papagai01/messages with { "type": "reaction", "to": "5561999990000", "reaction": { "message_id": "MSGID", "emoji": "👍" } }
Then the Baileys sendMessage call receives react.key.remoteJid = "5561999990000@s.whatsapp.net"
And the reaction is not rejected by the WhatsApp socket layer
```

#### Scenario 2 — Missing reaction fields return 400
```
Given a connected instance
When POST /instances/:name/messages with { "type": "reaction", "to": "..." } (missing reaction.emoji and reaction.message_id)
Then the response is 400 with message "Missing required fields: reaction.emoji and reaction.message_id"
```

---

### Feature: Transformer Unit Tests

#### Scenario 3 — text type produces correct content
```
Given toMessageContent is called with { type: "text", to: "5511", text: { body: "Hi" } }
Then it returns { text: "Hi" }
```

#### Scenario 4 — image type produces correct content
```
Given toMessageContent is called with { type: "image", to: "...", image: { link: "https://img.url", caption: "Photo" } }
Then it returns { image: { url: "https://img.url" }, caption: "Photo" }
```

#### Scenario 5 — audio type produces correct content
```
Given toMessageContent is called with { type: "audio", to: "...", audio: { link: "https://audio.url" } }
Then it returns { audio: { url: "https://audio.url" }, mimetype: "audio/mpeg", ptt: false }
```

#### Scenario 6 — video type produces correct content
```
Given toMessageContent is called with { type: "video", to: "...", video: { link: "https://vid.url", caption: "Clip" } }
Then it returns { video: { url: "https://vid.url" }, caption: "Clip" }
```

#### Scenario 7 — document type produces correct content
```
Given toMessageContent is called with { type: "document", to: "...", document: { link: "https://doc.url", filename: "report.pdf" } }
Then it returns { document: { url: "https://doc.url" }, fileName: "report.pdf", mimetype: "application/octet-stream" }
```

#### Scenario 8 — sticker type produces correct content
```
Given toMessageContent is called with { type: "sticker", to: "...", sticker: { link: "https://sticker.url" } }
Then it returns { sticker: { url: "https://sticker.url" } }
```

#### Scenario 9 — location type produces correct content
```
Given toMessageContent is called with { type: "location", to: "...", location: { latitude: -15.78, longitude: -47.93 } }
Then it returns { location: { degreesLatitude: -15.78, degreesLongitude: -47.93 } }
```

#### Scenario 10 — contacts type produces correct vcard
```
Given toMessageContent is called with a contacts payload with one contact named "Alice" and phone "5511999"
Then it returns contacts.displayName = "Alice" and contacts.contacts[0] is a CRLF-terminated vCard string
```

#### Scenario 11 — reaction type produces correct content with non-empty remoteJid
```
Given toMessageContent is called with { type: "reaction", to: "5561999990000", reaction: { message_id: "MSGID", emoji: "👍" } }
Then it returns react.text = "👍" and react.key.id = "MSGID" and react.key.remoteJid = "5561999990000@s.whatsapp.net"
```

#### Scenario 12 — interactive button type produces correct nativeFlowMessage
```
Given toMessageContent is called with interactive type "button" with two reply buttons
Then it returns interactiveMessage.nativeFlowMessage.buttons with two quick_reply entries
```

#### Scenario 13 — interactive list type produces single_select
```
Given toMessageContent is called with interactive type "list" with sections
Then it returns interactiveMessage.nativeFlowMessage.buttons[0].name = "single_select"
```

#### Scenario 14 — interactive cta_url produces cta_url button
```
Given toMessageContent is called with interactive type "cta_url"
Then it returns interactiveMessage.nativeFlowMessage.buttons[0].name = "cta_url"
```

#### Scenario 15 — interactive cta_copy produces cta_copy button
```
Given toMessageContent is called with interactive type "cta_copy"
Then it returns interactiveMessage.nativeFlowMessage.buttons[0].name = "cta_copy"
```

#### Scenario 16 — interactive with footer includes footer
```
Given toMessageContent is called with interactive payload that has a footer
Then it returns interactiveMessage.footer = { text: "Footer text" }
```

#### Scenario 17 — interactive without footer omits footer
```
Given toMessageContent is called with interactive payload that has no footer
Then the returned object has no footer key at all
```

#### Scenario 18 — unknown type throws descriptive error
```
Given toMessageContent is called with { type: "unsupported", to: "..." }
Then it throws an Error with message containing "unsupported"
```

#### Scenario 19 — unknown interactive sub-type throws descriptive error
```
Given toMessageContent is called with interactive type "unknown_flow"
Then it throws an Error with message containing "unknown_flow"
```

---

### Feature: vCard RFC 2426 Compliance

#### Scenario 20 — vCard uses CRLF line endings
```
Given toMessageContent is called with a contacts payload
When the output vCard string is inspected
Then each line separator is "\r\n" (not "\n")
And the string starts with "BEGIN:VCARD\r\n"
```

---

### Feature: Payload Validation Guards

#### Scenario 21 — missing text.body returns descriptive error
```
Given toMessageContent is called with { type: "text", to: "...", text: {} }
Then it throws an Error with message "Missing required field: text.body"
```

#### Scenario 22 — missing image.link returns descriptive error
```
Given toMessageContent is called with { type: "image", to: "...", image: {} }
Then it throws an Error with message "Missing required field: image.link"
```

#### Scenario 23 — missing location coordinates returns descriptive error
```
Given toMessageContent is called with { type: "location", to: "...", location: {} }
Then it throws an Error with message containing "location.latitude"
```

---

### Feature: Clean Fallback Logic

#### Scenario 24 — version set correctly when fetchLatestWaWebVersion succeeds
```
Given fetchLatestWaWebVersion returns { version: [2, 3000, 1], error: undefined }
When createInstance is called
Then makeWASocket is called with version [2, 3000, 1]
```

#### Scenario 25 — fallback used when fetchLatestWaWebVersion returns error
```
Given fetchLatestWaWebVersion returns { version: undefined, error: "network error" }
And fetchLatestBaileysVersion returns { version: [2, 2999, 0] }
When createInstance is called
Then makeWASocket is called with version [2, 2999, 0]
```

---

## Tasks

### ICT-1: Fix reaction remoteJid + add payload guards + fix vCard CRLF
- **What**: In `src/whatsapp/utils/transformer.ts`:
  1. Add `import { phoneNumberToJid } from './jid.js'` at the top.
  2. In the `reaction` case: add guard `if (!payload.reaction?.emoji || !payload.reaction?.message_id) throw new Error('Missing required fields: reaction.emoji and reaction.message_id')`, then set `remoteJid: phoneNumberToJid(payload.to ?? '')` instead of `''`.
  3. Add payload guards for all other types as specified in FR-5. Guard table: `text` → `!payload.text?.body`; `image` → `!payload.image?.link`; `audio` → `!payload.audio?.link`; `video` → `!payload.video?.link`; `document` → `!payload.document?.link`; `sticker` → `!payload.sticker?.link`; `location` → `!payload.location?.latitude || !payload.location?.longitude`; `interactive` → `!payload.interactive?.body?.text`.
  4. In `buildVcard`: change all `\n` separators to `\r\n`.
- **Where**: `src/whatsapp/utils/transformer.ts`
- **Validated by**: Scenarios 1, 2, 20, 21, 22, 23
- **Estimate**: S

### ICT-2: Simplify fetchLatestWaWebVersion fallback logic
- **What**: In `src/whatsapp/whatsapp.service.ts`, inside `createInstance()`, replace the redundant ternary + re-check pattern with a clean if/else:
  ```typescript
  if (result.error) {
    const fallback = await fetchLatestBaileysVersion({}).catch(() => ({ version: undefined }));
    version = fallback.version;
  } else {
    version = result.version;
  }
  ```
  No functional change — purely a readability fix.
- **Where**: `src/whatsapp/whatsapp.service.ts`
- **Validated by**: Scenarios 24, 25
- **Estimate**: S

### ICT-3: Create transformer.spec.ts with full coverage
- **What**: Create `src/whatsapp/utils/transformer.spec.ts`. Plain Jest unit tests — no NestJS module setup. Import `toMessageContent` directly. Write one `describe` block per message type, one `it` per scenario. Cover all 17 scenarios (3–19) plus the 3 guard scenarios (21–23) and the vCard CRLF scenario (20). The reaction test must assert `react.key.remoteJid` equals `"5561999990000@s.whatsapp.net"` for input `to: "5561999990000"`.
- **Where**: `src/whatsapp/utils/transformer.spec.ts` (new file)
- **Validated by**: Scenarios 3–23
- **Estimate**: M
- **Depends on**: ICT-1 (tests must run against the fixed transformer)

---

## Open Questions

None.

## Dependencies

- `src/whatsapp/utils/jid.ts` — `phoneNumberToJid` available from spec-7 (ICT-2)
- All existing tests must continue passing after these changes
