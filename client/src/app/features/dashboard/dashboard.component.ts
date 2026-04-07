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
          <div class="instance-card">
            <div class="card-header">
              <span class="instance-name">{{ inst.name }}</span>
              <div class="badge-row">
                <span class="status-badge" [class.live]="inst.connected">
                  {{ inst.connected ? '● Conectado' : 'Desconectado' }}
                </span>
                <span class="webhook-badge" [class.active]="inst.webhookEnabled">
                  {{ inst.webhookEnabled ? '⚡ Webhook' : 'Webhook off' }}
                </span>
              </div>
            </div>
            <div class="card-body">
              @if (inst.phoneNumber) {
                <span class="phone-number">{{ formatPhone(inst.phoneNumber) }}</span>
              }
              <span class="last-active">{{ formatLastActive(inst.startTime) }}</span>
            </div>
            <div class="card-footer">
              <a [routerLink]="['/instances', inst.name]" class="detail-link" (click)="$event.stopPropagation()">
                Ver detalhes →
              </a>
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
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        transition: box-shadow var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
      }
      .instance-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
      .card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .instance-name {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-on-surface);
        font-family: var(--font-sans);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .status-badge {
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 0.2rem 0.6rem;
        border-radius: var(--radius-full);
        white-space: nowrap;
        flex-shrink: 0;
        background: var(--color-error-container);
        color: var(--color-on-error-container);
        font-family: var(--font-sans);
      }
      .status-badge.live {
        background: var(--color-primary-container);
        color: var(--color-on-primary-container);
      }
      .badge-row {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex-shrink: 0;
      }
      .webhook-badge {
        font-size: 0.625rem;
        font-weight: 500;
        padding: 0.15rem 0.5rem;
        border-radius: var(--radius-full);
        white-space: nowrap;
        font-family: var(--font-sans);
        background: var(--color-surface-container);
        color: var(--color-on-surface-variant);
      }
      .webhook-badge.active {
        background: var(--color-secondary-container);
        color: var(--color-on-secondary-container);
      }
      .card-body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .phone-number {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-on-surface);
        font-family: var(--font-sans);
      }
      .last-active {
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--color-on-surface-variant);
        font-family: var(--font-sans);
      }
      .card-footer {
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-outline-variant);
      }
      .detail-link {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-secondary);
        text-decoration: none;
        font-family: var(--font-sans);
        transition: color var(--duration-fast) var(--ease-default);
      }
      .detail-link:hover { color: var(--color-primary); }

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
    defaultValue: { total: 0, instances: [], message: '' },
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
