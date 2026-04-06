import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import type { EndpointDef, HttpMethod } from './api-endpoints';
import { DocsNavigationService } from './docs-navigation.service';
import { TryItPanelComponent } from './try-it-panel.component';

@Component({
  selector: 'app-endpoint-card',
  standalone: true,
  imports: [TryItPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[id]': 'endpoint().id' },
  template: `
    <article class="card" [class.open]="expanded()">
      <button type="button" class="card-head" (click)="toggleExpanded()">
        <span [class]="badgeClass()">{{ endpoint().method }}</span>
        <code class="path-line">
          @for (part of pathParts(); track $index) {
            @if (part.startsWith(':')) {
              <span class="param">{{ part }}</span>
            } @else {
              <span>{{ part }}</span>
            }
          }
        </code>
        <span class="chev">{{ expanded() ? '▼' : '▶' }}</span>
      </button>
      @if (expanded()) {
        <div class="card-body">
          <p class="desc">{{ endpoint().description }}</p>
          <p class="auth">
            <strong>Auth:</strong>
            {{ endpoint().auth === 'jwt' ? 'Requer autenticação JWT (cabeçalho Authorization)' : 'Sem autenticação necessária' }}
          </p>

          @if (endpoint().pathParams?.length) {
            <h4 class="sub">Parâmetros de rota</h4>
            <table class="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                @for (p of endpoint().pathParams!; track p.name) {
                  <tr>
                    <td><code>{{ p.name }}</code></td>
                    <td>{{ p.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (endpoint().queryParams?.length) {
            <h4 class="sub">Parâmetros de query</h4>
            <table class="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Obrigatório</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                @for (p of endpoint().queryParams!; track p.name) {
                  <tr>
                    <td><code>{{ p.name }}</code></td>
                    <td>{{ p.type }}</td>
                    <td>{{ p.required ? 'Sim' : 'Não' }}</td>
                    <td>{{ p.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (endpoint().bodyParams?.length) {
            <h4 class="sub">Corpo da requisição</h4>
            <table class="tbl">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Tipo</th>
                  <th>Obrigatório</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                @for (p of endpoint().bodyParams!; track p.name) {
                  <tr>
                    <td><code>{{ p.name }}</code></td>
                    <td>{{ p.type }}</td>
                    <td>{{ p.required ? 'Sim' : 'Não' }}</td>
                    <td>{{ p.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <h4 class="sub">Exemplo de resposta</h4>
          <div class="code-wrap">
            <button type="button" class="copy" (click)="copy(endpoint().responseExample, 'res'); $event.stopPropagation()">
              {{ copied() === 'res' ? 'Copiado!' : 'Copiar' }}
            </button>
            <pre class="code-block"><code>{{ endpoint().responseExample }}</code></pre>
          </div>

          @if (endpoint().errorCodes.length > 0) {
            <h4 class="sub">Códigos de erro</h4>
            <table class="tbl">
              <thead>
                <tr>
                  <th>HTTP</th>
                  <th>Significado</th>
                </tr>
              </thead>
              <tbody>
                @for (e of endpoint().errorCodes; track e.status) {
                  <tr>
                    <td>{{ e.status }}</td>
                    <td>{{ e.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <h4 class="sub">Exemplo (curl)</h4>
          <div class="code-wrap">
            <button type="button" class="copy" (click)="copy(curlExpanded(), 'curl'); $event.stopPropagation()">
              {{ copied() === 'curl' ? 'Copiado!' : 'Copiar' }}
            </button>
            <pre class="code-block"><code>{{ curlExpanded() }}</code></pre>
          </div>

          <app-try-it-panel [endpoint]="endpoint()" />
        </div>
      }
    </article>
  `,
  styles: [
    `
      .card {
        border: 1px solid var(--tui-border-normal);
        border-radius: var(--tui-radius-m);
        background: var(--tui-background-elevation-1);
        overflow: hidden;
      }
      .card.open {
        box-shadow: 0 2px 8px color-mix(in srgb, var(--tui-text-primary) 8%, transparent);
      }
      .card-head {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.65rem;
        padding: 1rem 1.25rem;
        margin: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        font: inherit;
        color: inherit;
      }
      .card-head:hover {
        background: var(--tui-background-neutral-1);
      }
      .badge {
        flex-shrink: 0;
        min-width: 3.25rem;
        padding: 0.2rem 0.45rem;
        border-radius: var(--tui-radius-xs);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-align: center;
      }
      .method-get {
        background: #dbeafe;
        color: #1e40af;
      }
      .method-post {
        background: #dcfce7;
        color: #166534;
      }
      .method-patch {
        background: #fef3c7;
        color: #92400e;
      }
      .method-delete {
        background: #fee2e2;
        color: #991b1b;
      }
      .path-line {
        flex: 1;
        font-size: 0.85rem;
        word-break: break-all;
      }
      .path-line .param {
        color: var(--tui-text-action);
        font-weight: 600;
      }
      .chev {
        flex-shrink: 0;
        opacity: 0.5;
        font-size: 0.7rem;
      }
      .card-body {
        padding: 0 1.25rem 1.25rem;
        border-top: 1px solid var(--tui-border-normal);
      }
      .desc {
        margin: 0.75rem 0;
        color: var(--tui-text-secondary);
        line-height: 1.5;
      }
      .auth {
        margin: 0 0 0.75rem;
        font: var(--tui-font-text-s);
      }
      .sub {
        margin: 1rem 0 0.35rem;
        font: var(--tui-font-text-s);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--tui-text-secondary);
      }
      .tbl {
        width: 100%;
        border-collapse: collapse;
        font: var(--tui-font-text-s);
        margin-bottom: 0.5rem;
      }
      .tbl th,
      .tbl td {
        border: 1px solid var(--tui-border-normal);
        padding: 0.5rem 0.75rem;
        text-align: left;
        vertical-align: top;
        font-size: 0.8125rem;
      }
      .tbl thead th {
        background: rgba(168,85,247,0.06);
        font-weight: 300;
      }
      .tbl tbody tr:nth-child(even) {
        background: rgba(0,0,0,0.02);
      }
      .code-wrap {
        position: relative;
      }
      .copy {
        position: absolute;
        top: 0.35rem;
        right: 0.35rem;
        z-index: 1;
        padding: 0.2rem 0.5rem;
        font-size: 0.7rem;
        border-radius: var(--tui-radius-xs);
        border: 1px solid var(--tui-border-normal);
        background: var(--tui-background-elevation-1);
        cursor: pointer;
        color: var(--tui-text-primary);
      }
      .copy:hover {
        color: var(--papagai-purple);
        background: rgba(168,85,247,0.08);
      }
      .code-block {
        margin: 0;
        padding: 0.75rem;
        padding-top: 2rem;
        overflow: auto;
        max-height: 20rem;
        font-size: 0.8125rem;
        line-height: 1.45;
        background: #1e1b2e;
        color: #e2d9f3;
        border-radius: 0.5rem;
        border: 1px solid var(--tui-border-normal);
      }
    `,
  ],
})
export class EndpointCardComponent {
  readonly endpoint = input.required<EndpointDef>();

  private readonly docsNav = inject(DocsNavigationService);

  readonly expanded = signal(false);

  constructor() {
    effect(() => {
      const targetId = this.docsNav.targetEndpointId();
      if (targetId && targetId === this.endpoint().id) {
        this.expanded.set(true);
        this.docsNav.clear();
      }
    });
  }
  readonly copied = signal<string | null>(null);

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }

  readonly pathParts = computed(() => {
    const path = this.endpoint().path;
    return path.split(/(:[a-zA-Z_]+)/g).filter((s) => s.length > 0);
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
