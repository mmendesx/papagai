# PRD: Baileys Connection Fix — QR Code, Build Reliability & QR Rendering

**Spec**: tasks/specs/spec-2-baileys-connection-fix.md
**Status**: IMPLEMENTED

---

## Summary

WhatsApp instance creation failed because Baileys 6.7.21 presented an outdated protocol fingerprint
rejected by WhatsApp servers with reason 405, causing an infinite reconnect loop. Four fixes were
implemented: upgrading Baileys to 7.0.0-rc.9 with dynamic version fetching, a 5-attempt reconnect
circuit breaker, QR rendering via `qrcode` + `qrcode-terminal`, and a reliable build pipeline.

---

## BDD Scenarios

### Feature: QR Code Generation

#### Scenario 1 — Instance generates QR code
```
Given the server is running with Baileys 7.0.0-rc.9
When POST /instances/create is called with {"name": "papagai01"}
Then the response is {success: true}
And within 15 seconds, GET /instances/papagai01/qr returns {status: "qr", qr: "<string>", qrImageData: "data:image/png;base64,..."}
And server logs contain "QR code generated for instance \"papagai01\""
And the QR ASCII art is printed to stdout
```

#### Scenario 2 — Version fetch failure falls back gracefully
```
Given fetchLatestBaileysVersion() is unreachable
When POST /instances/create is called
Then the instance is created without throwing
And makeWASocket() is called with version: undefined (Baileys built-in default)
```

---

### Feature: Reconnect Circuit Breaker

#### Scenario 3 — Circuit breaker stops after 5 failures
```
Given a WA instance that fails to connect on every attempt
When it has disconnected 5 times without connection === 'open'
Then no further reconnect is scheduled
And the log contains "gave up reconnecting after 5 attempts" at error level
And GET /instances/:name/qr returns 404
```

#### Scenario 4 — Retry counter resets on successful connection
```
Given a WA instance that failed 3 times and then connected
When connection === 'open' is received
Then instance.retryCount is reset to 0
```

#### Scenario 5 — loggedOut stops reconnect immediately
```
Given a connected WA instance
When connection closes with DisconnectReason.loggedOut (401)
Then NO reconnect is scheduled
And the instance is removed immediately
```

#### Scenario 6 — Retry count survives the reconnect cycle
```
Given a WA instance with retryCount=3
When reconnectInstance() deletes and recreates the instance
Then the new instance has retryCount=3
```

---

### Feature: QR Rendering

#### Scenario 7 — Terminal ASCII QR printed on generation
```
Given a new WA instance being initialized
When Baileys emits a QR code
Then qrcode-terminal prints an ASCII QR to stdout
And the log contains "QR code generated for instance \"<name>\""
```

#### Scenario 8 — API returns base64 PNG
```
Given an instance with a pending QR code
When GET /instances/:name/qr is called
Then the response contains qrImageData starting with "data:image/png;base64,"
And the response status field is "qr"
```

---

### Feature: Build Pipeline

#### Scenario 9 — npm run build produces dist/
```
Given the project source files in src/
When `npm run build` is executed
Then it exits with code 0
And dist/main.js exists
```

#### Scenario 10 — Build is idempotent
```
Given dist/ already exists
When `npm run build` is executed again
Then it exits with code 0
And dist/ contains recompiled output
```

---

## Tasks (all DONE)

| ID | Title | Files | Size | Status |
|---|---|---|---|---|
| ICT-1 | Upgrade Baileys to 7.0.0-rc.9, add qrcode packages | `package.json` | S | ✅ Done |
| ICT-2 | Dynamic WA version fetch + retryCount init | `whatsapp.service.ts`, `whatsapp.interface.ts` | S | ✅ Done |
| ICT-3 | Reconnect circuit breaker | `whatsapp.service.ts` | S | ✅ Done |
| ICT-4 | QR rendering (terminal + base64 PNG) | `whatsapp.service.ts`, `instances.controller.ts` | S | ✅ Done |
| ICT-5 | Fix build pipeline (tsc directly, incremental:false) | `package.json`, `tsconfig.build.json` | S | ✅ Done |

---

## Implementation Notes

- `fetchLatestBaileysVersion()` fetches from GitHub raw content — requires network access at startup
- `qrcode-terminal.generate()` uses callback form: `(qrText) => console.log(qrText)`
- `QRCode.toDataURL()` is async — awaited in the controller before returning the response
- Circuit breaker check: `retryCount > MAX_RETRIES` (5), so the 6th disconnect triggers give-up
- `reconnectInstance(name, retryCount)` passes carry-over count to new instance after recreate
- Build: `tsconfig.build.json` now overrides `incremental: false` to prevent stale-tsbuildinfo issues
