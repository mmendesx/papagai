import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
} from '@angular/core';
import { Router } from '@angular/router';
import { ResourceStatus } from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
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
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('staggerCards', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(16px)' }),
          stagger('60ms', [
            animate('350ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
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
      <div class="status-message" @fadeInUp>
        <p class="error-text">Falha ao carregar instâncias</p>
        <button (click)="reload()" class="gradient-btn" type="button">Tentar novamente</button>
      </div>
    }

    <!-- Empty state -->
    @else if (!instancesRes.isLoading() && data.instances.length === 0) {
      <div class="empty-state" @fadeInUp>
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
      <div class="instance-grid" @staggerCards>
        @for (inst of data.instances; track inst.name) {
          @let avatar = avatarStyle(inst.name);
          <div class="instance-card"
               role="link"
               tabindex="0"
               [class.is-online]="inst.connected"
               [attr.aria-label]="'Abrir instância ' + inst.name"
               (click)="navigateToInstance(inst.name)"
               (keydown.enter)="navigateToInstance(inst.name)"
               (keydown.space)="$event.preventDefault(); navigateToInstance(inst.name)">
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
                {{ inst.connected
                    ? (isConnecting(inst.startTime) ? 'Conectando...' : formatUptime(inst.startTime))
                    : offlineLabel(inst.startTime) }}
              </span>
              <span class="meta-sep" aria-hidden="true"></span>
              <span class="webhook-badge"
                    [class.webhook-badge--on]="inst.webhookEnabled"
                    [class.webhook-badge--off]="!inst.webhookEnabled">
                <span class="webhook-dot" aria-hidden="true"></span>
                {{ inst.webhookEnabled ? 'Webhook ativo' : 'Webhook inativo' }}
              </span>
            </div>

            <div class="card-footer" role="group" aria-label="Ações rápidas">
              <button class="footer-btn" type="button"
                      (click)="openInstance($event, inst.name)">Abrir</button>
              <button class="footer-btn footer-btn--icon" type="button"
                      (click)="openSettings($event, inst.name)"
                      title="Configurações"
                      aria-label="Configurações da instância">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            </div>
          </div>
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
        cursor: pointer;
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

      /* Webhook badge */
      .webhook-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.1875rem 0.4375rem;
        border-radius: var(--radius-full);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .webhook-badge--on {
        background: color-mix(in srgb, var(--color-success) 12%, transparent);
        color: color-mix(in srgb, var(--color-success) 80%, var(--color-on-surface));
      }
      .webhook-badge--off {
        background: var(--color-surface-container);
        color: var(--color-on-surface-variant);
        opacity: 0.8;
      }
      .webhook-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
      }

      /* Card footer CTA strip */
      .card-footer {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.625rem;
        border-top: 1px dashed var(--color-outline-variant);
        justify-content: flex-end;
      }
      .footer-btn {
        background: transparent;
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-md);
        padding: 0.3125rem 0.625rem;
        font-size: 0.6875rem;
        font-weight: 500;
        color: var(--color-on-surface-variant);
        cursor: pointer;
        font-family: var(--font-sans);
        transition: background var(--duration-fast) var(--ease-default);
      }
      .footer-btn:hover {
        background: var(--color-surface-container);
      }
      .footer-btn--icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3125rem 0.4375rem;
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

  navigateToInstance(name: string): void {
    void this.router.navigate(['/instances', name]);
  }

  isConnecting(startTime: number): boolean {
    return Date.now() - startTime < 300_000;
  }

  offlineLabel(startTime: number): string {
    if (!startTime) return 'Nunca conectada';
    return 'Offline há ' + this.formatUptime(startTime);
  }

  openInstance(event: Event, name: string): void {
    event.stopPropagation();
    void this.router.navigate(['/instances', name]);
  }

  openSettings(event: Event, name: string): void {
    event.stopPropagation();
    void this.router.navigate(['/instances', name, 'settings']);
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
