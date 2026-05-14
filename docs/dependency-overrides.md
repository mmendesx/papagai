# Dependency Overrides

This file tracks active `overrides` entries used for security remediation.

Last verified: 2026-05-14

## Backend (`/package.json`)

### Active overrides

| Package | Forced version | Rationale |
|---|---|---|
| `path-to-regexp` | `8.4.2` | Keep patched transitive version for Nest-related path matching. |
| `picomatch` | `4.0.4` | Keep patched transitive matcher version. |
| `music-metadata` | `11.12.3` | Keep patched transitive parser version. |
| `lodash` | `4.18.1` | Keep patched transitive utility version. |
| `axios` | `^1.15.2` | Resolves current axios advisories reported against `1.15.0/1.15.1`. |
| `follow-redirects` | `1.16.0` | Keep patched redirect handling version. |
| `fast-uri` | `^3.1.2` | Resolves transitive `fast-uri` advisories. |
| `@protobufjs/utf8` | `^1.1.1` | Resolves utf8 advisory chained through protobuf tooling. |
| `protobufjs` | `^7.5.6` | Resolves protobufjs advisory set affecting `<=7.5.5`. |
| `protobufjs-cli` | `^1.2.1` | Resolves protobuf CLI advisories affecting `<=1.2.0`. |
| `glob` | `^13.0.0` | Keeps deprecated transitive chain pinned to maintained version. |
| `inflight` | `^1.0.6` | Keeps compatibility pin used by existing toolchain. |

### Verification result

- Command: `npm audit --audit-level=moderate`
- Result (2026-05-14): `0 vulnerabilities`

## Client (`/client/package.json`)

### Active overrides

| Package | Forced version | Rationale |
|---|---|---|
| `minimatch` | `10.2.5` | Keep patched transitive minimatch version. |
| `serialize-javascript` | `7.0.5` | Keep patched serialization dependency. |
| `tar` | `7.5.13` | Keep patched tar version. |
| `vite` | `6.4.2` | Keep patched Vite line used by toolchain dependencies. |
| `follow-redirects` | `1.16.0` | Keep patched redirect handling version. |
| `postcss` | `8.5.10` | Keep patched PostCSS version. |
| `uuid` | `14.0.0` | Keep patched UUID chain. |
| `fast-uri` | `^3.1.2` | Resolves transitive `fast-uri` advisories. |
| `ip-address` | `^10.1.1` | Resolves transitive `ip-address` advisory. |
| `@babel/plugin-transform-modules-systemjs` | `^7.29.4` | Resolves advisory affecting `<=7.29.3`. |
| `karma > glob` | `7.2.3` | Required for Karma 6.4 file-list compatibility; newer `glob` breaks the client unit test runner. |
| `karma > minimatch` | `3.1.2` | Required for Karma 6.4 CommonJS compatibility; newer `minimatch` breaks exclusion matching. |

### Verification result

- Command: `npm audit --audit-level=moderate`
- Result (2026-05-14): `3 high severity vulnerabilities`
- Residual risk: the remaining findings are dev-only Karma test-runner dependencies (`karma` -> `glob`/`minimatch`). They are kept because forcing patched `glob`/`minimatch` versions breaks Karma 6.4 at runtime. Production dependencies remain covered by the other overrides above.
- Follow-up: migrate client unit tests away from Karma or upgrade to a Karma-compatible dependency line when available, then remove the scoped `karma` overrides.
