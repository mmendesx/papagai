import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import { TuiLink } from '@taiga-ui/core/components/link';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
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

type WebhookConfig = {
  url: string | null;
  headers: Record<string, string>;
  enabled: boolean;
  events: string[];
};

type WebhookResponse = {
  instance: string;
  webhook: WebhookConfig;
};

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, TuiButton, TuiLink, ...TuiTextfield, SendMessageComponent, ChatsComponent],
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
        (click)="onTabChange('status')"
      >
        Status &amp; QR
      </button>
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="tab() === 'message' ? 'primary' : 'secondary'"
        (click)="onTabChange('message')"
      >
        Send message
      </button>
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="tab() === 'chats' ? 'primary' : 'secondary'"
        (click)="onTabChange('chats')"
      >
        Chats
      </button>
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="tab() === 'webhook' ? 'primary' : 'secondary'"
        (click)="onTabChange('webhook')"
      >
        Webhook
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
    } @else if (tab() === 'chats') {
      @if (name(); as n) {
        <app-chats [instanceName]="n" />
      }
    } @else if (tab() === 'webhook') {
      <div class="panel webhook-panel">
        @if (webhookLoading()) {
          <p>Loading webhook configuration…</p>
        } @else {
          <form class="webhook-form" (ngSubmit)="saveWebhook()">
            <label class="toggle-row">
              <input type="checkbox" [checked]="whEnabled()" (change)="whEnabled.set(!whEnabled())" />
              <span>Webhook enabled</span>
            </label>

            <tui-textfield>
              <label tuiLabel>Webhook URL</label>
              <input tuiTextfield type="url" [ngModel]="whUrl()" (ngModelChange)="whUrl.set($event)" [ngModelOptions]="{standalone: true}" autocomplete="off" />
            </tui-textfield>

            <tui-textfield>
              <label tuiLabel>Headers (JSON)</label>
              <input tuiTextfield type="text" [ngModel]="whHeadersJson()" (ngModelChange)="whHeadersJson.set($event)" [ngModelOptions]="{standalone: true}" autocomplete="off" />
            </tui-textfield>

            <fieldset class="events-fieldset">
              <legend>Events</legend>
              @for (ev of availableEvents; track ev) {
                <label class="event-check">
                  <input type="checkbox" [checked]="whEvents().includes(ev)" (change)="toggleEvent(ev)" />
                  <span>{{ ev }}</span>
                </label>
              }
            </fieldset>

            <button tuiButton type="submit" size="m" [disabled]="webhookSaving()">
              {{ webhookSaving() ? 'Saving…' : 'Save' }}
            </button>
          </form>
        }
      </div>
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
      .webhook-panel {
        max-width: 30rem;
      }
      .webhook-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
      }
      .events-fieldset {
        border: 1px solid var(--tui-border-normal);
        border-radius: var(--tui-radius-m);
        padding: 0.75rem;
      }
      .events-fieldset legend {
        padding: 0 0.25rem;
        font-weight: 500;
      }
      .event-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0;
        cursor: pointer;
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
  readonly tab = signal<'status' | 'message' | 'chats' | 'webhook'>('status');

  readonly webhookConfig = signal<WebhookConfig | null>(null);
  readonly webhookLoading = signal(false);
  readonly webhookSaving = signal(false);

  readonly whUrl = signal('');
  readonly whHeadersJson = signal('{}');
  readonly whEnabled = signal(false);
  readonly whEvents = signal<string[]>([]);

  readonly availableEvents = ['message', 'message_update', 'qr', 'connected', 'disconnected'];

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

  onTabChange(tab: 'status' | 'message' | 'chats' | 'webhook'): void {
    this.tab.set(tab);
    if (tab === 'webhook' && !this.webhookConfig()) {
      void this.loadWebhookConfig();
    }
  }

  async loadWebhookConfig(): Promise<void> {
    const n = this.name();
    if (!n) return;
    this.webhookLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<StatusResponse & { webhook?: WebhookConfig }>(
          `/api/instances/${encodeURIComponent(n)}/status`,
        ),
      );
      const wh = res.webhook ?? { url: null, headers: {}, enabled: false, events: [] };
      this.webhookConfig.set(wh);
      this.whUrl.set(wh.url ?? '');
      this.whHeadersJson.set(JSON.stringify(wh.headers ?? {}, null, 2));
      this.whEnabled.set(wh.enabled);
      this.whEvents.set([...wh.events]);
    } catch {
      this.webhookConfig.set(null);
    } finally {
      this.webhookLoading.set(false);
    }
  }

  toggleEvent(event: string): void {
    const current = this.whEvents();
    if (current.includes(event)) {
      this.whEvents.set(current.filter(e => e !== event));
    } else {
      this.whEvents.set([...current, event]);
    }
  }

  async saveWebhook(): Promise<void> {
    const n = this.name();
    if (!n) return;

    const raw = this.whHeadersJson().trim();
    let headers: Record<string, string>;
    try {
      const parsed = JSON.parse(raw === '' ? '{}' : raw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.alerts.open('Headers must be a JSON object.', { label: 'Error', appearance: 'negative', autoClose: 4000 }).subscribe();
        return;
      }
      headers = parsed as Record<string, string>;
    } catch {
      this.alerts.open('Headers must be valid JSON.', { label: 'Error', appearance: 'negative', autoClose: 4000 }).subscribe();
      return;
    }

    this.webhookSaving.set(true);
    try {
      const body: Record<string, unknown> = {
        enabled: this.whEnabled(),
        events: this.whEvents(),
        webhookHeaders: headers,
      };
      const url = this.whUrl().trim();
      if (url) body['webhookUrl'] = url;

      const res = await firstValueFrom(
        this.http.patch<WebhookResponse>(
          `/api/instances/${encodeURIComponent(n)}/webhook`,
          body,
        ),
      );
      this.webhookConfig.set(res.webhook);
      this.alerts.open('Webhook settings saved.', { label: 'Done', appearance: 'positive', autoClose: 3000 }).subscribe();
    } catch {
      this.alerts.open('Failed to save webhook settings.', { label: 'Error', appearance: 'negative', autoClose: 4000 }).subscribe();
    } finally {
      this.webhookSaving.set(false);
    }
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
