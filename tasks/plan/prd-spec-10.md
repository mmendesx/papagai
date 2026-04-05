# PRD spec-10 — TypeScript Readability Refactor

## BDD Scenarios

### Scenario 1: CTA button builder dispatches by type via lookup table
```
Given buildCtaInteractiveMessage receives { type: 'cta_url', action: { parameters: { display_text, url } } }
When the function runs
Then it returns an interactiveMessage with nativeFlowMessage button name 'cta_url' and correct buttonParamsJson
And no if-else-if chain is present in the implementation
```

### Scenario 2: CTA builder throws on unsupported type
```
Given buildCtaInteractiveMessage receives { type: 'unknown_type' }
When the function runs
Then it throws Error('Unsupported interactive type: unknown_type')
```

### Scenario 3: toMessageContent dispatches by type via lookup table
```
Given toMessageContent is called with payload { type: 'image', image: { link, caption } }
When the function runs
Then it returns { image: { url: link }, caption }
And no switch statement is present in the implementation
```

### Scenario 4: toMessageContent throws on unsupported type
```
Given toMessageContent is called with payload { type: 'unsupported' }
When the function runs
Then it throws Error('Unsupported message type: unsupported')
```

### Scenario 5: enrichWebhookData enriches text message via map
```
Given a Baileys message object with message.conversation = 'hello'
When enrichWebhookData is called with messageType 'text'
Then webhookData.text equals 'hello'
```

### Scenario 6: enrichWebhookData enriches media types via map
```
Given a Baileys message object with imageMessage present
When enrichWebhookData is called with messageType 'image'
Then webhookData.image is populated and webhookData.caption is set
```

### Scenario 7: getMessageType detects type via detector array
```
Given a Baileys message with message.imageMessage set
When getMessageType is called
Then it returns 'image'
```

### Scenario 8: getMessageType handles audio ptt branching
```
Given a Baileys message with message.audioMessage.ptt = true
When getMessageType is called
Then it returns 'voice'
```

### Scenario 9: All existing tests continue to pass
```
Given the full test suite at src/whatsapp/whatsapp.service.spec.ts
When tests are run after refactoring
Then all tests pass with no modifications to test files
```

---

## Tasks

### ICT-1: Refactor `buildCtaInteractiveMessage` — dispatch table
**File:** `src/whatsapp/utils/transformer.ts`
**Size:** S

Replace the 3-branch if-else-if chain (lines 59–114) with a typed lookup map:
1. Define `type CtaInteractiveType = 'cta_url' | 'cta_copy' | 'otp'`
2. Define `type NativeFlowButton = { name: string; buttonParamsJson: string }`
3. Create `const CTA_BUTTON_BUILDERS: Record<CtaInteractiveType, (params: any) => NativeFlowButton>`
   - `cta_url`: returns `{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text, url, merchant_url: url }) }`
   - `cta_copy`: returns `{ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text, copy_code }) }`
   - `otp`: returns `{ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text, otp_type: 'copy_code', text: copy_code, merchant_url: url }) }`
4. Replace if-else-if with:
   ```ts
   const builder = CTA_BUTTON_BUILDERS[interactive.type as CtaInteractiveType];
   if (!builder) throw new Error(`Unsupported interactive type: ${interactive.type}`);
   const button = builder(params);
   ```

**Acceptance:** Scenarios 1–2. All existing tests still pass.

---

### ICT-2: Refactor `toMessageContent` — dispatch table
**File:** `src/whatsapp/utils/transformer.ts`
**Size:** M

Replace the 11-case switch (lines 117–203) with a typed lookup map:
1. Define `type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'reaction' | 'interactive'`
2. Create `const MESSAGE_CONTENT_BUILDERS: Record<MessageType, (payload: any) => any>`
   - Each case becomes a function: `text: (p) => ({ text: p.text.body })`, etc.
   - The `contacts` case includes the local `contactList`/`firstContact`/`vcards` logic inline
   - The `interactive` case delegates to the existing `buildButtonMessage` / `buildListMessage` / `buildCtaInteractiveMessage` sub-builders using an inner lookup or nested ternary (keep it readable)
3. Replace the switch with:
   ```ts
   const builder = MESSAGE_CONTENT_BUILDERS[type as MessageType];
   if (!builder) throw new Error(`Unsupported message type: ${type}`);
   return builder(payload);
   ```
4. Remove the `// eslint-disable-next-line` comment if it's no longer needed after typing, or keep if still applicable

**Acceptance:** Scenarios 3–4. All existing tests still pass.

---

### ICT-3: Refactor `getMessageType` — detector array
**File:** `src/whatsapp/whatsapp.service.ts`
**Size:** S

Replace the 12-level if chain (lines 400–417) with an ordered detector array:
1. Define type `MessageTypeDetector = { test: (m: any) => boolean; type: string | ((m: any) => string) }`
2. Create `private readonly MESSAGE_TYPE_DETECTORS: MessageTypeDetector[]` with entries for each type
   - Audio entry uses a function for `type`: `(m) => m.audioMessage.ptt ? 'voice' : 'audio'`
3. Replace the if chain with:
   ```ts
   const m = msg.message;
   if (!m) return 'unknown';
   const detector = this.MESSAGE_TYPE_DETECTORS.find(({ test }) => test(m));
   if (!detector) return 'unknown';
   return typeof detector.type === 'function' ? detector.type(m) : detector.type;
   ```

**Acceptance:** Scenarios 7–8. All existing tests still pass.

---

### ICT-4: Refactor `enrichWebhookData` — enricher map
**File:** `src/whatsapp/whatsapp.service.ts`
**Size:** M

Replace the 12-case switch (lines 308–398) with an async enricher map:
1. Define type `WebhookEnricher = (msg: any, webhookData: WebhookData) => Promise<void>`
2. Inside the `enrichWebhookData` method body (to retain `this` access), build:
   ```ts
   const ENRICHERS: Partial<Record<string, WebhookEnricher>> = {
     text: async (msg, data) => { data.text = msg.message?.conversation || msg.message?.extendedTextMessage?.text; },
     image: async (msg, data) => { ... },
     ...
   };
   ```
   Each case body becomes an async arrow function, using `this.downloadMedia` and `this.parseVCard`.
3. Replace switch with:
   ```ts
   const enrich = ENRICHERS[messageType];
   if (enrich) await enrich(msg, webhookData);
   ```
4. Method signature and `async` modifier stay unchanged

**Acceptance:** Scenarios 5–6. All existing tests still pass.

---

### ICT-5: Verify full test suite
**Size:** S

Run the test suite and confirm all tests pass:
```bash
cd /Users/mmendesx/workspace/papagai && npm test
```

Ensure all 4 refactored locations are covered by existing or new tests:
- `buildCtaInteractiveMessage` (Scenarios 1–2)
- `toMessageContent` (Scenarios 3–4)
- `getMessageType` (Scenarios 7–8)
- `enrichWebhookData` (Scenarios 5–6)

If any scenario lacks test coverage, add minimal tests in `src/whatsapp/whatsapp.service.spec.ts` or create `src/whatsapp/utils/transformer.spec.ts`.

**Acceptance:** Scenario 9. `npm test` exits 0.
