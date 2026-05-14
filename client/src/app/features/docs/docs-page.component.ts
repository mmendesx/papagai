import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  API_ENDPOINT_GROUPS,
  type EndpointDef,
  WEBHOOK_EVENTS,
  WEBHOOK_PAYLOAD_EXAMPLES,
} from './api-endpoints';
import { EndpointCardComponent } from './endpoint-card.component';
import { DocsNavigationService } from './docs-navigation.service';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [EndpointCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-shell">
      <header class="docs-topbar">
        <div class="title-wrap">
          <h1>Documentação API</h1>
          <p>Base URL: <code>{{ baseUrl() }}</code></p>
        </div>
      </header>

      <section class="docs-grid">
        <aside class="groups-nav" aria-label="Grupos">
          @for (group of endpointGroups; track group.id) {
            <button
              type="button"
              class="group-btn"
              [class.active]="selectedGroupId() === group.id"
              (click)="selectGroup(group.id)"
            >
              <span>{{ group.title }}</span>
              <small>{{ group.endpoints.length }}</small>
            </button>
          }
        </aside>

        <section class="endpoint-index" aria-label="Índice de endpoints">
          <h2>{{ selectedGroup().title }}</h2>
          @if (selectedGroup().description) {
            <p class="group-description">{{ selectedGroup().description }}</p>
          }

          @if (selectedGroupId() === 'webhooks') {
            <div class="webhook-summary">
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
                (click)="selectEndpoint(endpoint.id)"
              >
                <span class="method" [class]="'method method-' + endpoint.method.toLowerCase()">{{ endpoint.method }}</span>
                <code class="path">{{ endpoint.path }}</code>
                <span class="name">{{ endpoint.title }}</span>
              </button>
            }
          </div>
        </section>

        <section class="endpoint-detail" aria-label="Detalhes">
          @if (selectedEndpoint(); as endpoint) {
            <app-endpoint-card [endpoint]="endpoint" [forceExpanded]="true" [detailMode]="true" />
          }

          @if (selectedGroupId() === 'webhooks') {
            <div class="webhook-payloads">
              <h3>Payload examples</h3>
              @for (example of webhookPayloadExamples; track example.event) {
                <section class="payload-item">
                  <header>{{ example.event }}</header>
                  <pre><code>{{ example.json }}</code></pre>
                </section>
              }
            </div>
          }
        </section>
      </section>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .docs-shell { padding: 1rem 1.25rem 2rem; }
      .docs-topbar {
        margin-bottom: 1rem;
        border: 1px solid var(--color-outline-variant);
        border-radius: 8px;
        padding: 0.875rem 1rem;
        background: var(--color-surface-container-lowest);
      }
      .title-wrap h1 {
        margin: 0;
        font-size: 1.125rem;
        color: var(--color-on-surface);
      }
      .title-wrap p {
        margin: 0.375rem 0 0;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
      .title-wrap code { font-family: 'JetBrains Mono', monospace; }
      .docs-grid {
        display: grid;
        grid-template-columns: 16rem minmax(18rem, 26rem) minmax(0, 1fr);
        gap: 0.875rem;
        min-height: calc(100vh - 14rem);
      }
      .groups-nav,
      .endpoint-index,
      .endpoint-detail {
        border: 1px solid var(--color-outline-variant);
        border-radius: 8px;
        background: var(--color-surface-container-lowest);
      }
      .groups-nav {
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        max-height: calc(100vh - 14rem);
        overflow: auto;
        position: sticky;
        top: 1rem;
      }
      .group-btn {
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--color-on-surface-variant);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.625rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }
      .group-btn.active {
        color: var(--color-on-surface);
        border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      }
      .endpoint-index {
        padding: 0.75rem;
        overflow: auto;
      }
      .endpoint-index h2 {
        margin: 0;
        font-size: 0.95rem;
      }
      .group-description {
        margin: 0.375rem 0 0.75rem;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
      .endpoint-list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .endpoint-row {
        border: 1px solid var(--color-outline-variant);
        border-radius: 6px;
        background: transparent;
        color: inherit;
        padding: 0.5rem;
        cursor: pointer;
        text-align: left;
        display: grid;
        gap: 0.25rem;
      }
      .endpoint-row.active {
        border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      }
      .method { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.04em; }
      .method-get { color: var(--color-method-get, #3d8b40); }
      .method-post { color: var(--color-method-post, #2a62d3); }
      .method-patch { color: var(--color-method-patch); }
      .method-delete { color: var(--color-method-delete, #ba1a1a); }
      .path {
        font-size: 0.75rem;
        font-family: 'JetBrains Mono', monospace;
        color: var(--color-on-surface);
        word-break: break-word;
      }
      .name {
        font-size: 0.75rem;
        color: var(--color-on-surface-variant);
      }
      .endpoint-detail {
        padding: 0.75rem;
        overflow: auto;
      }
      .webhook-summary {
        margin-bottom: 0.75rem;
        padding: 0.625rem;
        border: 1px solid var(--color-outline-variant);
        border-radius: 6px;
      }
      .webhook-summary h3,
      .webhook-payloads h3 {
        margin: 0 0 0.5rem;
        font-size: 0.8125rem;
      }
      .webhook-summary ul {
        margin: 0;
        padding-left: 1rem;
      }
      .webhook-summary li {
        font-size: 0.75rem;
        line-height: 1.5;
        color: var(--color-on-surface-variant);
      }
      .webhook-payloads {
        margin-top: 0.75rem;
      }
      .payload-item {
        border: 1px solid var(--color-outline-variant);
        border-radius: 6px;
        margin-bottom: 0.625rem;
        overflow: hidden;
      }
      .payload-item header {
        padding: 0.375rem 0.625rem;
        font-size: 0.6875rem;
        border-bottom: 1px solid var(--color-outline-variant);
      }
      .payload-item pre {
        margin: 0;
        padding: 0.75rem;
        overflow: auto;
        font-size: 0.75rem;
        background: var(--color-code-bg);
        color: var(--color-code-text);
      }
      @media (max-width: 1100px) {
        .docs-grid {
          grid-template-columns: 1fr;
          min-height: auto;
        }
        .groups-nav {
          position: static;
          max-height: none;
          flex-direction: row;
          flex-wrap: wrap;
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

  private findEndpoint(endpointId: string): { groupId: string } | null {
    for (const group of this.endpointGroups) {
      if (group.endpoints.some((entry) => entry.id === endpointId)) {
        return { groupId: group.id };
      }
    }
    return null;
  }
}
