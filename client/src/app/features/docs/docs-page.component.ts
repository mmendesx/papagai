import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import {
  API_ENDPOINT_GROUPS,
  WEBHOOK_EVENTS,
  WEBHOOK_PAYLOAD_EXAMPLES,
} from './api-endpoints';
import { EndpointCardComponent } from './endpoint-card.component';

const LOGIN_CURL = `curl -sS -X POST "$BASE/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"yourpassword"}'`;

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [FormsModule, ...TuiTextfield, EndpointCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs">
      <header class="hero">
        <h1 class="hero-title">Referência da API</h1>
        <p class="lead">
          Integre serviços externos com o Papagai via HTTPS usando JSON e JWT. Todas as rotas de instância ficam sob
          <code>/api/instances</code>.
        </p>
      </header>

      <section class="panel auth-panel">
        <h2 class="panel-title">Autenticação</h2>
        <p>
          Rotas protegidas exigem
          <code>Authorization: Bearer &lt;accessToken&gt;</code>
          . Obtenha um token via
          <strong>POST</strong>
          <code>/api/auth/login</code>
          ou
          <strong>POST</strong>
          <code>/api/auth/register</code>
          (quando o registro estiver habilitado).
        </p>
        <p class="expiry">
          <strong>Validade do token:</strong>
          JWTs emitidos por este servidor expiram após a duração configurada (padrão
          <strong>24 horas</strong>
          ).
        </p>
        <h3 class="h3">Exemplo — login com curl</h3>
        <p class="hint">Substitua <code>$BASE</code> pela origem do seu servidor (ex.: <code>https://api.example.com</code>).</p>
        <div class="code-wrap">
          <button type="button" class="copy" (click)="copyLoginCurl()">
            {{ copiedAuth() ? 'Copiado!' : 'Copiar' }}
          </button>
          <pre class="code-block"><code>{{ loginCurlDisplay() }}</code></pre>
        </div>
      </section>

      <div class="search-row">
        <tui-textfield class="search-field">
          <label tuiLabel>Buscar endpoints</label>
          <input
            tuiTextfield
            type="search"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            autocomplete="off"
            placeholder="Caminho, método ou descrição…"
          />
        </tui-textfield>
      </div>

      @for (group of filteredGroups(); track group.id) {
        <section class="group">
          <h2 class="group-title section-title">{{ group.title }}</h2>
          @if (group.description) {
            <p class="group-desc">{{ group.description }}</p>
          }

          @if (group.id === 'webhooks') {
            <div class="wh-ref panel">
              <h3 class="h3">Tipos de evento de webhook</h3>
              <p class="muted">
                Webhooks de saída enviam JSON com um campo
                <code>event</code>
                . Configure a URL, cabeçalhos, flag de ativação e eventos permitidos via
                <strong>PATCH</strong>
                <code>/api/instances/:name/webhook</code>
                ou pela aba Webhook do dashboard.
              </p>
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ev of webhookEvents; track ev.key) {
                    <tr>
                      <td><code>{{ ev.key }}</code></td>
                      <td>{{ ev.description }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <h3 class="h3">Exemplos de payload</h3>
              @for (ex of webhookPayloadExamples; track ex.event) {
                <p class="ex-label"><code>{{ ex.event }}</code></p>
                <pre class="code-block tight"><code>{{ ex.json }}</code></pre>
              }
            </div>
          }

          <div class="cards">
            @for (ep of group.endpoints; track ep.id) {
              <app-endpoint-card [endpoint]="ep" />
            }
          </div>
        </section>
      }

      @if (filteredGroups().length === 0) {
        <p class="empty">Nenhum endpoint corresponde à sua busca.</p>
      }
    </div>
  `,
  styles: [
    `
      .docs {
        max-width: 52rem;
        margin: 0 auto;
        padding-bottom: 3rem;
      }
      .hero {
        margin-bottom: 1.5rem;
        background: var(--color-surface-container-low);
        border-bottom: 1px solid var(--color-outline-variant);
        padding: 3rem 2rem 2rem;
        margin-left: -2rem;
        margin-right: -2rem;
      }
      .hero-title {
        font-size: 2rem;
        font-weight: 300;
        margin: 0 0 0.75rem;
        line-height: 1.2;
      }
      .lead {
        margin: 0;
        font-weight: 200;
        color: var(--tui-text-secondary);
        line-height: 1.55;
        max-width: 42rem;
      }
      .lead code {
        font-size: 0.9em;
      }
      .panel {
        padding: 1.25rem;
        border-radius: var(--radius-lg);
        border: 1px solid var(--tui-border-normal);
        background: var(--tui-background-elevation-1);
      }
      .auth-panel {
        margin-bottom: 1.5rem;
      }
      .auth-panel p {
        margin: 0 0 0.65rem;
        line-height: 1.5;
        color: var(--tui-text-secondary);
      }
      .auth-panel code {
        font-size: 0.88em;
      }
      .panel-title {
        margin: 0 0 0.75rem;
        font: var(--tui-font-text-l);
        font-weight: 600;
      }
      .expiry {
        color: var(--tui-text-primary) !important;
      }
      .h3 {
        margin: 1rem 0 0.35rem;
        font: var(--tui-font-text-m);
        font-weight: 600;
      }
      .hint {
        font: var(--tui-font-text-s);
        color: var(--tui-text-secondary);
        margin-bottom: 0.35rem !important;
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
        border-radius: var(--radius-sm);
        border: 1px solid var(--tui-border-normal);
        background: var(--tui-background-elevation-1);
        cursor: pointer;
        color: var(--tui-text-primary);
      }
      .copy:hover {
        color: var(--color-primary);
        background: var(--color-surface-container-low);
      }
      .code-block {
        margin: 0;
        padding: 0.75rem;
        padding-top: 2rem;
        overflow: auto;
        max-height: 14rem;
        font-size: 0.8125rem;
        line-height: 1.45;
        background: var(--color-code-bg);
        color: var(--color-code-text);
        border-radius: var(--radius-md);
        border: 1px solid var(--tui-border-normal);
      }
      .code-block.tight {
        padding-top: 0.75rem;
        margin-bottom: 1rem;
        max-height: 12rem;
      }
      .search-row {
        margin-bottom: 1.5rem;
      }
      .search-field {
        display: block;
        max-width: 24rem;
      }
      .group {
        margin-bottom: 2rem;
      }
      .group-title {
        margin: 0 0 0.35rem;
        font: var(--tui-font-text-l);
        font-weight: 300;
        font-size: 1.125rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid var(--color-primary);
      }
      .group-desc {
        margin: 0 0 1rem;
        color: var(--tui-text-secondary);
        line-height: 1.5;
      }
      .cards {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .wh-ref {
        margin-bottom: 1rem;
      }
      .wh-ref .muted {
        margin: 0 0 0.75rem;
        color: var(--tui-text-secondary);
        line-height: 1.5;
        font: var(--tui-font-text-s);
      }
      .tbl {
        width: 100%;
        border-collapse: collapse;
        font: var(--tui-font-text-s);
        margin-bottom: 1rem;
      }
      .tbl th,
      .tbl td {
        border: 1px solid var(--tui-border-normal);
        padding: 0.5rem 0.75rem;
        text-align: left;
        vertical-align: top;
        font-size: 0.8125rem;
      }
      .tbl th {
        background: var(--color-surface-container-low);
        font-weight: 300;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .tbl tbody tr:nth-child(even) {
        background: var(--color-table-stripe);
      }
      .tbl tbody tr:hover {
        background: var(--color-surface-container);
      }
      .ex-label {
        margin: 0.5rem 0 0.25rem;
        font-weight: 600;
        font: var(--tui-font-text-s);
      }
      .empty {
        color: var(--tui-text-secondary);
        padding: 2rem;
        text-align: center;
      }
    `,
  ],
})
export class DocsPageComponent {
  readonly searchQuery = signal('');
  readonly copiedAuth = signal(false);

  readonly webhookEvents = WEBHOOK_EVENTS;
  readonly webhookPayloadExamples = WEBHOOK_PAYLOAD_EXAMPLES;

  readonly filteredGroups = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return API_ENDPOINT_GROUPS;
    }
    return API_ENDPOINT_GROUPS.map((g) => ({
      ...g,
      endpoints: g.endpoints.filter(
        (ep) =>
          ep.path.toLowerCase().includes(q) ||
          ep.title.toLowerCase().includes(q) ||
          ep.method.toLowerCase().includes(q) ||
          ep.description.toLowerCase().includes(q) ||
          ep.id.toLowerCase().includes(q),
      ),
    })).filter((g) => g.endpoints.length > 0);
  });

  loginCurlDisplay(): string {
    return LOGIN_CURL.replaceAll('$BASE', typeof window !== 'undefined' ? window.location.origin : 'https://your-host');
  }

  async copyLoginCurl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.loginCurlDisplay());
      this.copiedAuth.set(true);
      setTimeout(() => this.copiedAuth.set(false), 2000);
    } catch {
      void 0;
    }
  }
}
