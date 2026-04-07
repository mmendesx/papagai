import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
} from '@angular/core';
import { NgClass } from '@angular/common';
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
}

interface InstancesListResponse {
  total: number;
  instances: InstanceRow[];
  message: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgClass],
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
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="url(#emptyGrad)"/>
            <path d="M20 24h24M20 32h16M20 40h20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <defs>
              <linearGradient id="emptyGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#006a2d"/>
                <stop offset="100%" stop-color="#006286"/>
              </linearGradient>
            </defs>
          </svg>
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
          <div
            class="instance-card"
            [attr.aria-label]="inst.name + ', ' + (inst.connected ? 'conectado' : 'desconectado')">

            <!-- Card header -->
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem;">
              <div>
                <div style="font-size: 0.9375rem; font-weight: 500; color: var(--color-on-surface); font-family: 'Figtree', sans-serif;">{{ inst.name }}</div>
              </div>
              @if (inst.connected) {
                <span class="badge-live">&#9679; CONECTADO</span>
              } @else {
                <span class="badge-offline">Desconectado</span>
              }
            </div>

            <!-- Metrics row -->
            <div class="metrics-row">
              <div class="metric-col">
                <div class="metric-label">&#128172; Chat de Entrada</div>
                <div class="metric-value">—</div>
              </div>
              <div class="metric-col">
                <div class="metric-label">&#8599; Chat de Saída</div>
                <div class="metric-value">—</div>
              </div>
              <div class="metric-col">
                <div class="metric-label">&lt;/&gt; API Calls</div>
                <div class="metric-value">—</div>
              </div>
            </div>

            <!-- Steps row -->
            <div class="steps-row">
              <div class="step" [ngClass]="{ 'step-done': inst.connected }">
                <span class="step-icon">{{ inst.connected ? '✓' : '○' }}</span>
                <span class="step-label">Login</span>
              </div>
              <div class="step" [ngClass]="{ 'step-done': inst.connected }">
                <span class="step-icon">{{ inst.connected ? '✓' : '○' }}</span>
                <span class="step-label">QR Escaneado</span>
              </div>
              <div class="step" [ngClass]="{ 'step-done': inst.connected }">
                <span class="step-icon">{{ inst.connected ? '✓' : '○' }}</span>
                <span class="step-label">Última Sync</span>
              </div>
            </div>

            <!-- Footer -->
            <div style="margin-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
              <button type="button" class="reconectar-btn" (click)="$event.preventDefault(); $event.stopPropagation()">
                RECONECTAR
              </button>
              <div style="text-align: right;">
                <div style="font-size: 0.6875rem; color: var(--color-on-surface-variant); font-weight: 200; font-family: 'Figtree', sans-serif;">Última atividade: {{ formatLastActive(inst.startTime) }}</div>
                <a [routerLink]="['/instances', inst.name]" style="font-size: 0.6875rem; color: var(--color-secondary); font-weight: 200; text-decoration: none; font-family: 'Figtree', sans-serif;" (click)="$event.stopPropagation()">Ver Detalhes</a>
              </div>
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
        min-width: 0;
        display: block;
        transition: transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default);
      }

      .instance-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      /* ── Live / offline badges ───────────────────────────── */
      .badge-live {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: var(--color-primary-container);
        color: var(--color-on-primary-container);
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-family: 'Figtree', sans-serif;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .badge-offline {
        background: var(--color-error-container);
        color: var(--color-on-error-container);
        font-size: 0.6875rem;
        font-weight: 400;
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-family: 'Figtree', sans-serif;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Metrics row ─────────────────────────────────────── */
      .metrics-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        background: var(--color-surface-container-low);
        border-radius: var(--radius-md);
        padding: 0.5rem;
      }

      .metric-col {
        text-align: center;
      }

      .metric-label {
        font-size: 0.625rem;
        color: var(--color-on-surface-variant);
        font-weight: 300;
        margin-bottom: 0.25rem;
        font-family: 'Figtree', sans-serif;
      }

      .metric-value {
        font-size: 1rem;
        font-weight: 500;
        color: var(--color-on-surface);
        font-family: 'Figtree', sans-serif;
      }

      /* ── Steps row ───────────────────────────────────────── */
      .steps-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .step {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex: 1;
        font-size: 0.6875rem;
      }

      .step-icon {
        font-size: 0.75rem;
        color: var(--color-outline-variant);
      }

      .step-done .step-icon {
        color: var(--color-primary);
      }

      .step-label {
        color: var(--color-on-surface-variant);
        font-weight: 200;
        font-family: 'Figtree', sans-serif;
      }

      .step-done .step-label {
        color: var(--color-on-surface);
      }

      /* ── Reconectar button ───────────────────────────────── */
      .reconectar-btn {
        background: var(--color-warning-bg);
        color: #d97757;
        font-weight: 600;
        font-family: 'Figtree', sans-serif;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        border: none;
        border-radius: var(--radius-md);
        padding: 0.4375rem 1rem;
        cursor: pointer;
        transition: background var(--duration-fast) var(--ease-default);
      }

      .reconectar-btn:hover {
        background: var(--color-surface-container);
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
        margin-bottom: 0.5rem;
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
