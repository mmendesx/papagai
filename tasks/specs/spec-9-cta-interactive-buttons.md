# Spec: CTA Interactive Buttons (cta_url / cta_copy) Cross-Platform Fix

## Overview
Papagai currently falls back to plain text for `cta_url` and `cta_copy` interactive message types because the `nativeFlowMessage` format doesn't render on iOS. Research into Evolution API, InfiniteAPI, and Baileys internals reveals that wrapping the `interactiveMessage` in a `viewOnceMessage` envelope is required for iOS and Android rendering. This spec defines the correct proto-level message format to implement.

## Actors
- **API caller**: sends a Meta Cloud API-compatible JSON payload to `POST /instances/:name/messages`
- **Papagai transformer**: converts the payload to Baileys proto format
- **Baileys socket**: delivers the message to WhatsApp servers
- **WhatsApp recipient**: receives and renders the button on iOS, Android, and Web

## Functional Requirements

### FR-1: cta_url renders as tappable button on iOS, Android, and Web
When a caller sends `type: "interactive"` with `interactive.type: "cta_url"`, the recipient must receive a tappable URL button — not a plain text fallback.

### FR-2: cta_copy renders as copyable code button on iOS, Android, and Web
When a caller sends `type: "interactive"` with `interactive.type: "cta_copy"`, the recipient must receive a copy-code button — not a plain text fallback.

### FR-3: Header, body, and footer are preserved
Title (from header), body text, and footer text must all appear in the rendered message.

### FR-4: merchant_url duplicates url in cta_url params
The `buttonParamsJson` for `cta_url` must include both `url` and `merchant_url` set to the same value — this is required by WhatsApp's validation.

### FR-5: messageVersion and messageParamsJson are set
`nativeFlowMessage.messageVersion` must be `2` and `nativeFlowMessage.messageParamsJson` must be a valid JSON string (can be `"{}"`).

## Technical Requirements

### Architecture
Single-file change to [src/whatsapp/utils/transformer.ts](src/whatsapp/utils/transformer.ts). The `buildCtaFallbackText` function is replaced by `buildCtaInteractiveMessage` which returns the correct proto shape.

No changes to the service layer are required — the `viewOnceMessage` wrapper is constructed in the transformer, not the send layer.

### Message proto shape

```typescript
// Final shape returned by transformer for cta_url / cta_copy:
{
  viewOnceMessage: {
    message: {
      interactiveMessage: {
        body:   { text: string },
        footer: { text: string },   // omitted if no footer
        header: {
          title: string,            // from interactive.header.text
          hasMediaAttachment: false,
        },
        nativeFlowMessage: {
          buttons: [
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: string,
                url:          string,
                merchant_url: string   // same as url
              })
            }
            // OR for cta_copy:
            {
              name: 'cta_copy',
              buttonParamsJson: JSON.stringify({
                display_text: string,
                copy_code:    string
              })
            }
          ],
          messageParamsJson: '{}',
          messageVersion:    2
        }
      }
    }
  }
}
```

### API contracts
No changes. The existing Meta Cloud API-compatible input format is unchanged:

```json
{
  "type": "interactive",
  "to": "{{to}}",
  "interactive": {
    "type": "cta_url",
    "body": { "text": "Visit our store" },
    "footer": { "text": "Limited time" },
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "Open store",
        "url": "https://example.com/store"
      }
    }
  }
}
```

### Infrastructure
None. No new dependencies required.

## Non-functional Requirements

### Compatibility
- Must render on WhatsApp iOS (primary failing platform)
- Must render on WhatsApp Android
- Must render on WhatsApp Web/Desktop
- Sender must be a WhatsApp Business App account (nativeFlowMessage is not supported by personal accounts)

### Fragility note
WhatsApp has been known to patch unofficial button support periodically. This approach works as of April 2026 based on Evolution API production usage, but may break in future WhatsApp client updates.

## Dependencies
- `@whiskeysockets/baileys` already installed — proto types for `viewOnceMessage`, `interactiveMessage`, `nativeFlowMessage` all exist in `WAProto/index.d.ts`
- No new packages needed

## Constraints
- Do not change the public API input format (Meta Cloud API compatible)
- Do not add `viewOnceMessage` wrapping to `button` or `list` types — they use different native protos and already work
- The forward-wrapper in the send layer (`whatsapp.service.ts`) is only for `listMessage` — do not extend it to cover this

## Open Questions
None — implementation path is fully defined by Evolution API and InfiniteAPI research.
