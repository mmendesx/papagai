import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ResourceStatus } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { CreateInstanceDialogComponent } from './create-instance-dialog.component';
import { HeaderActionsService } from '../../shared/header-actions.service';
import { getAvatarColor } from '../../shared/avatar-colors';

export interface InstanceRow {
  name: string;
  connected: boolean;
  startTime: number;
  webhookEnabled: boolean;
  phoneNumber: string | null;
}

interface InstancesListResponse {
  total: number;
  instances: InstanceRow[];
  message: string;
  page: number;
  limit: number;
  totalPages: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = instancesRes.value();

    <!-- Loading state: skeleton cards -->
    @if (instancesRes.isLoading() && data.instances.length === 0) {
      <div class="instance-grid">
        @for (n of [1, 2, 3]; track n) {
          <div class="skeleton-card" aria-hidden="true">
            <div class="ec-skeleton skeleton-title"></div>
            <div class="ec-skeleton skeleton-badge"></div>
            <div class="ec-skeleton skeleton-meta"></div>
          </div>
        }
      </div>
    }

    <!-- Error state -->
    @else if (instancesRes.status() === ResourceStatus.Error) {
      <div class="status-message">
        <p class="error-text">Falha ao carregar instâncias</p>
        <button (click)="reload()" class="gradient-btn" type="button">Tentar novamente</button>
      </div>
    }

    <!-- Empty state -->
    @else if (!instancesRes.isLoading() && data.instances.length === 0) {
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <img src="/parrot.png" alt="" width="72" height="72" />
        </div>
        <h3 class="empty-heading">Nenhuma instância ainda</h3>
        <p class="empty-body">Crie sua primeira instância para começar</p>
        <button (click)="openCreate()" class="gradient-btn" type="button">Criar instância</button>
      </div>
    }

    <!-- Populated state -->
    @else {
      <div class="instance-grid">
        @for (inst of data.instances; track inst.name) {
          @let avatar = avatarStyle(inst.name);
          <a [routerLink]="['/instances', inst.name]"
             class="instance-card"
             [class.is-online]="inst.connected"
             [attr.aria-label]="'Abrir instância ' + inst.name">
            <span class="card-glow" aria-hidden="true"></span>

            <div class="card-top">
              <div class="card-avatar"
                   [style.background]="avatar.bg"
                   [style.color]="avatar.text"
                   aria-hidden="true">{{ initials(inst.name) }}</div>
              <div class="card-identity">
                <span class="card-name">{{ inst.name }}</span>
                @if (inst.phoneNumber) {
                  <span class="card-phone">{{ formatPhone(inst.phoneNumber) }}</span>
                } @else {
                  <span class="card-phone card-phone--muted">Sem número</span>
                }
              </div>
              <span class="status-pill" [class.status-pill--on]="inst.connected">
                <span class="status-dot" [class.status-dot--pulse]="inst.connected" aria-hidden="true"></span>
                {{ inst.connected ? 'Online' : 'Offline' }}
              </span>
            </div>

            <div class="card-meta">
              <span class="meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"/>
                  <path stroke-linecap="round" d="M12 7v5l3 2"/>
                </svg>
                {{ inst.connected ? formatLastActive(inst.startTime) : 'Inativa' }}
              </span>
              <span class="meta-sep" aria-hidden="true"></span>
              <span class="meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.69a4.5 4.5 0 011.24 7.24l-4.5 4.5a4.5 4.5 0 01-6.36-6.36l1.76-1.76m13.35-.62l1.76-1.76a4.5 4.5 0 00-6.36-6.36l-4.5 4.5a4.5 4.5 0 001.24 7.24"/>
                </svg>
                {{ inst.webhookEnabled ? 'Webhook ativo' : 'Webhook inativo' }}
              </span>
            </div>

            <span class="card-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </a>
        }
      </div>
    }
  `,
  styles: [
    `
      /* ── Layout ─────────────────────────────────────────── */
      :host {
        display: block;
      }

      /* ── Inline content buttons ──────────────────────────── */
      .gradient-btn {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border: none;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-lg);
        font-family: var(--font-sans);
        font-weight: 500;
        font-size: 0.875rem;
        cursor: pointer;
        transition: opacity var(--duration-fast) var(--ease-default);
      }
      .gradient-btn:hover { opacity: 0.88; }

      /* ── Grid ────────────────────────────────────────────── */
      .instance-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        padding: 1rem 1rem 1rem;
      }

      @media (min-width: 480px) {
        .instance-grid {
          padding: 1.25rem 1.5rem 1.5rem;
        }
      }

      @media (min-width: 640px) {
        .instance-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: 1024px) {
        .instance-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      /* ── Instance card ───────────────────────────────────── */
      .instance-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        padding: 1.125rem 1.25rem 1rem;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        text-decoration: none;
        color: inherit;
        font-family: var(--font-sans);
        overflow: hidden;
        isolation: isolate;
        transition:
          border-color var(--duration-fast) var(--ease-default),
          transform var(--duration-fast) var(--ease-default),
          box-shadow var(--duration-fast) var(--ease-default);
      }
      .instance-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--color-outline);
      }
      .instance-card.is-online:hover {
        border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-outline-variant));
      }
      .instance-card:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      /* Subtle ambient glow behind connected cards (top-left) */
      .card-glow {
        position: absolute;
        inset: -40% 40% 40% -40%;
        z-index: -1;
        background: radial-gradient(
          circle at 30% 30%,
          color-mix(in srgb, var(--color-primary) 10%, transparent) 0%,
          transparent 60%
        );
        opacity: 0;
        transition: opacity var(--duration-normal) var(--ease-default);
        pointer-events: none;
      }
      .instance-card.is-online .card-glow { opacity: 1; }

      /* Top row */
      .card-top {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .card-avatar {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .card-identity {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }
      .card-name {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-on-surface);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-phone {
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--color-on-surface-variant);
        font-feature-settings: "tnum";
      }
      .card-phone--muted { font-style: italic; opacity: 0.7; }

      /* Status pill */
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.5rem 0.25rem 0.4375rem;
        border-radius: var(--radius-full);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        background: var(--color-surface-container);
        color: var(--color-on-surface-variant);
        flex-shrink: 0;
        align-self: flex-start;
      }
      .status-pill--on {
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: color-mix(in srgb, var(--color-primary) 85%, var(--color-on-surface));
      }
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-on-surface-variant);
        flex-shrink: 0;
      }
      .status-pill--on .status-dot { background: var(--color-success); }
      .status-dot--pulse {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 55%, transparent);
        animation: pulse 1.8s var(--ease-default) infinite;
      }
      @keyframes pulse {
        0%   { box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-success) 50%, transparent); }
        70%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-success)  0%, transparent); }
        100% { box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-success)  0%, transparent); }
      }

      /* Meta row */
      .card-meta {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding-top: 0.625rem;
        border-top: 1px dashed var(--color-outline-variant);
      }
      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.6875rem;
        font-weight: 500;
        color: var(--color-on-surface-variant);
        white-space: nowrap;
      }
      .meta-item svg { flex-shrink: 0; opacity: 0.7; }
      .meta-sep {
        width: 1px;
        height: 12px;
        background: var(--color-outline-variant);
        flex-shrink: 0;
      }

      /* Arrow indicator (bottom-right) */
      .card-arrow {
        position: absolute;
        right: 0.875rem;
        bottom: 0.875rem;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: var(--radius-full);
        color: var(--color-on-surface-variant);
        opacity: 0;
        transform: translateX(-4px);
        transition:
          opacity var(--duration-fast) var(--ease-default),
          transform var(--duration-fast) var(--ease-default),
          color var(--duration-fast) var(--ease-default);
      }
      .instance-card:hover .card-arrow {
        opacity: 1;
        transform: translateX(0);
        color: var(--color-primary);
      }

      /* ── Skeleton loading ────────────────────────────────── */
      .skeleton-card {
        background: var(--color-surface-container-lowest);
        border-radius: var(--radius-xl);
        padding: 1.25rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ec-skeleton {
        border-radius: var(--radius-md);
        background: linear-gradient(
          90deg,
          rgba(20,20,19,.05) 0%,
          rgba(20,20,19,.10) 50%,
          rgba(20,20,19,.05) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 2s linear infinite;
      }

      .skeleton-title {
        height: 1rem;
        width: 55%;
      }

      .skeleton-badge {
        height: 1.25rem;
        width: 5.5rem;
        border-radius: var(--radius-full);
      }

      .skeleton-meta {
        height: 0.75rem;
        width: 40%;
      }

      @keyframes shimmer {
        from { background-position: -200% 0; }
        to   { background-position:  200% 0; }
      }

      /* ── Empty state ─────────────────────────────────────── */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        gap: 0.75rem;
      }

      .empty-icon {
        margin-bottom: 0.75rem;
        opacity: 0.85;
      }
      .empty-icon img {
        display: block;
      }

      .empty-heading {
        font-size: 1.125rem;
        font-weight: 300;
        margin: 0;
        color: var(--tui-text-primary);
        font-family: 'Figtree', sans-serif;
      }

      .empty-body {
        font-size: 0.875rem;
        font-weight: 200;
        color: var(--tui-text-secondary);
        margin: 0 0 0.5rem;
        font-family: 'Figtree', sans-serif;
      }

      /* ── Status / error messages ─────────────────────────── */
      .status-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 3rem 2rem;
        text-align: center;
      }

      .error-text {
        font-size: 0.875rem;
        font-weight: 200;
        color: var(--tui-status-negative);
        margin: 0;
        font-family: 'Figtree', sans-serif;
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly dialogs = inject(TuiDialogService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly headerActions = inject(HeaderActionsService);

  readonly ResourceStatus = ResourceStatus;

  readonly instancesRes = httpResource<InstancesListResponse>(() => '/api/instances', {
    defaultValue: { total: 0, instances: [], message: '', page: 1, limit: 20, totalPages: 0 },
  });

  constructor() {
    this.headerActions.setActions([
      {
        id: 'reload',
        label: '↺',
        variant: 'icon-only',
        onClick: () => this.reload(),
      },
      {
        id: 'add-instance',
        label: '+ Nova instância',
        variant: 'primary',
        onClick: () => this.openCreate(),
      },
    ]);
    inject(DestroyRef).onDestroy(() => this.headerActions.clearActions());
  }

  reload(): void {
    this.instancesRes.reload();
  }

  formatUptime(startTime: number): string {
    const ms = Date.now() - startTime;
    if (ms < 0) {
      return '—';
    }
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}h ${m % 60}m`;
    }
    if (m > 0) {
      return `${m}m ${s % 60}s`;
    }
    return `${s}s`;
  }

  formatPhone(raw: string): string {
    if (!raw || raw.length < 10) return raw;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 13) {
      // +55 XX 9XXXX-XXXX (Brazilian mobile)
      return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      // +55 XX XXXX-XXXX (Brazilian landline)
      return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,8)}-${digits.slice(8)}`;
    }
    return `+${digits}`;
  }

  initials(name: string): string {
    const cleaned = (name ?? '').replace(/[^a-z0-9]/gi, ' ').trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
  }

  avatarStyle(name: string): { bg: string; text: string } {
    return getAvatarColor(name);
  }

  formatLastActive(startTime: number): string {
    if (!startTime) return '—';
    const mins = Math.floor((Date.now() - startTime) / 60000);
    if (mins < 1) return 'agora mesmo';
    if (mins === 1) return '1 min atrás';
    if (mins < 60) return `${mins} min atrás`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h atrás`;
  }

  openCreate(): void {
    this.dialogs
      .open(
        new PolymorpheusComponent(CreateInstanceDialogComponent, this.injector),
        { label: 'Criar instância', size: 'm' },
      )
      .subscribe((result: string | void) => {
        if (result) {
          this.instancesRes.reload();
          void this.router.navigate(['/instances', result]);
        }
      });
  }
}
