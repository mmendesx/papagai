import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { TuiConfirmService } from '@taiga-ui/kit/components/confirm';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
import { TuiTabs } from '@taiga-ui/kit/components/tabs';
import { firstValueFrom, timer } from 'rxjs';
import { filter, map, switchMap, takeWhile, tap } from 'rxjs/operators';
import { ChatsComponent } from './chats.component';
import { SendMessageComponent } from './send-message.component';
import { HeaderActionsService } from '../../shared/header-actions.service';

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
  webhook?: WebhookConfig;
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
  imports: [
    DatePipe,
    FormsModule,
    TuiButton,
    TuiSwitch,
    ...TuiTabs,
    ...TuiTextfield,
    SendMessageComponent,
    ChatsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- TuiTabs navigation -->
    <div style="padding: 0 1.5rem; border-bottom: 1px solid var(--tui-border-normal);">
      <tui-tabs
        [activeItemIndex]="activeTab()"
        (activeItemIndexChange)="onTabIndexChange($event)"
      >
        <button tuiTab type="button">Status &amp; QR</button>
        <button tuiTab type="button">Enviar Mensagem</button>
        <button tuiTab type="button">Conversas</button>
        <button tuiTab type="button">Webhook</button>
      </tui-tabs>
    </div>

    <!-- Tab content -->
    <div style="padding: 1.5rem;">
      @switch (activeTab()) {

        @case (0) {
          <!-- Status & QR tab -->
          @if (qrData(); as q) {
            @if (q.status === 'connected') {
              <!-- Connected status card -->
              <div class="status-card connected" style="max-width: 28rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="11" fill="var(--color-primary-container)"/>
                    <path
                      d="M6.5 11.5L9.5 14.5L15.5 8"
                      stroke="var(--color-primary)"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span style="font-size: 1rem; font-weight: 300; color: var(--color-on-primary-container);">Conectado</span>
                </div>
                <div class="info-grid">
                  <div class="info-row">
                    <span class="info-label">Telefone</span>
                    <span class="info-value">{{ q.phoneNumber ?? status()?.phoneNumber ?? '—' }}</span>
                  </div>
                  @if (status(); as s) {
                    <div class="info-row">
                      <span class="info-label">Tempo ativo</span>
                      <span class="info-value" style="display: flex; align-items: center; gap: 0.375rem;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <circle cx="7" cy="7" r="6" stroke="var(--color-on-surface-variant)" stroke-width="1.5"/>
                          <path d="M7 4v3l2 1.5" stroke="var(--color-on-surface-variant)" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        {{ formatMs(s.uptime) }}
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Desde</span>
                      <span class="info-value">{{ s.startTime | date: 'medium' }}</span>
                    </div>
                  }
                </div>
              </div>
            } @else if (q.status === 'qr' && q.qrImageData) {
              <!-- QR code display -->
              <div class="status-card qr" style="max-width: 28rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="11" cy="11" r="11" fill="var(--color-warning-bg)"/>
                    <path d="M11 7v4l2.5 1.5" style="stroke: var(--color-method-patch);" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span style="font-size: 1rem; font-weight: 300; color: var(--color-method-patch);">Waiting for scan</span>
                </div>
              </div>
              <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
                padding: 2rem 0;
              ">
                <p style="
                  margin: 0;
                  font-weight: 200;
                  color: var(--tui-text-secondary);
                ">Escaneie para conectar seu WhatsApp</p>
                <img
                  [src]="q.qrImageData"
                  alt="WhatsApp QR Code"
                  style="
                    max-width: 280px;
                    border-radius: 1rem;
                    box-shadow: var(--shadow-lg);
                    padding: 1rem;
                    background: white;
                  "
                />
              </div>
            } @else {
              <!-- Other status (loading, disconnected, etc.) -->
              <div class="status-card" style="
                max-width: 28rem;
                background: var(--tui-background-neutral-1);
                border-left-color: var(--tui-border-normal);
              ">
                <p style="margin: 0; font-weight: 200; color: var(--tui-text-secondary);">
                  {{ q.message ?? translateStatus(q.status) }}
                </p>
              </div>
            }
          } @else {
            <p style="color: var(--tui-text-secondary); font-weight: 200;">Carregando…</p>
          }
        }

        @case (1) {
          @if (name(); as n) {
            <app-send-message [instanceName]="n" />
          }
        }

        @case (2) {
          @if (name(); as n) {
            <app-chats [instanceName]="n" />
          }
        }

        @case (3) {
          <!-- Webhook config tab -->
          <div style="max-width: 30rem;">
            @if (webhookLoading()) {
              <p style="color: var(--tui-text-secondary); font-weight: 200;">Carregando configurações de webhook…</p>
            } @else {
              <form class="webhook-form" (ngSubmit)="saveWebhook()">

                <!-- Enabled toggle using TuiSwitch -->
                <label style="
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                  cursor: pointer;
                  padding: 0.5rem 0;
                ">
                  <input
                    tuiSwitch
                    type="checkbox"
                    [checked]="whEnabled()"
                    (change)="whEnabled.set(!whEnabled())"
                  />
                  <span style="font-weight: 300;">Ativar</span>
                </label>

                <tui-textfield>
                  <label tuiLabel>URL do Webhook</label>
                  <input
                    tuiTextfield
                    type="url"
                    [ngModel]="whUrl()"
                    (ngModelChange)="whUrl.set($event)"
                    [ngModelOptions]="{ standalone: true }"
                    autocomplete="off"
                    placeholder="https://example.com/webhook"
                  />
                </tui-textfield>

                <tui-textfield>
                  <label tuiLabel>Headers do Webhook (JSON)</label>
                  <input
                    tuiTextfield
                    type="text"
                    [ngModel]="whHeadersJson()"
                    (ngModelChange)="whHeadersJson.set($event)"
                    [ngModelOptions]="{ standalone: true }"
                    autocomplete="off"
                    placeholder="{}"
                  />
                </tui-textfield>

                <fieldset style="
                  border: 1px solid var(--tui-border-normal);
                  border-radius: var(--radius-lg);
                  padding: 0.75rem 1rem;
                  margin: 0;
                ">
                  <legend style="
                    padding: 0 0.25rem;
                    font-weight: 300;
                    font-size: 0.875rem;
                    color: var(--tui-text-secondary);
                  ">Eventos</legend>
                  @for (ev of availableEvents; track ev) {
                    <label style="
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                      padding: 0.3rem 0;
                      cursor: pointer;
                      font-weight: 200;
                    ">
                      <input
                        type="checkbox"
                        [checked]="whEvents().includes(ev)"
                        (change)="toggleEvent(ev)"
                      />
                      <span>{{ translateEvent(ev) }}</span>
                    </label>
                  }
                </fieldset>

                <div style="padding-top: 0.5rem;">
                  <button
                    tuiButton
                    type="submit"
                    size="m"
                    appearance="primary"
                    [disabled]="webhookSaving()"
                  >
                    {{ webhookSaving() ? 'Salvando…' : 'Salvar' }}
                  </button>
                </div>

              </form>
            }
          </div>
        }

      }
    </div>
  `,
  styles: [
    `
      .status-card {
        border-radius: var(--radius-xl);
        padding: 1.5rem;
        border-left: 4px solid transparent;
      }
      .status-card.connected {
        background: var(--color-primary-container);
        border-left-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
      }
      .status-card.qr {
        background: var(--color-warning-bg);
        border-left-color: color-mix(in srgb, var(--color-method-patch) 30%, transparent);
      }
      .info-grid {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
      }
      .info-row {
        display: flex;
        align-items: baseline;
        gap: 1rem;
      }
      .info-label {
        font-size: 0.75rem;
        font-weight: 300;
        color: var(--tui-text-secondary);
        min-width: 3.5rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .info-value {
        font-size: 0.9375rem;
        font-weight: 200;
        color: var(--tui-text-primary);
      }
      .webhook-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
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
  readonly activeTab = signal<number>(0);

  readonly webhookConfig = signal<WebhookConfig | null>(null);
  readonly webhookLoading = signal(false);
  readonly webhookSaving = signal(false);

  readonly whUrl = signal('');
  readonly whHeadersJson = signal('{}');
  readonly whEnabled = signal(false);
  readonly whEvents = signal<string[]>([]);

  readonly availableEvents = ['message', 'message_update', 'qr', 'connected', 'disconnected'];

  private static readonly STATUS_LABELS: Record<string, string> = {
    connected:    'Conectado',
    disconnected: 'Desconectado',
    qr:           'Aguardando QR Code',
    connecting:   'Conectando…',
    timeout:      'Tempo esgotado',
    close:        'Conexão encerrada',
    logout:       'Desconectado',
  };

  private static readonly EVENT_LABELS: Record<string, string> = {
    message:        'Mensagem',
    message_update: 'Atualização de mensagem',
    qr:             'QR Code',
    connected:      'Conectado',
    disconnected:   'Desconectado',
  };

  translateStatus(status: string): string {
    return InstanceDetailComponent.STATUS_LABELS[status] ?? status;
  }

  translateEvent(event: string): string {
    return InstanceDetailComponent.EVENT_LABELS[event] ?? event;
  }

  constructor() {
    const headerActions = inject(HeaderActionsService);
    headerActions.setActions([
      {
        id: 'delete-instance',
        label: 'Excluir',
        variant: 'negative',
        onClick: () => this.confirmDelete(),
      },
    ]);
    inject(DestroyRef).onDestroy(() => headerActions.clearActions());

    // QR polling: runs on status tab, stops once connected
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

    // Load webhook config when switching to the webhook tab (index 3)
    effect(() => {
      if (this.activeTab() === 3 && !this.webhookConfig()) {
        void this.loadWebhookConfig();
      }
    });
  }

  onTabIndexChange(index: number): void {
    this.activeTab.set(index);
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

  async loadWebhookConfig(): Promise<void> {
    const n = this.name();
    if (!n) return;
    this.webhookLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<StatusResponse>(
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
      this.whEvents.set(current.filter((e) => e !== event));
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
        this.alerts
          .open('Headers devem ser um objeto JSON.', { label: 'Erro', appearance: 'negative', autoClose: 4000 })
          .subscribe();
        return;
      }
      headers = parsed as Record<string, string>;
    } catch {
      this.alerts
        .open('Headers devem ser um JSON válido.', { label: 'Erro', appearance: 'negative', autoClose: 4000 })
        .subscribe();
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
      this.alerts
        .open('Configurações de webhook salvas.', { label: 'Feito', appearance: 'positive', autoClose: 3000 })
        .subscribe();
    } catch {
      this.alerts
        .open('Falha ao salvar webhook.', { label: 'Erro', appearance: 'negative', autoClose: 4000 })
        .subscribe();
    } finally {
      this.webhookSaving.set(false);
    }
  }

  confirmDelete(): void {
    const n = this.name();
    if (!n) return;
    this.confirm
      .withConfirm({
        label: 'Excluir instância',
        size: 's',
        data: {
          content: 'Isso irá excluir permanentemente a instância.',
          yes: 'Confirmar',
          no: 'Cancelar',
          appearance: 'negative',
        },
      })
      .subscribe((ok) => {
        if (!ok) return;
        void firstValueFrom(
          this.http.delete(`/api/instances/${encodeURIComponent(n)}`),
        )
          .then(() => {
            this.alerts
              .open('Instância removida.', {
                label: 'Feito',
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
