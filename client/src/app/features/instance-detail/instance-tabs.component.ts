import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-instance-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      font-family: var(--font-sans);
    }

    /* ── Tab bar container ──────────────────────────────────── */
    .tabs-bar {
      display: flex;
      align-items: center;
      background: var(--color-surface-container-lowest);
      border-bottom: 1px solid var(--color-outline-variant);
      padding: 0 1.5rem;
      gap: 0;
      flex-shrink: 0;
      min-height: 2.75rem;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    /* ── Back link ──────────────────────────────────────────── */
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8125rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      padding: 0.375rem 0.5rem 0.375rem 0;
      margin-right: 0.75rem;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      flex-shrink: 0;
      transition: color var(--duration-fast) var(--ease-default);
    }
    .back-link:hover { color: var(--color-on-surface); }
    .back-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

    .back-chevron {
      display: inline-block;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    /* Divider between back link and tabs */
    .back-sep {
      width: 1px;
      height: 1.25rem;
      background: var(--color-outline-variant);
      margin-right: 0.75rem;
      flex-shrink: 0;
    }

    /* ── Tab list ───────────────────────────────────────────── */
    .tab-list {
      display: flex;
      align-items: stretch;
      gap: 0;
      flex: 1;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .tab-list::-webkit-scrollbar { display: none; }

    /* ── Tab buttons ────────────────────────────────────────── */
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0 0.875rem;
      height: 2.75rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      border: none;
      background: transparent;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition:
        color var(--duration-fast) var(--ease-default),
        border-color var(--duration-fast) var(--ease-default);
      margin-bottom: -1px; /* sit flush on container border */
    }
    .tab-btn:hover { color: var(--color-on-surface); }
    .tab-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
    .tab-btn.active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
      font-weight: 600;
    }

    /* ── Connection chip (right side) ──────────────────────── */
    .conn-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3125rem;
      margin-left: auto;
      padding: 0.1875rem 0.625rem;
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-outline-variant));
      border-radius: var(--radius-full);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .conn-chip--off {
      background: color-mix(in srgb, var(--color-on-surface-variant) 6%, transparent);
      border-color: color-mix(in srgb, var(--color-on-surface-variant) 18%, var(--color-outline-variant));
    }
    .conn-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-success);
      flex-shrink: 0;
    }
    .conn-chip--off .conn-dot { background: var(--color-outline); }
    .conn-label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: color-mix(in srgb, var(--color-primary) 85%, var(--color-on-surface));
    }
    .conn-chip--off .conn-label { color: var(--color-on-surface-variant); }

    /* ── Mobile: back link gets its own row ─────────────────── */
    @media (max-width: 640px) {
      .tabs-bar {
        flex-wrap: wrap;
        padding: 0 1rem;
        min-height: unset;
      }
      .back-link {
        width: 100%;
        padding: 0.5rem 0 0.375rem;
        margin-right: 0;
        font-size: 0.75rem;
      }
      .back-sep { display: none; }
      .tab-list {
        width: 100%;
        padding-bottom: 0;
      }
      .conn-chip {
        display: none; /* hidden on mobile to save space; status visible on page */
      }
    }
  `],
  template: `
    <nav class="tabs-bar" aria-label="Navegação da instância">
      <!-- Back to instances list -->
      <a
        routerLink="/dashboard"
        class="back-link"
        aria-label="Voltar para lista de instâncias"
      >
        <svg class="back-chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Instâncias
      </a>

      <span class="back-sep" aria-hidden="true"></span>

      <!-- Tab buttons -->
      <div class="tab-list" role="tablist" aria-label="Seções da instância">
        <a
          [routerLink]="['/instances', instanceName()]"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="tab-btn"
          role="tab"
          aria-label="Visão geral da instância"
        >
          Visão geral
        </a>
        <a
          [routerLink]="['/instances', instanceName(), 'chats']"
          routerLinkActive="active"
          class="tab-btn"
          role="tab"
          aria-label="Conversas da instância"
        >
          Conversas
        </a>
        <a
          [routerLink]="['/instances', instanceName(), 'settings']"
          routerLinkActive="active"
          class="tab-btn"
          role="tab"
          aria-label="Configurações da instância"
        >
          Configurações
        </a>
      </div>

      <!-- Connection status chip -->
      @if (connected() !== null) {
        <span
          class="conn-chip"
          [class.conn-chip--off]="!connected()"
          [attr.aria-label]="'Status da conexão: ' + (connected() ? 'conectado' : 'desconectado')"
        >
          <span class="conn-dot" aria-hidden="true"></span>
          <span class="conn-label">{{ connected() ? 'Conectado' : 'Desconectado' }}</span>
        </span>
      }
    </nav>
  `,
})
export class InstanceTabsComponent {
  readonly instanceName = input.required<string>();
  /** Pass true/false once status is known; null while loading (chip hidden) */
  readonly connected = input<boolean | null>(null);
}
