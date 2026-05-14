import { HttpClient, HttpContext, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { finalize } from 'rxjs/operators';
import { DOCS_TRY_IT, DocsTryItAuthMode } from '../../core/http/docs-try-it.context';
import type { EndpointAuthType, EndpointDef } from './api-endpoints';

const TOKEN_KEY = 'papagai_access_token';

@Component({
  selector: 'app-try-it-panel',
  standalone: true,
  imports: [FormsModule, TuiButton, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="try-head">
      <button
        tuiButton
        type="button"
        size="s"
        appearance="secondary"
        [disabled]="!!endpoint().tryItDisabledReason"
        (click)="toggleExpanded()"
      >
        {{ expanded() ? 'Ocultar' : 'Testar' }}
      </button>
    </div>
    @if (expanded()) {
      <div class="try-panel">
        <header class="try-header">
          <p class="try-url">
            <span class="method">{{ endpoint().method }}</span>
            <code>{{ fullUrl() }}</code>
          </p>
        </header>
        @if (pathParamNames().length > 0) {
          <section class="try-section params">
            <h5>Parâmetros de rota</h5>
            @for (name of pathParamNames(); track name) {
              <tui-textfield>
                <label tuiLabel>Path: {{ name }}</label>
                <input
                  tuiTextfield
                  type="text"
                  [ngModel]="paramValues()[name] || ''"
                  (ngModelChange)="setParam(name, $event)"
                  autocomplete="off"
                />
              </tui-textfield>
            }
          </section>
        }
        <section class="try-section auth-controls">
          <h5>Autenticação</h5>
          <label class="auth-label" for="try-auth-mode-{{ endpoint().id }}">Autenticação</label>
          <select
            class="auth-select"
            id="try-auth-mode-{{ endpoint().id }}"
            [ngModel]="authMode()"
            (ngModelChange)="setAuthMode($event)"
          >
            <option value="none">Sem autenticação</option>
            <option value="bearer">Bearer token</option>
            <option value="apiKey">API key (X-Api-Key)</option>
          </select>
        </section>
        @if (authMode() === 'bearer') {
          <tui-textfield>
            <label tuiLabel>Bearer token</label>
            <input
              tuiTextfield
              type="text"
              [ngModel]="bearerToken()"
              (ngModelChange)="bearerToken.set($event)"
              autocomplete="off"
            />
          </tui-textfield>
        }
        @if (authMode() === 'apiKey') {
          <tui-textfield>
            <label tuiLabel>X-Api-Key</label>
            <input
              tuiTextfield
              type="text"
              [ngModel]="apiKeyValue()"
              (ngModelChange)="apiKeyValue.set($event)"
              autocomplete="off"
            />
          </tui-textfield>
        }
        @if (showBody()) {
          <label class="body-label">Corpo JSON</label>
          <textarea
            class="body-input"
            rows="8"
            [ngModel]="bodyText()"
            (ngModelChange)="bodyText.set($event)"
            spellcheck="false"
          ></textarea>
        }
        <div class="try-actions">
          <button tuiButton type="button" size="s" [disabled]="loading()" (click)="send()">
            {{ loading() ? 'Enviando…' : 'Executar' }}
          </button>
        </div>
        @if (result(); as r) {
          <div class="result" [class.err]="r.status >= 400 || r.status === 0">
            <div class="result-meta">
              <span>Status: {{ r.status || '—' }}</span>
              <span>{{ r.ms }} ms</span>
            </div>
            <pre class="result-body"><code>{{ r.body }}</code></pre>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .try-head {
        margin-top: 0.75rem;
      }
      .try-panel {
        margin-top: 0.75rem;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container-lowest);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .try-header {
        border-bottom: 1px solid var(--color-outline-variant);
        padding-bottom: 0.625rem;
      }
      .try-url {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        font: var(--tui-font-text-s);
      }
      .try-url .method {
        font-weight: 600;
        color: var(--tui-text-action);
      }
      .try-url code {
        word-break: break-all;
        font-size: 0.85em;
      }
      .params {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .try-section h5 {
        margin: 0 0 0.5rem;
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .auth-controls {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .auth-label {
        font: var(--tui-font-text-s);
        font-weight: 600;
      }
      .auth-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-md);
        background: var(--color-surface-container-low);
        color: var(--color-on-surface);
        padding: 0.5rem 0.75rem;
        font: var(--tui-font-text-m);
      }
      .body-label {
        font: var(--tui-font-text-s);
        font-weight: 600;
      }
      .body-input {
        width: 100%;
        box-sizing: border-box;
        font-family: ui-monospace, monospace;
        font-size: 0.8125rem;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container-low);
        color: var(--color-on-surface);
        resize: vertical;
        min-height: 6rem;
      }
      .try-actions {
        display: flex;
        gap: 0.5rem;
      }
      .result {
        border-radius: 6px;
        border: 1px solid var(--tui-status-positive);
        overflow: hidden;
      }
      .result.err {
        border-color: var(--tui-status-negative);
      }
      .result-meta {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.35rem 0.5rem;
        font: var(--tui-font-text-s);
        background: var(--tui-background-elevation-1);
      }
      .result-body {
        margin: 0;
        padding: 0.75rem;
        max-height: 16rem;
        overflow: auto;
        font-size: 0.75rem;
        line-height: 1.4;
      }
    `,
  ],
})
export class TryItPanelComponent {
  private readonly http = inject(HttpClient);

  readonly endpoint = input.required<EndpointDef>();

  readonly expanded = signal(false);
  readonly paramValues = signal<Record<string, string>>({});
  readonly authMode = signal<DocsTryItAuthMode>('none');
  readonly bearerToken = signal('');
  readonly apiKeyValue = signal('');
  readonly bodyText = signal('');
  readonly loading = signal(false);
  readonly result = signal<{ status: number; ms: number; body: string } | null>(null);

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }

  constructor() {
    effect(() => {
      const ep = this.endpoint();
      const init: Record<string, string> = {};
      for (const p of ep.pathParams ?? []) {
        init[p.name] = p.placeholder;
      }
      this.paramValues.set(init);
      this.authMode.set(this.defaultAuthMode(ep.auth));
      this.bearerToken.set(localStorage.getItem(TOKEN_KEY) ?? '');
      this.apiKeyValue.set('');
      this.bodyText.set(ep.tryBody ?? '{}');
      this.result.set(null);
    });
  }

  pathParamNames(): string[] {
    const ep = this.endpoint();
    return (ep.pathParams ?? []).map((p) => p.name);
  }

  showBody(): boolean {
    const m = this.endpoint().method;
    return m === 'POST' || m === 'PATCH';
  }

  setParam(name: string, value: string): void {
    this.paramValues.update((v) => ({ ...v, [name]: value }));
  }

  setAuthMode(mode: string): void {
    if (mode === 'bearer' || mode === 'apiKey' || mode === 'none') {
      this.authMode.set(mode);
      return;
    }
    this.authMode.set('none');
  }

  resolvedPath(): string {
    let p = this.endpoint().path;
    const vals = this.paramValues();
    for (const [k, v] of Object.entries(vals)) {
      p = p.replace(`:${k}`, encodeURIComponent(v));
    }
    return p;
  }

  fullUrl(): string {
    let path = this.resolvedPath();
    const q = this.endpoint().tryQuery;
    if (q) {
      path += (path.includes('?') ? '&' : '?') + q;
    }
    return path;
  }

  send(): void {
    const ep = this.endpoint();
    if (ep.tryItDisabledReason) {
      this.result.set({ status: 0, ms: 0, body: ep.tryItDisabledReason });
      return;
    }

    const url = this.fullUrl();
    const t0 = performance.now();
    this.loading.set(true);
    this.result.set(null);

    let body: unknown = undefined;
    if (this.showBody()) {
      try {
        body = JSON.parse(this.bodyText() || '{}');
      } catch {
        this.result.set({ status: 0, ms: 0, body: 'Invalid JSON in body' });
        this.loading.set(false);
        return;
      }
    }

    const ctx = new HttpContext().set(DOCS_TRY_IT, {
      mode: this.authMode(),
      bearerToken: this.bearerToken().trim(),
      apiKey: this.apiKeyValue().trim(),
    });

    this.http
      .request(ep.method, url, {
        body,
        observe: 'response',
        responseType: 'json',
        context: ctx,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res: HttpResponse<unknown>) => {
          const ms = Math.round(performance.now() - t0);
          const raw = res.body;
          const text =
            raw === null || raw === undefined
              ? ''
              : typeof raw === 'string'
                ? raw
                : JSON.stringify(raw, null, 2);
          this.result.set({ status: res.status, ms, body: text });
        },
        error: (err: unknown) => {
          const ms = Math.round(performance.now() - t0);
          if (err instanceof HttpErrorResponse) {
            const e = err.error;
            const text =
              e !== null && typeof e === 'object'
                ? JSON.stringify(e, null, 2)
                : String(e ?? err.message);
            this.result.set({ status: err.status, ms, body: text });
          } else {
            this.result.set({ status: 0, ms, body: String(err) });
          }
        },
      });
  }

  private defaultAuthMode(auth: EndpointAuthType): DocsTryItAuthMode {
    if (auth === 'none') {
      return 'none';
    }
    if (auth === 'apiKey') {
      return 'apiKey';
    }
    return 'bearer';
  }
}
