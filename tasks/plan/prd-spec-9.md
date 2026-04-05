# PRD: CTA Interactive Buttons (cta_url / cta_copy) Cross-Platform Fix

**Spec**: tasks/specs/spec-9-cta-interactive-buttons.md

## Summary
Papagai currently downgrades `cta_url` and `cta_copy` interactive messages to plain text because the `nativeFlowMessage` format silently fails on iOS. Research into Evolution API and InfiniteAPI reveals that wrapping the `interactiveMessage` inside a `viewOnceMessage` envelope — along with `merchant_url` duplication and `messageVersion: 2` — is the production-proven fix. This is a single-file transformer change with no API surface or dependency changes.

## Behavior Scenarios

### Feature: cta_url interactive button delivery

#### Scenario: cta_url delivers as tappable button to iOS recipient
  Given a connected Business WhatsApp instance
  And a recipient on iOS WhatsApp
  When the API caller sends `type: "interactive"` with `interactive.type: "cta_url"` and a valid URL
  Then the recipient receives a tappable button that opens the URL when tapped
  And the message does not appear as plain text

#### Scenario: cta_url includes merchant_url in button params
  Given a cta_url payload with `parameters.url: "https://example.com"`
  When the transformer converts it to Baileys format
  Then the resulting `buttonParamsJson` contains both `url` and `merchant_url` set to `"https://example.com"`

#### Scenario: cta_url is wrapped in viewOnceMessage
  Given a cta_url interactive payload
  When the transformer converts it to Baileys format
  Then the root key of the returned content object is `viewOnceMessage`
  And `viewOnceMessage.message.interactiveMessage` contains the button

#### Scenario: cta_url without header still sends
  Given a cta_url payload with no `interactive.header` field
  When the transformer converts it to Baileys format
  Then the message is built with `header.title: ""` and no error is thrown

#### Scenario: cta_url without footer omits footer field
  Given a cta_url payload with no `interactive.footer` field
  When the transformer converts it to Baileys format
  Then the resulting `interactiveMessage` has no `footer` field

### Feature: cta_copy interactive button delivery

#### Scenario: cta_copy delivers as copy-code button to iOS recipient
  Given a connected Business WhatsApp instance
  And a recipient on iOS WhatsApp
  When the API caller sends `type: "interactive"` with `interactive.type: "cta_copy"` and a copy code
  Then the recipient receives a button that copies the code to clipboard when tapped
  And the message does not appear as plain text

#### Scenario: cta_copy buttonParamsJson contains display_text and copy_code
  Given a cta_copy payload with `parameters.display_text: "Copy key"` and `parameters.copy_code: "PIX123"`
  When the transformer converts it to Baileys format
  Then the resulting `buttonParamsJson` is `{"display_text":"Copy key","copy_code":"PIX123"}`

#### Scenario: cta_copy is wrapped in viewOnceMessage
  Given a cta_copy interactive payload
  When the transformer converts it to Baileys format
  Then the root key of the returned content object is `viewOnceMessage`

### Feature: nativeFlowMessage metadata

#### Scenario: messageVersion is set to 2
  Given any cta_url or cta_copy payload
  When the transformer converts it to Baileys format
  Then `nativeFlowMessage.messageVersion` equals `2`

#### Scenario: messageParamsJson is a valid JSON string
  Given any cta_url or cta_copy payload
  When the transformer converts it to Baileys format
  Then `nativeFlowMessage.messageParamsJson` is parseable JSON (e.g. `"{}"`)

### Feature: existing interactive types unaffected

#### Scenario: button type still uses buttonsMessage
  Given an interactive payload with `interactive.type: "button"`
  When the transformer converts it
  Then the result contains `buttons` array at root (buttonsMessage format)
  And the result does NOT contain `viewOnceMessage`

#### Scenario: list type still uses listMessage with forward wrapper
  Given an interactive payload with `interactive.type: "list"`
  When the transformer converts it
  Then the result contains `listMessage` at root
  And the result does NOT contain `viewOnceMessage`

## Tasks

### ICT-1: Replace buildCtaFallbackText with buildCtaInteractiveMessage in transformer
- **What**: Delete `buildCtaFallbackText` and implement `buildCtaInteractiveMessage` that returns the `viewOnceMessage`-wrapped proto shape for both `cta_url` and `cta_copy`. Ensure `merchant_url` duplicates `url`, `messageVersion: 2`, and `messageParamsJson: '{}'` are set. Update the `interactive` case in `toMessageContent` to call the new function.
- **Where**: `src/whatsapp/utils/transformer.ts`
- **Validated by**: cta_url delivers as tappable button, cta_url includes merchant_url, cta_url is wrapped in viewOnceMessage, cta_copy delivers as copy-code button, cta_copy buttonParamsJson contains display_text and copy_code, cta_copy is wrapped in viewOnceMessage, messageVersion is set to 2, messageParamsJson is a valid JSON string
- **Estimate**: S

### ICT-2: Verify button and list types are unaffected
- **What**: Confirm the `button` and `list` branches in `toMessageContent` still return their existing formats (buttonsMessage and listMessage respectively) and are not touched by ICT-1.
- **Where**: `src/whatsapp/utils/transformer.ts` (read-only verification), `src/whatsapp/whatsapp.service.ts` (forward wrapper still only targets `listMessage`)
- **Validated by**: button type still uses buttonsMessage, list type still uses listMessage with forward wrapper
- **Estimate**: S

## Open Questions
None.

## Dependencies
- `@whiskeysockets/baileys` — already installed, `viewOnceMessage` proto type present in `WAProto/index.d.ts`
