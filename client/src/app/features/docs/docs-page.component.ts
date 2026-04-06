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
        <h1 class="tui-text_h4">API reference</h1>
        <p class="lead">
          Integrate external services with Papagai over HTTPS using JSON and JWT. All instance routes live under
          <code>/api/instances</code>.
        </p>
      </header>

      <section class="panel auth-panel">
        <h2 class="panel-title">Authentication</h2>
        <p>
          Protected routes expect
          <code>Authorization: Bearer &lt;accessToken&gt;</code>
          . Obtain a token via
          <strong>POST</strong>
          <code>/api/auth/login</code>
          or
          <strong>POST</strong>
          <code>/api/auth/register</code>
          (when registration is enabled).
        </p>
        <p class="expiry">
          <strong>Token lifetime:</strong>
          JWTs issued by this server expire after the configured duration (default
          <strong>24 hours</strong>
          ).
        </p>
        <h3 class="h3">Example — login with curl</h3>
        <p class="hint">Replace <code>$BASE</code> with your server origin (e.g. <code>https://api.example.com</code>).</p>
        <div class="code-wrap">
          <button type="button" class="copy" (click)="copyLoginCurl()">
            {{ copiedAuth() ? 'Copied!' : 'Copy' }}
          </button>
          <pre class="code-block"><code>{{ loginCurlDisplay() }}</code></pre>
        </div>
      </section>

      <div class="search-row">
        <tui-textfield class="search-field">
          <label tuiLabel>Search endpoints</label>
          <input
            tuiTextfield
            type="search"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            autocomplete="off"
            placeholder="Path, method, or description…"
          />
        </tui-textfield>
      </div>

      @for (group of filteredGroups(); track group.id) {
        <section class="group">
          <h2 class="group-title">{{ group.title }}</h2>
          @if (group.description) {
            <p class="group-desc">{{ group.description }}</p>
          }

          @if (group.id === 'webhooks') {
            <div class="wh-ref panel">
              <h3 class="h3">Webhook event types</h3>
              <p class="muted">
                Outbound webhooks send JSON with an
                <code>event</code>
                field. Configure URL, headers, enabled flag, and allowed events via
                <strong>PATCH</strong>
                <code>/api/instances/:name/webhook</code>
                or the dashboard Webhook tab.
              </p>
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Description</th>
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
              <h3 class="h3">Payload examples</h3>
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
        <p class="empty">No endpoints match your search.</p>
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
      }
      .lead {
        margin: 0.5rem 0 0;
        color: var(--tui-text-secondary);
        line-height: 1.55;
        max-width: 42rem;
      }
      .lead code {
        font-size: 0.9em;
      }
      .panel {
        padding: 1.25rem;
        border-radius: var(--tui-radius-l);
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
        border-radius: var(--tui-radius-xs);
        border: 1px solid var(--tui-border-normal);
        background: var(--tui-background-elevation-1);
        cursor: pointer;
        color: var(--tui-text-primary);
      }
      .copy:hover {
        background: var(--tui-background-accent-1);
      }
      .code-block {
        margin: 0;
        padding: 0.75rem;
        padding-top: 2rem;
        overflow: auto;
        max-height: 14rem;
        font-size: 0.75rem;
        line-height: 1.45;
        background: var(--tui-background-neutral-1);
        border-radius: var(--tui-radius-s);
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
        font-weight: 600;
        padding-bottom: 0.35rem;
        border-bottom: 2px solid var(--tui-border-normal);
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
        padding: 0.45rem 0.55rem;
        text-align: left;
        vertical-align: top;
      }
      .tbl th {
        background: var(--tui-background-neutral-1);
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
