# Dependency Overrides

This document records every `overrides` entry applied in the project's `package.json` files. Each entry forces a specific transitive dependency version to remediate a known CVE or advisory where a direct upgrade is not yet feasible. Entries are reviewed whenever the direct consumer is upgraded and the override may be dropped.

---

## Backend (`package.json`)

_Date added: 2026-04-07_

### Applied overrides

| Package | Forced version | CVE(s) / Advisory | Reason not upgraded directly |
|---|---|---|---|
| `path-to-regexp` | `8.4.2` | ReDoS in 8.0.0–8.3.0 | Direct consumer is `@nestjs/serve-static`; upgrading serve-static requires a NestJS major version bump |
| `picomatch` | `4.0.4` | Incorrect regex in 4.0.0–4.0.3 | Transitive via multiple tools; direct upgrade would require major dep changes |
| `music-metadata` | `11.12.3` | High severity in ≤11.12.1 | Transitive; override is a safe patch |
| `lodash` | `4.18.1` | Prototype pollution in ≤4.17.23 | Transitive via `@nestjs/config`; upgrading config requires a major version bump |
| `axios` | `^1.7.2` | GHSA-jr5f-v2jv-69x6, GHSA-43fc-jf86-j433 | `whaileys` 6.4.9 pins `axios ^0.24.0`, causing a nested install at ≤0.30.2; a direct upgrade is not feasible without forking or patching whaileys |

#### axios override — extended rationale

- **Date added**: 2026-04-07
- **CVEs remediated**: [GHSA-jr5f-v2jv-69x6](https://github.com/advisories/GHSA-jr5f-v2jv-69x6), [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) — both rated high severity
- **Root cause**: `whaileys` 6.4.9 declares `axios ^0.24.0` as a direct dependency. npm resolves this to the newest version satisfying that range (≤0.30.2), which carries the two CVEs above. The whaileys fork has no released patch.
- **Why the override is safe**: The whaileys source only calls `axios.get(url, { responseType, headers })`. This call signature is unchanged in axios 1.x. No interceptors, no `CancelToken`, no `axios.create()` with deprecated config, and no other breaking-change usage patterns were found in the whaileys source.
- **When to re-evaluate**: Remove this override when the whaileys fork drops its `^0.24.0` pin, or when the project migrates to upstream `@whiskeysockets/baileys`.

### Residual risks

These vulnerabilities are accepted and tracked. They cannot be resolved without a major dependency upgrade.

| Package | Vulnerable range | Reason accepted |
|---|---|---|
| `whaileys` | `*` | `fixAvailable: false` — fork of `@whiskeysockets/baileys` with no patched release available; tracked as OQ-1 |

---

## Client (`client/package.json`)

_Date added: 2026-04-07_

### Applied overrides

| Package | Forced version | CVE(s) / Advisory | Reason not upgraded directly |
|---|---|---|---|
| `minimatch` | `10.2.5` | ReDoS in 10.0.0–10.2.2 | Transitive via Angular CLI toolchain |
| `serialize-javascript` | `7.0.5` | XSS in ≤7.0.4 | Transitive via Angular build toolchain |
| `tar` | `7.5.13` | Path traversal in ≤7.5.10 | Transitive via Angular CLI |
| `vite` | `6.4.2` | High severity in ≤6.4.1 | Patch available in 6.x; Angular 19 confirmed compatible |

### Residual risks

These packages require a major framework upgrade (Angular 21 or Taiga UI 5.x) to fully remediate. Accepted and tracked under the Angular upgrade initiative.

| Package | Reason accepted | Follow-up |
|---|---|---|
| `@angular-devkit/build-angular` | Fix requires Angular 21 (major) | Track in Angular upgrade initiative |
| `@angular/build` | Same as above | Same |
| `@angular/cli` | Same as above | Same |
| `@taiga-ui/cdk`, `@taiga-ui/core`, `@taiga-ui/kit`, `@taiga-ui/layout` | Fix requires Taiga UI 5.x (major, breaking) | Track with Taiga UI upgrade |
| `copy-webpack-plugin` | Transitive via Angular build; fix tied to Angular 21 | Same |
| `ng-morph` | Transitive via Taiga UI | Same |
| `pacote` | Transitive via Angular CLI | Same |
