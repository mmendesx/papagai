import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ResourceStatus } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { CreateInstanceDialogComponent } from './create-instance-dialog.component';

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
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Instâncias</h1>
        <p class="page-subtitle">Suas conexões WhatsApp</p>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button
          (click)="reload()"
          class="icon-btn"
          title="Atualizar"
          type="button"
          aria-label="Atualizar instâncias">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13.65 2.35A7.958 7.958 0 0 0 8 0C3.58 0 0 3.58 0 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 8 14c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"
              fill="currentColor"/>
          </svg>
        </button>
        <button
          (click)="openCreate()"
          class="gradient-btn"
          type="button">
          + Nova instância
        </button>
      </div>
    </div>

    @let data = instancesRes.value();

    <!-- Loading state: skeleton cards -->
    @if (instancesRes.isLoading() && data.instances.length === 0) {
      <div class="instance-grid">
        @for (n of [1, 2, 3]; track n) {
          <div class="skeleton-card" aria-hidden="true">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-badge"></div>
            <div class="skeleton-line skeleton-meta"></div>
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
                <stop offset="0%" stop-color="#a855f7"/>
                <stop offset="100%" stop-color="#6366f1"/>
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
                <div style="font-size: 0.9375rem; font-weight: 500; color: #111827; font-family: 'Lexend', sans-serif;">{{ inst.name }}</div>
                <div style="font-size: 0.75rem; font-weight: 200; color: #6b7280; margin-top: 0.125rem; font-family: 'Lexend', sans-serif;">Lexend ExtraLight</div>
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
                <div style="font-size: 0.6875rem; color: #9ca3af; font-weight: 200; font-family: 'Lexend', sans-serif;">Última atividade: {{ formatLastActive(inst.startTime) }}</div>
                <a [routerLink]="['/instances', inst.name]" style="font-size: 0.6875rem; color: #2563eb; font-weight: 200; text-decoration: none; font-family: 'Lexend', sans-serif;" (click)="$event.stopPropagation()">Ver Detalhes</a>
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

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 1.5rem 1.5rem 0;
      }

      .page-title {
        font-size: 1.5rem;
        font-weight: 300;
        margin: 0 0 0.25rem;
        color: var(--tui-text-primary);
        font-family: 'Lexend', sans-serif;
      }

      .page-subtitle {
        font-size: 0.8125rem;
        font-weight: 200;
        color: var(--tui-text-secondary);
        margin: 0;
        font-family: 'Lexend', sans-serif;
      }

      /* ── Buttons ─────────────────────────────────────────── */
      .gradient-btn {
        background: var(--papagai-gradient-button);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.625rem;
        font-family: 'Lexend', sans-serif;
        font-weight: 200;
        font-size: 0.875rem;
        cursor: pointer;
        transition: opacity 0.2s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .gradient-btn:hover {
        opacity: 0.88;
      }

      .gradient-btn:active {
        opacity: 0.75;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        background: transparent;
        border: 1px solid var(--tui-border-normal, #e5e7eb);
        border-radius: 0.5rem;
        cursor: pointer;
        color: var(--tui-text-secondary);
        transition: background 0.15s ease, color 0.15s ease;
        flex-shrink: 0;
      }

      .icon-btn:hover {
        background: var(--tui-background-neutral-1, #f3f4f6);
        color: var(--papagai-purple);
      }

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
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 1rem;
        padding: 1.25rem;
        min-width: 0;
        display: block;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .instance-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }

      /* ── Live / offline badges ───────────────────────────── */
      .badge-live {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: #dcfce7;
        color: #15803d;
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        font-family: 'Lexend', sans-serif;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .badge-offline {
        background: #f3f4f6;
        color: #6b7280;
        font-size: 0.6875rem;
        font-weight: 400;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        font-family: 'Lexend', sans-serif;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Metrics row ─────────────────────────────────────── */
      .metrics-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        background: #f9fafb;
        border-radius: 0.5rem;
        padding: 0.5rem;
      }

      .metric-col {
        text-align: center;
      }

      .metric-label {
        font-size: 0.625rem;
        color: #9ca3af;
        font-weight: 300;
        margin-bottom: 0.25rem;
        font-family: 'Lexend', sans-serif;
      }

      .metric-value {
        font-size: 1rem;
        font-weight: 500;
        color: #374151;
        font-family: 'Lexend', sans-serif;
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
        color: #d1d5db;
      }

      .step-done .step-icon {
        color: #22c55e;
      }

      .step-label {
        color: #9ca3af;
        font-weight: 200;
        font-family: 'Lexend', sans-serif;
      }

      .step-done .step-label {
        color: #374151;
      }

      /* ── Reconectar button ───────────────────────────────── */
      .reconectar-btn {
        background: #fbbf24;
        color: #000;
        font-weight: 600;
        font-family: 'Lexend', sans-serif;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        border: none;
        border-radius: 0.5rem;
        padding: 0.4375rem 1rem;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .reconectar-btn:hover {
        background: #f59e0b;
      }

      /* ── Skeleton loading ────────────────────────────────── */
      .skeleton-card {
        background: white;
        border-radius: 1rem;
        padding: 1.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .skeleton-line {
        background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        border-radius: 0.375rem;
        animation: skeleton-pulse 1.5s ease-in-out infinite;
      }

      .skeleton-title {
        height: 1rem;
        width: 55%;
      }

      .skeleton-badge {
        height: 1.25rem;
        width: 5.5rem;
        border-radius: 999px;
      }

      .skeleton-meta {
        height: 0.75rem;
        width: 40%;
      }

      @keyframes skeleton-pulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
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
        font-family: 'Lexend', sans-serif;
      }

      .empty-body {
        font-size: 0.875rem;
        font-weight: 200;
        color: var(--tui-text-secondary);
        margin: 0 0 0.5rem;
        font-family: 'Lexend', sans-serif;
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
        color: var(--tui-status-negative, #ef4444);
        margin: 0;
        font-family: 'Lexend', sans-serif;
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly dialogs = inject(TuiDialogService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  readonly ResourceStatus = ResourceStatus;

  readonly instancesRes = httpResource<InstancesListResponse>(() => '/api/instances', {
    defaultValue: { total: 0, instances: [], message: '' },
  });

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
