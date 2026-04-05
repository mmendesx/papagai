# PRD: WhatsApp Interactive Messages

**Spec**: tasks/specs/spec-3-interactive-messages.md
**Status**: TODO

---

## Summary

Add four new interactive message types to the Papagai REST API using the modern Baileys
`interactiveMessage` / `nativeFlowMessage` protobuf path: tappable reply buttons, scrollable list
messages, CTA URL buttons, and copy-code buttons (for Pix keys, OTPs, coupon codes). The deprecated
`/send/buttons` endpoint is preserved untouched for backward compatibility.

---

## BDD Scenarios

### Feature: Interactive Reply Buttons

#### Scenario 1 — 3 reply buttons delivered
```
Given a connected instance "papagai01"
When POST /instances/papagai01/send/interactive-buttons with:
  { "to": "...", "body": "Escolha:", "buttons": [{"id":"a","displayText":"A"},{"id":"b","displayText":"B"},{"id":"c","displayText":"C"}] }
Then response is { success: true, messageId: "<string>" }
And the message shows 3 tappable reply buttons on Android and iOS
```

#### Scenario 2 — 0 buttons → 400
```
When called with { "buttons": [] }
Then response status is 400 (buttons must have at least 1 item)
```

#### Scenario 3 — 4 buttons → 400
```
When called with 4 button objects
Then response status is 400 (buttons may not exceed 3)
```

#### Scenario 4 — header and footer omitted
```
When called without header and footer
Then response is { success: true, ... }
And message is delivered without header/footer sections
```

---

### Feature: List Message

#### Scenario 5 — List with sections delivered
```
Given a connected instance "papagai01"
When POST /instances/papagai01/send/list with:
  { "body": "Selecione:", "buttonText": "Ver opções", "sections": [{"title":"Planos","rows":[{"id":"p1","title":"Básico","description":"R$ 29"},{"id":"p2","title":"Pro","description":"R$ 59"}]}] }
Then response is { success: true, messageId: "<string>" }
And message shows a "Ver opções" list button
And tapping it reveals the "Planos" section with 2 rows
```

#### Scenario 6 — Empty sections → 400
```
When called with { "sections": [] }
Then response status is 400
```

#### Scenario 7 — Row missing id → 400
```
When called with a row that has no id field
Then response status is 400
```

#### Scenario 8 — Row without description
```
When rows are sent without description
Then response is { success: true, ... }
And rows render with only title in WhatsApp
```

---

### Feature: CTA URL Button

#### Scenario 9 — Valid URL button delivered
```
Given a connected instance "papagai01"
When POST /instances/papagai01/send/cta-url with:
  { "body": "Acesse:", "buttonText": "Abrir loja", "url": "https://loja.exemplo.com.br" }
Then response is { success: true, messageId: "<string>" }
And the message shows an "Abrir loja" button that opens the URL when tapped
```

#### Scenario 10 — Invalid URL → 400
```
When called with { "url": "not-a-url" }
Then response status is 400
```

#### Scenario 11 — Header and footer included
```
When called with header "Promoção" and footer "Válido hoje"
Then response is { success: true, ... }
And header and footer appear in the rendered message
```

---

### Feature: Copy Code Button

#### Scenario 12 — Pix key copy button delivered
```
Given a connected instance "papagai01"
When POST /instances/papagai01/send/copy-code with:
  { "body": "Sua chave Pix:", "buttonText": "Copiar chave", "code": "chave@pix.com.br" }
Then response is { success: true, messageId: "<string>" }
And tapping the button copies "chave@pix.com.br" to clipboard
```

#### Scenario 13 — Empty code → 400
```
When called with { "code": "" }
Then response status is 400
```

#### Scenario 14 — OTP code
```
When called with { "code": "847291", "buttonText": "Copiar código" }
Then response is { success: true, ... }
And tapping copies "847291" to clipboard
```

---

### Shared Scenarios

#### Scenario 15 — Brazilian number resolution
```
Given any of the 4 new endpoints
When called with a Brazilian number in 13-digit format whose WA account is 12-digit
Then resolveJid() finds the registered format
And the message is delivered correctly
```

#### Scenario 16 — Disconnected instance → 400
```
Given an instance that exists but is not connected
When any of the 4 new endpoints is called
Then response status is 400 with "não está conectado"
```

---

## Tasks

| ID | Title | Files | Size | Depends on |
|---|---|---|---|---|
| ICT-1 | Interfaces: InteractiveButton, ListRow, ListSection | `whatsapp.interface.ts` | S | — |
| ICT-2 | DTOs: 4 top-level + 3 nested | `send-message.dto.ts` | M | ICT-1 |
| ICT-3 | Service methods + InstancesService proxies | `whatsapp.service.ts`, `instances.service.ts` | M | ICT-1 |
| ICT-4 | Controller endpoints | `instances.controller.ts` | S | ICT-2, ICT-3 |

**Totals**: 4 tasks — S: 2, M: 2, L: 0

---

## ICT-1: Interfaces (`whatsapp.interface.ts`)

Append after the existing `Button` interface:

```typescript
export interface InteractiveButton { id: string; displayText: string }
export interface ListRow           { id: string; title: string; description?: string }
export interface ListSection       { title: string; rows: ListRow[] }
```

---

## ICT-2: DTOs (`send-message.dto.ts`)

New imports needed from `class-validator`: `ArrayMinSize`, `ArrayMaxSize`, `IsUrl`, `IsNotEmpty`.
New imports from `class-transformer`: `Type` (already present).

Add in this order (child before parent to avoid forward-reference errors):

```typescript
export class InteractiveButtonDto {
  @IsString() id: string;
  @IsString() displayText: string;
}

export class ListRowDto {
  @IsString() id: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
}

export class ListSectionDto {
  @IsString() title: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ListRowDto) rows: ListRowDto[];
}

export class SendInteractiveButtonsDto {
  @IsString() to: string;
  @IsString() body: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => InteractiveButtonDto)
  buttons: InteractiveButtonDto[];
  @IsOptional() @IsString() header?: string;
  @IsOptional() @IsString() footer?: string;
}

export class SendListDto {
  @IsString() to: string;
  @IsString() body: string;
  @IsString() buttonText: string;
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => ListSectionDto)
  sections: ListSectionDto[];
  @IsOptional() @IsString() header?: string;
  @IsOptional() @IsString() footer?: string;
}

export class SendCtaUrlDto {
  @IsString() to: string;
  @IsString() body: string;
  @IsString() buttonText: string;
  @IsUrl() url: string;
  @IsOptional() @IsString() header?: string;
  @IsOptional() @IsString() footer?: string;
}

export class SendCopyCodeDto {
  @IsString() to: string;
  @IsString() body: string;
  @IsString() buttonText: string;
  @IsString() @IsNotEmpty() code: string;
  @IsOptional() @IsString() header?: string;
  @IsOptional() @IsString() footer?: string;
}
```

---

## ICT-3: Service Methods

### In `WhatsappService` (`whatsapp.service.ts`)

All 4 methods follow: `getConnectedInstance → resolveJid → sendMessage(jid, { interactiveMessage: { ... } } as any)`

```typescript
async sendInteractiveButtons(instanceName, to, body, buttons, header?, footer?) {
  const instance = this.getConnectedInstance(instanceName);
  const jid = await this.resolveJid(instance, to);
  return instance.socket.sendMessage(jid, {
    interactiveMessage: {
      header: { text: header ?? '', hasMediaAttachment: false },
      body: { text: body },
      footer: { text: footer ?? '' },
      nativeFlowMessage: {
        buttons: buttons.map(btn => ({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: btn.displayText, id: btn.id }),
        })),
      },
    },
  } as any);
}

async sendList(instanceName, to, body, buttonText, sections, header?, footer?) {
  const instance = this.getConnectedInstance(instanceName);
  const jid = await this.resolveJid(instance, to);
  return instance.socket.sendMessage(jid, {
    interactiveMessage: {
      header: { text: header ?? '', hasMediaAttachment: false },
      body: { text: body },
      footer: { text: footer ?? '' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: buttonText,
            sections: sections.map(s => ({
              title: s.title,
              rows: s.rows.map(r => ({ header: '', title: r.title, description: r.description ?? '', id: r.id })),
            })),
          }),
        }],
      },
    },
  } as any);
}

async sendCtaUrl(instanceName, to, body, buttonText, url, header?, footer?) {
  const instance = this.getConnectedInstance(instanceName);
  const jid = await this.resolveJid(instance, to);
  return instance.socket.sendMessage(jid, {
    interactiveMessage: {
      header: { text: header ?? '', hasMediaAttachment: false },
      body: { text: body },
      footer: { text: footer ?? '' },
      nativeFlowMessage: {
        buttons: [{
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({ display_text: buttonText, url, merchant_url: url }),
        }],
      },
    },
  } as any);
}

async sendCopyCode(instanceName, to, body, buttonText, code, header?, footer?) {
  const instance = this.getConnectedInstance(instanceName);
  const jid = await this.resolveJid(instance, to);
  return instance.socket.sendMessage(jid, {
    interactiveMessage: {
      header: { text: header ?? '', hasMediaAttachment: false },
      body: { text: body },
      footer: { text: footer ?? '' },
      nativeFlowMessage: {
        buttons: [{
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({ display_text: buttonText, copy_code: code }),
        }],
      },
    },
  } as any);
}
```

### In `InstancesService` (`instances.service.ts`)

Add 4 proxy methods delegating to `WhatsappService`, matching the signature of each method above.

---

## ICT-4: Controller Endpoints (`instances.controller.ts`)

Add imports: `SendInteractiveButtonsDto`, `SendListDto`, `SendCtaUrlDto`, `SendCopyCodeDto`

```typescript
@Post(':name/send/interactive-buttons')
async sendInteractiveButtons(@Param('name') name: string, @Body() dto: SendInteractiveButtonsDto) {
  try {
    const result = await this.instancesService.sendInteractiveButtons(name, dto.to, dto.body, dto.buttons, dto.header, dto.footer);
    return { success: true, messageId: result.key.id, message: '🦜 Papagai enviou botões interativos' };
  } catch (error) {
    throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
  }
}

@Post(':name/send/list')
async sendList(@Param('name') name: string, @Body() dto: SendListDto) {
  try {
    const result = await this.instancesService.sendList(name, dto.to, dto.body, dto.buttonText, dto.sections, dto.header, dto.footer);
    return { success: true, messageId: result.key.id, message: '🦜 Papagai enviou a lista' };
  } catch (error) {
    throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
  }
}

@Post(':name/send/cta-url')
async sendCtaUrl(@Param('name') name: string, @Body() dto: SendCtaUrlDto) {
  try {
    const result = await this.instancesService.sendCtaUrl(name, dto.to, dto.body, dto.buttonText, dto.url, dto.header, dto.footer);
    return { success: true, messageId: result.key.id, message: '🦜 Papagai enviou o link' };
  } catch (error) {
    throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
  }
}

@Post(':name/send/copy-code')
async sendCopyCode(@Param('name') name: string, @Body() dto: SendCopyCodeDto) {
  try {
    const result = await this.instancesService.sendCopyCode(name, dto.to, dto.body, dto.buttonText, dto.code, dto.header, dto.footer);
    return { success: true, messageId: result.key.id, message: '🦜 Papagai enviou o código' };
  } catch (error) {
    throw new HttpException(error instanceof Error ? error.message : String(error), HttpStatus.BAD_REQUEST);
  }
}
```

---

## Implementation Order

ICT-1 → ICT-2 → ICT-3 → ICT-4 (each depends on the previous)

## Notes

- `buttonParamsJson` must be `JSON.stringify(...)` — a string, never an object
- `header.hasMediaAttachment` must be `false` (boolean) — never omit it
- Cast the full message arg as `as any` — same pattern as existing `sendButtons`
- `row.header` in list rows must be `""` (empty string) — required by the proto schema
