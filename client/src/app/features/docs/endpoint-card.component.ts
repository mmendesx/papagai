import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import type { EndpointDef, HttpMethod } from './api-endpoints';
import { DocsNavigationService } from './docs-navigation.service';
import { TryItPanelComponent } from './try-it-panel.component';

@Component({
  selector: 'app-endpoint-card',
  standalone: true,
  imports: [TryItPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[id]': 'endpoint().id' },
  animations: [
    trigger('expandBody', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('200ms cubic-bezier(0,0,0.2,1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ])
  ],
  template: `
    <article class="ep-card" [class.ep-card--open]="expanded()" [class.ep-card--detail]="detailMode()">
      @if (detailMode()) {
        <div class="ep-header ep-header--static">
          <div class="ep-method-wrap">
            <span [class]="badgeClass()">{{ endpoint().method }}</span>
          </div>
          <div class="ep-info">
            <code class="ep-path">
              @for (part of pathParts(); track $index) {
                @if (part.startsWith(':')) {
                  <span class="path-param">{{ part }}</span>
                } @else {
                  {{ part }}
                }
              }
            </code>
            <span class="ep-title">{{ endpoint().title }}</span>
          </div>
          <div class="ep-right">
            @for (chip of authChips(); track chip) {
              <span class="auth-chip">{{ chip }}</span>
            }
          </div>
        </div>
      } @else {
        <button type="button" class="ep-header" (click)="toggleExpanded()" [attr.aria-expanded]="expanded()">
        <div class="ep-method-wrap">
          <span [class]="badgeClass()">{{ endpoint().method }}</span>
        </div>
        <div class="ep-info">
          <code class="ep-path">
            @for (part of pathParts(); track $index) {
              @if (part.startsWith(':')) {
                <span class="path-param">{{ part }}</span>
              } @else {
                {{ part }}
              }
            }
          </code>
          <span class="ep-title">{{ endpoint().title }}</span>
        </div>
        <div class="ep-right">
          @for (chip of authChips(); track chip) {
            <span class="auth-chip">{{ chip }}</span>
          }
          <span class="ep-chevron" [class.ep-chevron--open]="expanded()" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
        </button>
      }

      <!-- Expanded body -->
      @if (expanded()) {
        <div class="ep-body" [@expandBody]>
          <p class="ep-desc">{{ endpoint().description }}</p>

          <!-- Path params -->
          @if (endpoint().pathParams?.length) {
            <div class="ep-section">
              <h4 class="ep-section-title">Parâmetros de rota</h4>
              <div class="param-table">
                @for (p of endpoint().pathParams!; track p.name) {
                  <div class="param-row">
                    <code class="param-name">{{ p.name }}</code>
                    <span class="param-type">string</span>
                    <span class="param-desc">{{ p.description }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Query params -->
          @if (endpoint().queryParams?.length) {
            <div class="ep-section">
              <h4 class="ep-section-title">Query params</h4>
              <div class="param-table">
                @for (p of endpoint().queryParams!; track p.name) {
                  <div class="param-row">
                    <code class="param-name">{{ p.name }}</code>
                    <span class="param-type">{{ p.type }}</span>
                    @if (p.required) { <span class="param-required">obrigatório</span> }
                    <span class="param-desc">{{ p.description }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Body params -->
          @if (endpoint().bodyParams?.length) {
            <div class="ep-section">
              <h4 class="ep-section-title">Corpo (JSON)</h4>
              <div class="param-table">
                @for (p of endpoint().bodyParams!; track p.name) {
                  <div class="param-row">
                    <code class="param-name">{{ p.name }}</code>
                    <span class="param-type">{{ p.type }}</span>
                    @if (p.required) { <span class="param-required">obrigatório</span> }
                    <span class="param-desc">{{ p.description }}</span>
                  </div>
                }
              </div>
            </div>
          }

          @if (endpoint().bodyExamples?.length) {
            <div class="ep-section">
              <h4 class="ep-section-title">Exemplos de corpo</h4>
              <div class="example-list">
                @for (example of endpoint().bodyExamples!; track example.title) {
                  <div class="code-block-wrap">
                    <div class="code-meta">
                      <span class="lang-tag">{{ example.title }}</span>
                      <button type="button" class="copy-btn" (click)="copy(example.json, example.title); $event.stopPropagation()">
                        {{ copied() === example.title ? '✓ Copiado' : 'Copiar' }}
                      </button>
                    </div>
                    <pre class="code-block"><code>{{ example.json }}</code></pre>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Response example -->
          <div class="ep-section">
            <h4 class="ep-section-title">Resposta</h4>
            <div class="code-block-wrap">
              <div class="code-meta">
                <span class="lang-tag">json</span>
                <button type="button" class="copy-btn" (click)="copy(endpoint().responseExample, 'res'); $event.stopPropagation()">
                  {{ copied() === 'res' ? '✓ Copiado' : 'Copiar' }}
                </button>
              </div>
              <pre class="code-block"><code>{{ endpoint().responseExample }}</code></pre>
            </div>
          </div>

          <!-- Error codes -->
          @if (endpoint().errorCodes.length > 0) {
            <div class="ep-section">
              <h4 class="ep-section-title">Erros</h4>
              <div class="error-chips">
                @for (e of endpoint().errorCodes; track e.status) {
                  <div class="error-chip">
                    <span class="error-status">{{ e.status }}</span>
                    <span class="error-desc">{{ e.description }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Curl example -->
          <div class="ep-section">
            <h4 class="ep-section-title">curl</h4>
            <div class="code-block-wrap">
              <div class="code-meta">
                <span class="lang-tag">bash</span>
                <button type="button" class="copy-btn" (click)="copy(curlExpanded(), 'curl'); $event.stopPropagation()">
                  {{ copied() === 'curl' ? '✓ Copiado' : 'Copiar' }}
                </button>
              </div>
              <pre class="code-block"><code>{{ curlExpanded() }}</code></pre>
            </div>
          </div>

          <!-- Try it -->
          @if (endpoint().tryItDisabledReason) {
            <div class="manual-note">
              <strong>Try It manual:</strong>
              <span>{{ endpoint().tryItDisabledReason }}</span>
            </div>
          } @else {
            <div class="try-it-shell">
              <app-try-it-panel [endpoint]="endpoint()" />
            </div>
          }
        </div>
      }
    </article>
  `,
  styles: [
    `
      :host { display: block; }

      .ep-card {
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        overflow: hidden;
        transition: border-color var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default);
      }
      .ep-card:hover { border-color: var(--color-outline); }
      .ep-card--open {
        border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-outline-variant));
        box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 8%, transparent);
      }
      .ep-card--detail { box-shadow: none; }

      .ep-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.875rem 1.125rem;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        font-family: var(--font-sans);
        color: inherit;
        transition: background var(--duration-fast) var(--ease-default);
      }
      .ep-header:hover { background: var(--color-surface-container-low); }
      .ep-header--static { cursor: default; }
      .ep-header--static:hover { background: transparent; }
      .ep-card--open .ep-header {
        background: color-mix(in srgb, var(--color-primary) 3%, transparent);
        border-bottom: 1px solid var(--color-outline-variant);
      }

      .ep-method-wrap { flex-shrink: 0; }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 3.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-md);
        font-family: var(--font-brand);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .method-get { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
      .method-post { background: var(--color-primary-container); color: var(--color-on-primary-container); }
      .method-patch { background: var(--color-warning-bg); color: var(--color-method-patch); }
      .method-delete { background: var(--color-error-container); color: var(--color-on-error-container); }

      .ep-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
      .ep-path {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.8125rem;
        color: var(--color-on-surface);
        word-break: break-all;
        line-height: 1.4;
      }
      .path-param { color: var(--color-primary); font-weight: 600; }
      .ep-title {
        font-family: var(--font-sans);
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ep-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
      .auth-chip {
        font-family: var(--font-brand);
        font-size: 0.5625rem;
        font-weight: 700;
        letter-spacing: 0.07em;
        padding: 0.15rem 0.45rem;
        border-radius: var(--radius-full);
        background: color-mix(in srgb, var(--color-warning-bg) 60%, transparent);
        color: var(--color-method-patch);
        border: 1px solid color-mix(in srgb, var(--color-method-patch) 20%, transparent);
      }
      .ep-chevron {
        color: var(--color-outline);
        transition: transform var(--duration-fast) var(--ease-spring);
        display: flex;
      }
      .ep-chevron--open { transform: rotate(180deg); }

      /* Expanded body */
      .ep-body { padding: 1.25rem 1.125rem 1.25rem; }
      .ep-desc {
        font-family: var(--font-sans);
        font-size: 0.875rem;
        color: var(--color-on-surface-variant);
        margin: 0 0 1.25rem;
        line-height: 1.6;
      }

      .ep-section { margin-bottom: 1.25rem; }
      .ep-section:last-child { margin-bottom: 0; }
      .ep-section-title {
        font-family: var(--font-display);
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-on-surface-variant);
        margin: 0 0 0.625rem;
      }

      /* Param table */
      .param-table { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); overflow: hidden; }
      .param-row {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.625rem 0.875rem;
        border-bottom: 1px solid var(--color-outline-variant);
        font-family: var(--font-sans);
        font-size: 0.8125rem;
      }
      .param-row:last-child { border-bottom: none; }
      .param-row:nth-child(even) { background: var(--color-surface-container-low); }
      .param-name {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        padding: 0.1rem 0.375rem;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
        min-width: 7rem;
      }
      .param-type {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.6875rem;
        color: var(--color-on-surface-variant);
        flex-shrink: 0;
        padding-top: 0.1rem;
        min-width: 4rem;
      }
      .param-required {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--color-error);
        background: var(--color-error-bg);
        padding: 0.1rem 0.375rem;
        border-radius: var(--radius-full);
        flex-shrink: 0;
        align-self: center;
      }
      .param-desc { color: var(--color-on-surface-variant); line-height: 1.5; flex: 1; }

      .example-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      /* Code blocks */
      .code-block-wrap {
        border-radius: var(--radius-lg);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .code-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4rem 0.75rem;
        background: color-mix(in srgb, var(--color-code-bg) 95%, transparent);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .lang-tag {
        font-family: var(--font-brand);
        font-size: 0.5625rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(226,217,243,0.45);
      }
      .copy-btn {
        font-family: var(--font-sans);
        font-size: 0.6875rem;
        font-weight: 500;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        color: rgba(226,217,243,0.65);
        padding: 0.175rem 0.55rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--duration-fast);
      }
      .copy-btn:hover { background: rgba(255,255,255,0.13); color: #e2d9f3; }
      .code-block {
        margin: 0;
        padding: 0.875rem 1rem;
        background: var(--color-code-bg);
        color: var(--color-code-text);
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.8125rem;
        line-height: 1.6;
        overflow-x: auto;
        max-height: 18rem;
      }

      /* Error chips */
      .error-chips { display: flex; flex-direction: column; gap: 0.375rem; }
      .error-chip {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        background: color-mix(in srgb, var(--color-error) 4%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-error) 12%, var(--color-outline-variant));
        border-radius: var(--radius-lg);
      }
      .error-status {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-error);
        flex-shrink: 0;
        min-width: 2.5rem;
      }
      .error-desc {
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
        line-height: 1.5;
      }
      .manual-note {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        padding: 0.75rem 0.875rem;
        border: 1px solid color-mix(in srgb, var(--color-method-patch) 20%, var(--color-outline-variant));
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, var(--color-warning-bg) 45%, transparent);
        color: var(--color-on-surface-variant);
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        line-height: 1.5;
      }
      .manual-note strong {
        color: var(--color-method-patch);
        white-space: nowrap;
      }
      .try-it-shell {
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-lg);
        padding: 0.625rem;
        background: color-mix(in srgb, var(--color-surface-container-low) 70%, transparent);
      }
    `,
  ],
})
export class EndpointCardComponent {
  readonly endpoint = input.required<EndpointDef>();
  readonly forceExpanded = input(false);
  readonly detailMode = input(false);

  private readonly docsNav = inject(DocsNavigationService);

  readonly expanded = signal(false);

  constructor() {
    effect(() => {
      if (this.forceExpanded()) {
        this.expanded.set(true);
        return;
      }

      const targetId = this.docsNav.targetEndpointId();
      if (targetId && targetId === this.endpoint().id) {
        this.expanded.set(true);
        this.docsNav.clear();
      }
    });
  }

  readonly copied = signal<string | null>(null);

  toggleExpanded(): void {
    if (this.forceExpanded()) {
      return;
    }
    this.expanded.update((v) => !v);
  }

  readonly pathParts = computed(() => {
    const path = this.endpoint().path;
    return path.split(/(:[a-zA-Z_]+)/g).filter((s) => s.length > 0);
  });

  readonly authChips = computed(() => {
    const auth = this.endpoint().auth;
    if (auth === 'none') {
      return [] as string[];
    }
    if (auth === 'bearer') {
      return ['BEARER'];
    }
    if (auth === 'apiKey') {
      return ['X-API-KEY'];
    }
    return ['BEARER', 'X-API-KEY'];
  });

  readonly curlExpanded = computed(() => {
    const ep = this.endpoint();
    return ep.curlExample.replaceAll('$BASE', typeof window !== 'undefined' ? window.location.origin : 'https://your-host');
  });

  badgeClass(): string {
    const m = this.endpoint().method as HttpMethod;
    const map: Record<HttpMethod, string> = {
      GET: 'method-get',
      POST: 'method-post',
      PATCH: 'method-patch',
      DELETE: 'method-delete',
    };
    return `badge ${map[m]}`;
  }

  async copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(key);
      setTimeout(() => {
        this.copied.update((c) => (c === key ? null : c));
      }, 2000);
    } catch {
      void 0;
    }
  }
}
