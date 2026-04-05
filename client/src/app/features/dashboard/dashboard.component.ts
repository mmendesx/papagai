import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ResourceStatus } from '@angular/core';
import { TuiButton, TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { CreateInstanceDialogComponent } from './create-instance-dialog.component';

export interface InstanceRow {
  name: string;
  connected: boolean;
  startTime: number;
}

interface InstancesListResponse {
  total: number;
  instances: InstanceRow[];
  message: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TuiButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h1 class="tui-text_h5">Instances</h1>
      <div class="actions">
        <button tuiButton type="button" size="s" appearance="secondary" (click)="reload()">
          Refresh
        </button>
        <button tuiButton type="button" size="m" (click)="openCreate()">Create instance</button>
      </div>
    </div>

    @let data = instancesRes.value();
    @if (instancesRes.isLoading() && data.instances.length === 0) {
      <p>Loading…</p>
    } @else if (instancesRes.status() === ResourceStatus.Error) {
      <p class="err">Could not load instances.</p>
    } @else if (data.instances.length === 0) {
      <div class="empty">
        <p>No instances yet.</p>
        <button tuiButton type="button" size="m" (click)="openCreate()">Create instance</button>
      </div>
    } @else {
      <ul class="list">
        @for (inst of data.instances; track inst.name) {
          <li class="card">
            <a class="name" [routerLink]="['/instances', inst.name]">{{ inst.name }}</a>
            <span
              class="badge"
              [class.on]="inst.connected"
              [class.off]="!inst.connected"
              >{{ inst.connected ? 'Connected' : 'Disconnected' }}</span
            >
            <div class="meta">Uptime: {{ formatUptime(inst.startTime) }}</div>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
      .err {
        color: var(--tui-status-negative);
      }
      .empty {
        padding: 2rem;
        text-align: center;
        border-radius: var(--tui-radius-l);
        background: var(--tui-background-elevation-1);
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .card {
        padding: 1rem 1.25rem;
        border-radius: var(--tui-radius-l);
        background: var(--tui-background-elevation-1);
        display: grid;
        gap: 0.35rem;
      }
      .name {
        font-weight: 600;
        color: var(--tui-text-action);
        text-decoration: none;
      }
      .badge {
        font: var(--tui-font-text-s);
        width: fit-content;
        padding: 0.15rem 0.5rem;
        border-radius: var(--tui-radius-s);
      }
      .badge.on {
        background: color-mix(in srgb, var(--tui-status-positive) 20%, transparent);
        color: var(--tui-status-positive);
      }
      .badge.off {
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-secondary);
      }
      .meta {
        font: var(--tui-font-text-s);
        color: var(--tui-text-secondary);
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

  openCreate(): void {
    this.dialogs
      .open(
        new PolymorpheusComponent(CreateInstanceDialogComponent, this.injector),
        { label: 'Create instance', size: 'm' },
      )
      .subscribe((result: string | void) => {
        if (result) {
          this.instancesRes.reload();
          void this.router.navigate(['/instances', result]);
        }
      });
  }
}
