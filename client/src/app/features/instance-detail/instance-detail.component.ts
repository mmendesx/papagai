import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import { TuiLink } from '@taiga-ui/core/components/link';
import { TuiConfirmService } from '@taiga-ui/kit/components/confirm';
import { firstValueFrom, timer } from 'rxjs';
import { filter, map, switchMap, takeWhile, tap } from 'rxjs/operators';
import { SendMessageComponent } from './send-message.component';
import { ChatsComponent } from './chats.component';

type QrResponse = {
  qr?: string;
  qrImageData?: string | null;
  status: string;
  instance?: string;
  message?: string;
  phoneNumber?: string;
};

type StatusResponse = {
  name: string;
  connected: boolean;
  startTime: string;
  uptime: number;
  phoneNumber?: string;
};

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, TuiButton, TuiLink, SendMessageComponent, ChatsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <a tuiLink routerLink="/dashboard">← Dashboard</a>
      <h1 class="tui-text_h5">{{ name() ?? '…' }}</h1>
      <button tuiButton type="button" size="s" appearance="negative" (click)="confirmDelete()">
        Delete
      </button>
    </div>

    <nav class="tabs">
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="tab() === 'status' ? 'primary' : 'secondary'"
        (click)="tab.set('status')"
      >
        Status &amp; QR
      </button>
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="tab() === 'message' ? 'primary' : 'secondary'"
        (click)="tab.set('message')"
      >
        Send message
      </button>
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="tab() === 'chats' ? 'primary' : 'secondary'"
        (click)="tab.set('chats')"
      >
        Chats
      </button>
    </nav>

    @if (tab() === 'status') {
      <div class="panel">
        @if (qrData(); as q) {
          @if (q.status === 'qr' && q.qrImageData) {
            <p>{{ q.message }}</p>
            <img [src]="q.qrImageData" alt="QR Code" class="qr" />
          } @else if (q.status === 'connected') {
            <p class="ok">{{ q.message }}</p>
            <p>Phone: {{ q.phoneNumber ?? status()?.phoneNumber ?? '—' }}</p>
            @if (status(); as s) {
              <p>Started: {{ s.startTime | date: 'medium' }}</p>
              <p>Uptime: {{ formatMs(s.uptime) }}</p>
            }
          } @else {
            <p>{{ q.message }}</p>
            <p class="muted">Status: {{ q.status }}</p>
          }
        } @else {
          <p>Loading…</p>
        }
      </div>
    } @else if (tab() === 'message') {
      @if (name(); as n) {
        <app-send-message [instanceName]="n" />
      }
    } @else {
      @if (name(); as n) {
        <app-chats [instanceName]="n" />
      }
    }
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
      }
      .toolbar h1 {
        flex: 1;
        margin: 0;
      }
      .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
      }
      .panel {
        max-width: 24rem;
      }
      .qr {
        max-width: 100%;
        border-radius: var(--tui-radius-m);
      }
      .ok {
        color: var(--tui-status-positive);
      }
      .muted {
        color: var(--tui-text-secondary);
      }
    `,
  ],
})
export class InstanceDetailComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(TuiConfirmService);
  private readonly alerts = inject(TuiAlertService);

  readonly name = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('name'))),
    { initialValue: null as string | null },
  );

  readonly qrData = signal<QrResponse | null>(null);
  readonly status = signal<StatusResponse | null>(null);
  readonly tab = signal<'status' | 'message' | 'chats'>('status');

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('name')),
        filter((n): n is string => !!n),
        switchMap((instanceName) =>
          timer(0, 3000).pipe(
            switchMap(() =>
              this.http.get<QrResponse>(
                `/api/instances/${encodeURIComponent(instanceName)}/qr`,
              ),
            ),
            takeWhile((r) => r.status !== 'connected', true),
            tap((r) => {
              if (r.status === 'connected') {
                void firstValueFrom(
                  this.http.get<StatusResponse>(
                    `/api/instances/${encodeURIComponent(instanceName)}/status`,
                  ),
                )
                  .then((s) => this.status.set(s))
                  .catch(() => this.status.set(null));
              }
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (r) => this.qrData.set(r),
        error: () => this.qrData.set(null),
      });
  }

  formatMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) {
      return `${d}d ${h % 24}h`;
    }
    if (h > 0) {
      return `${h}h ${m % 60}m`;
    }
    if (m > 0) {
      return `${m}m ${s % 60}s`;
    }
    return `${s}s`;
  }

  confirmDelete(): void {
    const n = this.name();
    if (!n) {
      return;
    }
    this.confirm
      .withConfirm({
        label: 'Delete instance',
        size: 's',
        data: {
          content: `Remove ${n}? This disconnects WhatsApp for this instance.`,
          yes: 'Delete',
          no: 'Cancel',
          appearance: 'negative',
        },
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        void firstValueFrom(
          this.http.delete(`/api/instances/${encodeURIComponent(n)}`),
        )
          .then(() => {
            this.alerts
              .open('Instance removed.', {
                label: 'Done',
                appearance: 'positive',
                autoClose: 3000,
              })
              .subscribe();
            void this.router.navigate(['/dashboard']);
          })
          .catch(() => void 0);
      });
  }
}
