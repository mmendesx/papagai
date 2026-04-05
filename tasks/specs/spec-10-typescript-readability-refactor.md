# Spec 10 — TypeScript Readability Refactor

## Summary
Replace imperative if-else chains and switch statements with TypeScript-idiomatic dispatch tables (Record lookup maps) and discriminated unions. Zero functional change — pure structural refactor.

## Motivation
The current code uses long conditional chains to dispatch on string types. These patterns:
- Require reading every branch to understand the full type space
- Force adding a new `else if` or `case` scattered across the function body
- Lose the exhaustiveness benefits TypeScript can provide
- Are harder to test in isolation

A dispatch-table approach maps each type to its handler at declaration time, making the type space explicit, branches independently readable, and additions trivially safe.

## Scope

### Target 1 — `transformer.ts`: `buildCtaInteractiveMessage` (lines 59–114)
3-branch if-else-if on `interactive.type` (`cta_url`, `cta_copy`, `otp`).

Replace with a `Record<CtaInteractiveType, ButtonBuilder>` lookup where each builder is a named function or inline expression.

### Target 2 — `transformer.ts`: `toMessageContent` (lines 117–203)
11-case switch on `payload.type`.

Replace with a `Record<MessageType, MessageContentBuilder>` map. The `interactive` case already delegates to sub-builders; it stays that way, just moved into the map.

### Target 3 — `whatsapp.service.ts`: `enrichWebhookData` (lines 308–398)
12-case switch that mutates `webhookData` (async, uses `this`).

Replace with a `Record<string, WebhookEnricher>` map of async arrow functions. Since enrichers use `this.downloadMedia` and `this.parseVCard`, the map must be defined as a class property or inline inside the method with access to `this`.

### Target 4 — `whatsapp.service.ts`: `getMessageType` (lines 400–417)
12-level if chain detecting message type from a raw Baileys message object.

Replace with an ordered array of `[predicate, type]` tuples (or a function-per-entry array), iterated with `find`. The `audioMessage` special case (ptt check) is preserved inline.

## Non-goals
- No changes to external API or DTO shapes
- No changes to business logic, media handling, or error messages
- No new files unless there's a clear extraction win (e.g., a dedicated `message-type-detectors.ts`)
- No changes to test file behavior — existing tests must still pass

## TypeScript Patterns to Apply

### Dispatch table with Record
```ts
type MessageType = 'text' | 'image' | 'audio' | ...;
const MESSAGE_BUILDERS: Record<MessageType, (payload: any) => any> = {
  text: (p) => ({ text: p.text.body }),
  image: (p) => ({ image: { url: p.image.link }, caption: p.image.caption }),
  ...
};
```

### Detector array with find
```ts
const MESSAGE_TYPE_DETECTORS: Array<[(m: any) => boolean, string | ((m: any) => string)]> = [
  [(m) => !!(m.conversation || m.extendedTextMessage), 'text'],
  [(m) => !!m.imageMessage, 'image'],
  [(m) => !!m.audioMessage, (m) => m.audioMessage.ptt ? 'voice' : 'audio'],
  ...
];
```

## Constraints
- Must preserve the `throw new Error(...)` for unsupported types (both transformer and enricher)
- `enrichWebhookData` must remain `async` (media downloads are async)
- Tests at `src/whatsapp/whatsapp.service.spec.ts` and others must continue to pass without modification
