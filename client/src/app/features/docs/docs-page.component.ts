import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  API_ENDPOINT_GROUPS,
  type EndpointDef,
  WEBHOOK_EVENTS,
  WEBHOOK_PAYLOAD_EXAMPLES,
} from './api-endpoints';
import { EndpointCardComponent } from './endpoint-card.component';
import { FieldTableComponent } from './field-table.component';
import { DocsNavigationService } from './docs-navigation.service';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [EndpointCardComponent, FieldTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-shell">
      <!-- Top bar -->
      <header class="docs-topbar">
        <div class="title-wrap">
          <h1 class="docs-title">Documentação API</h1>
          <p class="docs-base-url">Base URL: <code>{{ baseUrl() }}</code></p>
        </div>
      </header>

      <!-- Mobile nav: horizontal-scroll chip bar (≤640px) -->
      <nav class="groups-nav-mobile" aria-label="Grupos de endpoints (mobile)">
        @for (group of endpointGroups; track group.id) {
          <button
            type="button"
            class="group-chip"
            [class.active]="selectedGroupId() === group.id"
            [attr.aria-current]="selectedGroupId() === group.id ? 'true' : null"
            (click)="selectGroup(group.id)"
          >
            {{ group.title }}
            <span class="chip-count" aria-hidden="true">{{ group.endpoints.length }}</span>
          </button>
        }
      </nav>

      <!-- Three-column grid (desktop) / stacked (tablet+mobile) -->
      <div class="docs-grid">

        <!-- Col 1: Group nav (desktop sidebar) -->
        <nav class="groups-nav" aria-label="Grupos de endpoints">
          @for (group of endpointGroups; track group.id) {
            <button
              type="button"
              class="group-btn"
              [class.active]="selectedGroupId() === group.id"
              [attr.aria-current]="selectedGroupId() === group.id ? 'true' : null"
              (click)="selectGroup(group.id)"
            >
              <span>{{ group.title }}</span>
              <span class="group-count" aria-label="{{ group.endpoints.length }} endpoints">{{ group.endpoints.length }}</span>
            </button>
          }
        </nav>

        <!-- Col 2: Endpoint index -->
        <section class="endpoint-index" aria-label="Índice de endpoints">
          <h2 class="index-title">{{ selectedGroup().title }}</h2>
          @if (selectedGroup().description) {
            <p class="group-description">{{ selectedGroup().description }}</p>
          }

          @if (selectedGroupId() === 'webhooks') {
            <div class="webhook-summary" role="complementary" aria-label="Eventos de webhook">
              <h3>Eventos</h3>
              <ul>
                @for (event of webhookEvents; track event.key) {
                  <li><code>{{ event.key }}</code> {{ event.description }}</li>
                }
              </ul>
            </div>
          }

          <div class="endpoint-list">
            @for (endpoint of selectedEndpoints(); track endpoint.id) {
              <button
                type="button"
                class="endpoint-row"
                [class.active]="selectedEndpointId() === endpoint.id"
                [attr.aria-current]="selectedEndpointId() === endpoint.id ? 'true' : null"
                [attr.aria-label]="endpoint.method + ' ' + endpoint.path + ' — ' + endpoint.title"
                (click)="selectEndpoint(endpoint.id)"
              >
                <span class="method" [class]="'method method-' + endpoint.method.toLowerCase()" aria-hidden="true">{{ endpoint.method }}</span>
                <code class="path" aria-hidden="true">{{ endpoint.path }}</code>
                <span class="name" aria-hidden="true">{{ endpoint.title }}</span>
              </button>
            }
          </div>
        </section>

        <!-- Col 3: Endpoint detail -->
        <section class="endpoint-detail" aria-label="Detalhes do endpoint">
          @if (selectedEndpoint(); as endpoint) {
            <app-endpoint-card [endpoint]="endpoint" [forceExpanded]="true" [detailMode]="true" />
          }

          @if (selectedGroupId() === 'webhooks') {
            <div class="webhook-payloads">
              <h3 class="payloads-title">Payload examples</h3>
              @for (example of webhookPayloadExamples; track example.event) {
                <section class="payload-item" aria-label="Payload do evento {{ example.event }}">
                  <header class="payload-header">
                    <code class="payload-event">{{ example.event }}</code>
                  </header>
                  <!-- Code block: copy only captures the JSON string -->
                  <div class="payload-code-wrap">
                    <div class="payload-code-meta">
                      <span class="lang-tag" aria-hidden="true">json</span>
                      <button
                        type="button"
                        class="copy-btn"
                        [attr.aria-label]="'Copiar payload de ' + example.event"
                        (click)="copyPayload(example.json, example.event)"
                      >
                        {{ copiedPayload() === example.event ? '✓ Copiado' : 'Copiar' }}
                      </button>
                    </div>
                    <pre class="payload-pre"><code>{{ example.json }}</code></pre>
                  </div>
                  <!-- Field table: sibling of the code block, not inside it -->
                  @if (example.fields?.length) {
                    <div class="payload-fields">
                      <p class="fields-label">Campos</p>
                      <app-field-table [fields]="example.fields!" />
                    </div>
                  }
                </section>
              }
            </div>
          }
        </section>

      </div><!-- end .docs-grid -->
    </div>
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }

      /* ------------------------------------------------------------------ */
      /* Shell                                                                */
      /* ------------------------------------------------------------------ */
      .docs-shell {
        padding: 1rem 1.25rem 2rem;
        min-width: 0;
      }

      /* ------------------------------------------------------------------ */
      /* Top bar                                                             */
      /* ------------------------------------------------------------------ */
      .docs-topbar {
        margin-bottom: 1rem;
        border: 1px solid var(--color-outline-variant);
        border-radius: 10px;
        padding: 1rem 1.25rem;
        background: var(--color-surface-container-lowest);
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .title-wrap { min-width: 0; }
      .docs-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-on-surface);
        line-height: 1.3;
        font-family: var(--font-display);
      }
      .docs-base-url {
        margin: 0.375rem 0 0;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
      .docs-base-url code {
        font-family: 'JetBrains Mono', monospace;
        word-break: break-all;
      }

      /* ------------------------------------------------------------------ */
      /* Mobile nav chip bar (hidden on ≥641px)                             */
      /* ------------------------------------------------------------------ */
      .groups-nav-mobile {
        display: none; /* shown via media query below */
        margin-bottom: 0.75rem;
        padding-bottom: 0.25rem;
        /* Horizontal scroll without page overflow */
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        /* Hide scrollbar visually but keep it functional */
        scrollbar-width: none;
        flex-direction: row;
        gap: 0.5rem;
        align-items: center;
        /* Prevent wrapping so chips scroll instead of wrap */
        flex-wrap: nowrap;
        white-space: nowrap;
      }
      .groups-nav-mobile::-webkit-scrollbar { display: none; }
      .group-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.375rem 0.75rem;
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-full);
        background: var(--color-surface-container-low);
        color: var(--color-on-surface-variant);
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        cursor: pointer;
        white-space: nowrap;
        transition: background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
        flex-shrink: 0;
      }
      .group-chip.active {
        background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container-low));
        border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-outline-variant));
        color: var(--color-on-surface);
        font-weight: 600;
      }
      .group-chip:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .chip-count {
        font-size: 0.6875rem;
        background: var(--color-surface-container);
        border-radius: var(--radius-full);
        padding: 0.1rem 0.375rem;
        color: var(--color-on-surface-variant);
      }
      .group-chip.active .chip-count {
        background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-container));
        color: var(--color-primary);
      }

      /* ------------------------------------------------------------------ */
      /* Three-column grid                                                   */
      /* ------------------------------------------------------------------ */
      .docs-grid {
        display: grid;
        grid-template-columns: 16rem minmax(18rem, 26rem) minmax(0, 1fr);
        gap: 0.875rem;
        min-height: calc(100vh - 14rem);
        min-width: 0;
        align-items: start;
      }

      /* ------------------------------------------------------------------ */
      /* Groups nav sidebar (Col 1)                                          */
      /* ------------------------------------------------------------------ */
      .groups-nav {
        border: 1px solid var(--color-outline-variant);
        border-radius: 10px;
        background: var(--color-surface-container-lowest);
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        /* Sticky sidebar, scrollable when content exceeds viewport */
        position: sticky;
        top: 1rem;
        max-height: calc(100vh - 8rem);
        overflow-y: auto;
      }
      .group-btn {
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--color-on-surface-variant);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5625rem 0.75rem;
        font-size: 0.875rem;
        font-family: var(--font-sans);
        cursor: pointer;
        text-align: left;
        transition: background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
        gap: 0.5rem;
      }
      .group-btn:hover {
        background: var(--color-surface-container-low);
        color: var(--color-on-surface);
      }
      .group-btn.active {
        color: var(--color-on-surface);
        border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        font-weight: 600;
      }
      .group-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -1px;
      }
      .group-count {
        font-size: 0.6875rem;
        font-weight: 500;
        background: var(--color-surface-container);
        color: var(--color-on-surface-variant);
        border-radius: var(--radius-full);
        padding: 0.1rem 0.4rem;
        flex-shrink: 0;
      }
      .group-btn.active .group-count {
        background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-container));
        color: var(--color-primary);
      }

      /* ------------------------------------------------------------------ */
      /* Endpoint index (Col 2)                                              */
      /* ------------------------------------------------------------------ */
      .endpoint-index {
        border: 1px solid var(--color-outline-variant);
        border-radius: 10px;
        background: var(--color-surface-container-lowest);
        padding: 0.875rem;
        overflow: auto;
        min-width: 0;
      }
      .index-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--color-on-surface);
        font-family: var(--font-display);
      }
      .group-description {
        margin: 0.375rem 0 0.875rem;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
        line-height: 1.55;
      }
      .endpoint-list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        margin-top: 0.75rem;
      }
      .endpoint-row {
        border: 1px solid var(--color-outline-variant);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        padding: 0.625rem 0.75rem;
        cursor: pointer;
        text-align: left;
        display: grid;
        gap: 0.2rem;
        transition: background var(--duration-fast), border-color var(--duration-fast);
        min-width: 0;
      }
      .endpoint-row:hover {
        background: var(--color-surface-container-low);
        border-color: var(--color-outline);
      }
      .endpoint-row.active {
        border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      }
      .endpoint-row:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -1px;
      }
      .method {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .method-get { color: var(--color-method-get, #3d8b40); }
      .method-post { color: var(--color-method-post, #2a62d3); }
      .method-patch { color: var(--color-method-patch); }
      .method-delete { color: var(--color-method-delete, #ba1a1a); }
      .path {
        font-size: 0.75rem;
        font-family: 'JetBrains Mono', monospace;
        color: var(--color-on-surface);
        word-break: break-all;
        min-width: 0;
      }
      .name {
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }

      /* ------------------------------------------------------------------ */
      /* Endpoint detail (Col 3)                                             */
      /* ------------------------------------------------------------------ */
      .endpoint-detail {
        border: 1px solid var(--color-outline-variant);
        border-radius: 10px;
        background: var(--color-surface-container-lowest);
        padding: 0.875rem;
        /* Critical: min-width:0 lets code blocks scroll instead of stretching this column */
        min-width: 0;
        overflow: hidden;
      }

      /* ------------------------------------------------------------------ */
      /* Webhook events summary                                              */
      /* ------------------------------------------------------------------ */
      .webhook-summary {
        margin-bottom: 0.875rem;
        padding: 0.75rem;
        border: 1px solid var(--color-outline-variant);
        border-radius: 8px;
        background: var(--color-surface-container-low);
      }
      .webhook-summary h3 {
        margin: 0 0 0.5rem;
        font-size: 0.8125rem;
        font-weight: 700;
        font-family: var(--font-display);
        color: var(--color-on-surface);
      }
      .webhook-summary ul {
        margin: 0;
        padding-left: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .webhook-summary li {
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--color-on-surface-variant);
      }
      .webhook-summary code {
        font-family: 'JetBrains Mono', monospace;
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        padding: 0.05rem 0.3rem;
        border-radius: var(--radius-sm);
        margin-right: 0.25rem;
      }

      /* ------------------------------------------------------------------ */
      /* Webhook payload examples                                            */
      /* ------------------------------------------------------------------ */
      .webhook-payloads {
        margin-top: 0.875rem;
        min-width: 0;
      }
      .payloads-title {
        margin: 0 0 0.75rem;
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--color-on-surface);
        font-family: var(--font-display);
      }
      .payload-item {
        border: 1px solid var(--color-outline-variant);
        border-radius: 8px;
        margin-bottom: 0.75rem;
        overflow: hidden;
        min-width: 0;
      }
      .payload-header {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container-low);
      }
      .payload-event {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8125rem;
        color: var(--color-primary);
        font-weight: 600;
      }
      .payload-code-wrap {
        min-width: 0;
        overflow: hidden;
      }
      .payload-code-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.375rem 0.75rem;
        background: color-mix(in srgb, var(--color-code-bg) 95%, transparent);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        gap: 0.5rem;
      }
      .lang-tag {
        font-family: var(--font-brand);
        font-size: 0.5625rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        /* Sufficiently opaque for AA contrast on dark code-bg */
        color: rgba(226,217,243,0.65);
      }
      .copy-btn {
        font-family: var(--font-sans);
        font-size: 0.6875rem;
        font-weight: 500;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        color: rgba(226,217,243,0.82);
        padding: 0.175rem 0.55rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--duration-fast);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .copy-btn:hover { background: rgba(255,255,255,0.13); color: #e2d9f3; }
      .copy-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
      }
      .payload-pre {
        margin: 0;
        padding: 0.75rem;
        /* Horizontal scroll within block; page does not scroll */
        overflow-x: auto;
        font-size: 0.75rem;
        line-height: 1.55;
        background: var(--color-code-bg);
        color: var(--color-code-text);
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        min-width: 0;
      }
      .payload-fields {
        padding: 0.625rem 0.75rem;
        background: var(--color-surface-container-lowest);
        border-top: 1px solid var(--color-outline-variant);
        min-width: 0;
      }
      .fields-label {
        font-family: var(--font-display);
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-on-surface-variant);
        margin: 0 0 0.4rem;
        opacity: 0.75;
      }

      /* ------------------------------------------------------------------ */
      /* Breakpoint: tablet ≤1100px — stack groups-nav above rest           */
      /* ------------------------------------------------------------------ */
      @media (max-width: 1100px) {
        .docs-grid {
          grid-template-columns: 1fr;
          min-height: auto;
        }
        .groups-nav {
          position: static;
          max-height: none;
          overflow-y: visible;
          /* Horizontal pill row on tablet */
          flex-direction: row;
          flex-wrap: wrap;
          gap: 0.375rem;
          padding: 0.5rem;
        }
        .group-btn {
          font-size: 0.8125rem;
          padding: 0.4375rem 0.625rem;
          border-radius: var(--radius-full);
          /* Chip-like appearance on tablet */
          background: var(--color-surface-container-low);
          border-color: var(--color-outline-variant);
        }
        .group-btn.active {
          border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
          background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        }
      }

      /* ------------------------------------------------------------------ */
      /* Breakpoint: phone ≤640px — mobile chip bar shows, sidebar hides   */
      /* ------------------------------------------------------------------ */
      @media (max-width: 640px) {
        .docs-shell {
          padding: 0.75rem 0.75rem 2rem;
        }
        .docs-topbar {
          padding: 0.75rem 1rem;
        }
        .docs-title {
          font-size: 1.0625rem;
        }
        /* Show mobile chip nav, hide desktop sidebar nav */
        .groups-nav-mobile {
          display: flex;
        }
        .groups-nav {
          display: none;
        }
        .docs-grid {
          gap: 0.625rem;
        }
        .endpoint-index,
        .endpoint-detail {
          padding: 0.75rem;
        }
        .endpoint-row {
          padding: 0.5rem 0.625rem;
        }
      }
    `,
  ],
})
export class DocsPageComponent {
  private readonly docsNav = inject(DocsNavigationService);
  private readonly doc = inject(DOCUMENT);

  readonly endpointGroups = API_ENDPOINT_GROUPS;
  readonly webhookEvents = WEBHOOK_EVENTS;
  readonly webhookPayloadExamples = WEBHOOK_PAYLOAD_EXAMPLES;

  readonly selectedGroupId = signal(API_ENDPOINT_GROUPS[0]?.id ?? '');
  readonly selectedEndpointId = signal(API_ENDPOINT_GROUPS[0]?.endpoints[0]?.id ?? '');

  readonly selectedGroup = computed(() =>
    this.endpointGroups.find((group) => group.id === this.selectedGroupId()) ?? this.endpointGroups[0],
  );
  readonly selectedEndpoints = computed(() => this.selectedGroup()?.endpoints ?? []);
  readonly selectedEndpoint = computed<EndpointDef | null>(() => {
    const id = this.selectedEndpointId();
    const endpoint = this.selectedEndpoints().find((entry) => entry.id === id);
    return endpoint ?? this.selectedEndpoints()[0] ?? null;
  });

  /** Keyed copy state for webhook payload JSON copy buttons. */
  readonly copiedPayload = signal<string | null>(null);

  constructor() {
    effect(() => {
      const targetId = this.docsNav.targetEndpointId();
      if (!targetId) {
        return;
      }

      const located = this.findEndpoint(targetId);
      if (located) {
        this.selectedGroupId.set(located.groupId);
        this.selectedEndpointId.set(targetId);
      }
      this.docsNav.clear();
      this.doc.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  selectGroup(groupId: string): void {
    this.selectedGroupId.set(groupId);
    const next = this.endpointGroups.find((entry) => entry.id === groupId)?.endpoints[0];
    if (next) {
      this.selectedEndpointId.set(next.id);
    }
  }

  selectEndpoint(endpointId: string): void {
    this.selectedEndpointId.set(endpointId);
  }

  baseUrl(): string {
    return typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com';
  }

  async copyPayload(json: string, eventKey: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(json);
      this.copiedPayload.set(eventKey);
      setTimeout(() => {
        this.copiedPayload.update((c: string | null) => (c === eventKey ? null : c));
      }, 2000);
    } catch {
      void 0;
    }
  }

  private findEndpoint(endpointId: string): { groupId: string } | null {
    for (const group of this.endpointGroups) {
      if (group.endpoints.some((entry) => entry.id === endpointId)) {
        return { groupId: group.id };
      }
    }
    return null;
  }
}
