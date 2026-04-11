import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import {
  API_ENDPOINT_GROUPS,
  WEBHOOK_EVENTS,
  WEBHOOK_PAYLOAD_EXAMPLES,
} from './api-endpoints';
import { EndpointCardComponent } from './endpoint-card.component';
import { DocsNavigationService } from './docs-navigation.service';

const LOGIN_CURL = `curl -sS -X POST "$BASE/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"yourpassword"}'`;

const ACCOUNT_API_KEY_TEMPLATE_CURL = `# Authorization: Bearer
curl -sS -X POST "$BASE/api/auth/apikeys" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Ops bot","permissionsTemplate":"instance_manager"}'

# X-Api-Key (use uma chave com auth:apikeys:manage, como account_admin)
curl -sS -X POST "$BASE/api/auth/apikeys" \\
  -H "X-Api-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Ops bot","permissionsTemplate":"instance_manager"}'`;

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [EndpointCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('pageEntry', [
      transition(':enter', [
        query('.docs-section', [
          style({ opacity: 0, transform: 'translateY(14px)' }),
          stagger('55ms', [animate('350ms cubic-bezier(0,0,0.2,1)', style({ opacity: 1, transform: 'translateY(0)' }))]),
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    <div class="docs-page" [@pageEntry]>
      <!-- Hero -->
      <header class="docs-hero docs-section">
        <div class="hero-eyebrow">
          <span class="version-badge">v1.0</span>
          <span class="base-url-badge">{{ baseUrl() }}</span>
        </div>
        <h1 class="hero-title">Documentação API</h1>
        <p class="hero-lead">Integre serviços externos com o Papagai via HTTPS usando JSON. Em rotas protegidas, use Authorization: Bearer ou X-Api-Key.</p>
      </header>

      <!-- TOC pill strip -->
      <nav class="docs-toc" aria-label="Ir para seção">
        @for (group of endpointGroups; track group.id) {
          <a [href]="'#' + group.id" class="toc-pill" [class.active]="activeSectionId() === group.id" (click)="scrollTo($event, group.id)">{{ group.title }}</a>
        }
      </nav>

      <!-- Auth section -->
      <section id="authentication" class="docs-section">
        <h2 class="section-title">
          <span class="section-num">01</span>
          Exemplo de requisição de autenticação
        </h2>
        <div class="prose-card">
          <p>Rotas protegidas aceitam <code>Authorization: Bearer &lt;accessToken&gt;</code> ou <code>X-Api-Key: &lt;apiKey&gt;</code>.</p>
          <p>Obtenha um token via POST /api/auth/login ou gere uma chave via endpoints de API keys para integrações servidor a servidor.</p>
          <p>Para criar API key de conta com permissões padrão, envie <code>permissionsTemplate</code> com um destes IDs: <code>read_only</code>, <code>operator</code>, <code>instance_manager</code>, <code>account_admin</code>.</p>
          <p><code>permissionsTemplate</code> e <code>permissions</code> são mutuamente exclusivos: envie somente um deles por requisição.</p>
          <h3>Exemplo com curl</h3>
          <div class="code-block-wrap">
            <div class="code-meta">
              <span class="lang-tag">bash</span>
              <button class="copy-btn" (click)="copyLoginCurl()">{{ copiedAuth() ? '✓ Copiado' : 'Copiar' }}</button>
            </div>
            <pre class="code-block"><code>{{ loginCurlDisplay() }}</code></pre>
          </div>
          <h3>Criar API key com permissionsTemplate</h3>
          <div class="code-block-wrap">
            <div class="code-meta">
              <span class="lang-tag">bash</span>
            </div>
            <pre class="code-block"><code>{{ accountApiKeyTemplateCurlDisplay() }}</code></pre>
          </div>
        </div>
      </section>

      <!-- Each endpoint group -->
      @for (group of endpointGroups; track group.id; let gi = $index) {
        <section [id]="group.id" class="docs-section">
          <h2 class="section-title">
            <span class="section-num">{{ (gi + 2).toString().padStart(2, '0') }}</span>
            {{ group.title }}
            <span class="endpoint-count">{{ group.endpoints.length }}</span>
          </h2>
          @if (group.description) {
            <p class="section-desc">{{ sectionDescription(group.id, group.description) }}</p>
          }

          @if (group.id === 'webhooks') {
            <div class="prose-card wh-events">
              <h3 class="card-subheading">Tipos de evento</h3>
              <div class="event-table">
                @for (ev of webhookEvents; track ev.key) {
                  <div class="event-row">
                    <code class="event-key">{{ ev.key }}</code>
                    <span class="event-desc">{{ ev.description }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <div class="endpoints-list">
            @for (ep of group.endpoints; track ep.id) {
              <app-endpoint-card [endpoint]="ep" />
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }

      .docs-page {
        max-width: 860px;
        margin: 0 auto;
        padding: 2.5rem 2.5rem 5rem;
      }

      /* Hero */
      .docs-hero { margin-bottom: 3rem; }
      .hero-eyebrow {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .version-badge {
        font-family: var(--font-brand);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-full);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: var(--color-primary);
        border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-outline-variant));
      }
      .base-url-badge {
        font-family: monospace;
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
        background: var(--color-surface-container);
        padding: 0.2rem 0.625rem;
        border-radius: var(--radius-full);
        border: 1px solid var(--color-outline-variant);
      }
      .hero-title {
        font-family: var(--font-display);
        font-size: 2.25rem;
        font-weight: 900;
        color: var(--color-on-surface);
        margin: 0 0 0.75rem;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .hero-lead {
        font-family: var(--font-sans);
        font-size: 1rem;
        color: var(--color-on-surface-variant);
        margin: 0;
        line-height: 1.6;
        max-width: 48rem;
      }

      /* Sections */
      .docs-section { margin-bottom: 3.5rem; }
      .section-title {
        font-family: var(--font-display);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-on-surface);
        margin: 0 0 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding-bottom: 0.875rem;
        border-bottom: 1px solid var(--color-outline-variant);
      }
      .section-num {
        font-family: var(--font-brand);
        font-size: 0.6875rem;
        font-weight: 700;
        color: var(--color-primary);
        letter-spacing: 0.06em;
        opacity: 0.7;
      }
      .endpoint-count {
        margin-left: auto;
        font-family: var(--font-sans);
        font-size: 0.6875rem;
        font-weight: 600;
        background: var(--color-surface-container);
        color: var(--color-on-surface-variant);
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
      }
      .section-desc {
        font-family: var(--font-sans);
        font-size: 0.875rem;
        color: var(--color-on-surface-variant);
        margin: -0.5rem 0 1.25rem;
        line-height: 1.6;
      }

      /* Prose card */
      .prose-card {
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
      }
      .prose-card p {
        font-family: var(--font-sans);
        font-size: 0.875rem;
        color: var(--color-on-surface-variant);
        margin: 0 0 0.75rem;
        line-height: 1.6;
      }
      .prose-card p:last-of-type { margin-bottom: 1.25rem; }
      .prose-card h3 {
        font-family: var(--font-display);
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-on-surface);
        margin: 0 0 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .prose-card code {
        font-size: 0.8125rem;
        background: var(--color-surface-container);
        padding: 0.1rem 0.35rem;
        border-radius: var(--radius-sm);
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        color: var(--color-primary);
      }

      /* Code block */
      .code-block-wrap {
        border-radius: var(--radius-lg);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .code-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.875rem;
        background: rgba(255,255,255,0.04);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .lang-tag {
        font-family: var(--font-brand);
        font-size: 0.625rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(226,217,243,0.5);
      }
      .copy-btn {
        font-family: var(--font-sans);
        font-size: 0.6875rem;
        font-weight: 500;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(226,217,243,0.7);
        padding: 0.2rem 0.6rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--duration-fast);
      }
      .copy-btn:hover { background: rgba(255,255,255,0.14); color: #e2d9f3; }
      .code-block {
        margin: 0;
        padding: 1rem;
        background: var(--color-code-bg);
        color: var(--color-code-text);
        font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
        font-size: 0.8125rem;
        line-height: 1.6;
        overflow-x: auto;
        tab-size: 2;
      }

      /* Webhook events */
      .card-subheading {
        font-family: var(--font-display);
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-on-surface);
        margin: 0 0 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .event-table { display: flex; flex-direction: column; }
      .event-row {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 0.625rem 0;
        border-bottom: 1px solid var(--color-outline-variant);
      }
      .event-row:last-child { border-bottom: none; }
      .event-key {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
        min-width: 9rem;
      }
      .event-desc {
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
        line-height: 1.5;
      }

      /* Endpoints list */
      .endpoints-list { display: flex; flex-direction: column; gap: 0.625rem; }

      /* TOC pill strip */
      .docs-toc {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        padding: 0.625rem 0 0.75rem;
        margin-bottom: 2rem;
        background: var(--tui-background-base);
        border-bottom: 1px solid var(--color-outline-variant);
        overflow-x: auto;
      }

      .toc-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: var(--radius-full);
        font-family: var(--font-sans);
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-on-surface-variant);
        background: var(--color-surface-container);
        border: 1px solid transparent;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
        transition: color var(--duration-fast) var(--ease-default),
                    background var(--duration-fast) var(--ease-default),
                    border-color var(--duration-fast) var(--ease-default);
      }
      .toc-pill:hover {
        color: var(--color-on-surface);
        background: var(--color-surface-container-high, var(--color-surface-container));
      }
      .toc-pill.active {
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
      }

      /* Responsive */
      @media (max-width: 768px) {
        .docs-page { padding: 1.5rem 1.25rem 3rem; }
      }
      @media (max-width: 480px) {
        .docs-page { padding: 1rem 1rem 3rem; }
        .hero-title { font-size: 1.75rem; }
      }
    `,
  ],
})
export class DocsPageComponent {
  private readonly docsNav = inject(DocsNavigationService);
  private readonly doc = inject(DOCUMENT);

  private observer: IntersectionObserver | null = null;

  readonly copiedAuth = signal(false);
  readonly activeSectionId = signal<string>('auth');

  readonly webhookEvents = WEBHOOK_EVENTS;
  readonly webhookPayloadExamples = WEBHOOK_PAYLOAD_EXAMPLES;
  readonly endpointGroups = API_ENDPOINT_GROUPS;

  constructor() {
    effect(() => {
      const id = this.docsNav.targetEndpointId();
      if (!id) return;
      setTimeout(() => {
        this.doc.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.docsNav.clear();
      }, 50);
    });

    afterNextRender(() => {
      const sections = Array.from(
        this.doc.querySelectorAll<HTMLElement>('.docs-section[id]')
      );
      if (!sections.length) return;

      this.observer = new IntersectionObserver(
        (entries) => {
          const intersecting = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (intersecting.length > 0) {
            this.activeSectionId.set(intersecting[0].target.id);
          }
        },
        { threshold: 0.2 }
      );

      sections.forEach(s => this.observer!.observe(s));
    });

    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  baseUrl(): string {
    return typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com';
  }

  sectionDescription(groupId: string, description?: string): string {
    if (!description) {
      return '';
    }

    if (groupId === 'instances') {
      return 'Crie e gerencie instâncias do WhatsApp. Rotas AnyAuth aceitam Authorization: Bearer <accessToken> ou X-Api-Key.';
    }

    return description;
  }

  loginCurlDisplay(): string {
    return LOGIN_CURL.replaceAll('$BASE', typeof window !== 'undefined' ? window.location.origin : 'https://your-host');
  }

  accountApiKeyTemplateCurlDisplay(): string {
    return ACCOUNT_API_KEY_TEMPLATE_CURL.replaceAll('$BASE', typeof window !== 'undefined' ? window.location.origin : 'https://your-host');
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
