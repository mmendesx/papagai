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
import { TuiCheckbox } from '@taiga-ui/kit/components/checkbox';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
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
    FormsModule,
    TuiButton,
    TuiCheckbox,
    TuiSwitch,
    ...TuiTextfield,
    SendMessageComponent,
    ChatsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (qrData(); as q) {
      @if (q.status === 'connected') {

        <!-- Status strip -->
        <div class="status-strip">
          <span class="conn-dot"></span>
          <span class="strip-label">Conectado</span>
          @if ((q.phoneNumber ?? status()?.phoneNumber); as phone) {
            <span class="strip-sep">·</span>
            <span class="strip-phone">{{ phone }}</span>
          }
          @if (status(); as s) {
            <span class="strip-sep">·</span>
            <span class="strip-uptime">{{ formatMs(s.uptime) }}</span>
          }
        </div>

        <!-- Two-panel layout -->
        <div class="detail-layout">

          <!-- Left: Send + Webhook -->
          <div class="detail-left">

            <!-- Send Message section -->
            <div class="left-section">
              <div class="left-section-header">
                <span class="section-title">Enviar Mensagem</span>
              </div>
              @if (name(); as n) {
                <app-send-message [instanceName]="n" />
              }
            </div>

            <!-- Webhook section (collapsible) -->
            <div class="left-section">
              <button type="button" class="left-section-header webhook-toggle-header"
                      (click)="toggleWebhookOpen()">
                <span class="section-title">Webhook</span>
                <span class="webhook-badge" [class.active]="whEnabled()">
                  {{ whEnabled() ? 'ativo' : 'inativo' }}
                </span>
                <svg class="chevron-icon" [class.rotated]="webhookOpen()"
                     width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              @if (webhookOpen()) {
                @if (webhookLoading()) {
                  <p class="loading-text wh-pad">Carregando…</p>
                } @else {
                  <form class="webhook-form" (ngSubmit)="saveWebhook()">
                    <label class="toggle-row">
                      <input tuiSwitch type="checkbox"
                        [ngModel]="whEnabled()"
                        (ngModelChange)="whEnabled.set($event)"
                        [ngModelOptions]="{ standalone: true }" />
                      <span class="toggle-label">Ativar</span>
                    </label>
                    <tui-textfield>
                      <label tuiLabel>URL</label>
                      <input tuiTextfield type="url"
                        [ngModel]="whUrl()"
                        (ngModelChange)="whUrl.set($event)"
                        [ngModelOptions]="{ standalone: true }"
                        autocomplete="off"
                        placeholder="https://example.com/webhook" />
                    </tui-textfield>
                    <tui-textfield>
                      <label tuiLabel>Cabeçalhos (JSON)</label>
                      <input tuiTextfield type="text"
                        [ngModel]="whHeadersJson()"
                        (ngModelChange)="whHeadersJson.set($event)"
                        [ngModelOptions]="{ standalone: true }"
                        autocomplete="off"
                        placeholder="{}" />
                    </tui-textfield>
                    <div class="form-section">
                      <p class="section-label-small">Eventos</p>
                      <div class="events-grid">
                        @for (ev of availableEvents; track ev) {
                          <label class="event-row">
                            <input tuiCheckbox type="checkbox"
                              [ngModel]="whEvents().includes(ev)"
                              (ngModelChange)="toggleEvent(ev)"
                              [ngModelOptions]="{ standalone: true }" />
                            <span class="event-label">{{ translateEvent(ev) }}</span>
                          </label>
                        }
                      </div>
                    </div>
                    <div class="form-footer">
                      <button tuiButton type="submit" size="s" appearance="primary"
                              [disabled]="webhookSaving()">
                        {{ webhookSaving() ? 'Salvando…' : 'Salvar' }}
                      </button>
                    </div>
                  </form>
                }
              }
            </div>

          </div>

          <!-- Right: Conversations -->
          <div class="detail-right">
            <div class="right-header">
              <span class="section-title">Conversas</span>
            </div>
            @if (name(); as n) {
              <app-chats [instanceName]="n" />
            }
          </div>

        </div>

      } @else if (q.status === 'qr' && q.qrImageData) {

        <!-- QR scan state: centered -->
        <div class="qr-layout">
          <div class="qr-card">
            <div class="status-header">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="11" fill="var(--color-warning-bg)"/>
                <path d="M11 7v4l2.5 1.5" style="stroke: var(--color-method-patch);"
                      stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span class="status-label qr-label">Aguardando leitura do QR Code</span>
            </div>
            <p class="qr-hint">Escaneie com o WhatsApp para conectar</p>
            <img [src]="q.qrImageData" alt="WhatsApp QR Code" class="qr-image" />
          </div>
        </div>

      } @else {

        <!-- Other status (disconnected, connecting, etc.) -->
        <div class="centered-state">
          <div class="status-card neutral">
            <p class="status-text">{{ q.message ?? translateStatus(q.status) }}</p>
          </div>
        </div>

      }
    } @else {
      <div class="centered-state">
        <p class="loading-text">Carregando…</p>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      /* ── Status strip ──────────────────────────────────────── */
      .status-strip {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.5rem 1.5rem;
        background: color-mix(in srgb, var(--color-primary-container) 35%, var(--color-surface-container-lowest));
        border-bottom: 1px solid var(--color-outline-variant);
        flex-shrink: 0;
        font-family: var(--font-sans);
        font-size: 0.8125rem;
      }
      .conn-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--color-primary);
        flex-shrink: 0;
      }
      .strip-label { font-weight: 600; color: var(--color-on-surface); }
      .strip-sep { color: var(--color-outline-variant); }
      .strip-phone, .strip-uptime { font-weight: 400; color: var(--color-on-surface-variant); }

      /* ── Two-panel layout ──────────────────────────────────── */
      .detail-layout {
        display: flex;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }

      .detail-left {
        width: 340px;
        flex-shrink: 0;
        border-right: 1px solid var(--color-outline-variant);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .detail-right {
        flex: 1;
        min-width: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      /* ── Section headers ───────────────────────────────────── */
      .left-section {
        border-bottom: 1px solid var(--color-outline-variant);
        flex-shrink: 0;
      }
      .left-section:last-child { border-bottom: none; }

      .left-section-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem 0.625rem;
        width: 100%;
      }

      .webhook-toggle-header {
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background var(--duration-fast) var(--ease-default);
      }
      .webhook-toggle-header:hover { background: var(--color-surface-container-low); }

      .section-title {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-on-surface-variant);
        flex: 1;
        font-family: var(--font-sans);
      }

      .webhook-badge {
        font-size: 0.625rem;
        font-weight: 500;
        padding: 0.1rem 0.4rem;
        border-radius: var(--radius-full);
        background: var(--color-error-container);
        color: var(--color-on-error-container);
        font-family: var(--font-sans);
      }
      .webhook-badge.active {
        background: var(--color-primary-container);
        color: var(--color-on-primary-container);
      }

      .chevron-icon {
        color: var(--color-outline-variant);
        transition: transform var(--duration-fast) var(--ease-default);
        flex-shrink: 0;
      }
      .chevron-icon.rotated { transform: rotate(180deg); }

      .right-header {
        display: flex;
        align-items: center;
        padding: 0.75rem 1.25rem 0.625rem;
        border-bottom: 1px solid var(--color-outline-variant);
        flex-shrink: 0;
      }

      /* ── Webhook form (compact, inside left panel) ─────────── */
      .webhook-form {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        padding: 0 1.25rem 1.25rem;
      }
      .wh-pad { padding: 0 1.25rem 1rem; }
      .form-section { display: flex; flex-direction: column; gap: 0.4rem; }
      .toggle-row { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.125rem 0; }
      .toggle-label { font-size: 0.875rem; font-weight: 400; color: var(--color-on-surface); font-family: var(--font-sans); }
      .section-label-small {
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-on-surface-variant);
        margin: 0;
        font-family: var(--font-sans);
      }
      .events-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.125rem; }
      .event-row { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; padding: 0.2rem 0; }
      .event-label { font-size: 0.8125rem; font-weight: 400; color: var(--color-on-surface); font-family: var(--font-sans); }
      .form-footer { display: flex; justify-content: flex-end; padding-top: 0.125rem; }

      /* ── QR state: centered ────────────────────────────────── */
      .qr-layout {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .qr-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-2xl);
        padding: 2rem 2.5rem;
      }

      /* ── Neutral / loading states ──────────────────────────── */
      .centered-state {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .status-card {
        border-radius: var(--radius-xl);
        padding: 1.5rem;
        border-left: 4px solid transparent;
      }
      .status-card.neutral {
        max-width: 28rem;
        background: var(--tui-background-neutral-1);
        border-left-color: var(--tui-border-normal);
      }

      /* ── Shared elements ───────────────────────────────────── */
      .status-header { display: flex; align-items: center; gap: 0.75rem; }
      .status-label { font-size: 1rem; font-weight: 400; font-family: var(--font-sans); }
      .qr-label { color: var(--color-method-patch); }
      .qr-hint { margin: 0; font-weight: 400; color: var(--tui-text-secondary); font-family: var(--font-sans); }
      .qr-image {
        max-width: 260px;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        padding: 1rem;
        background: white;
      }
      .loading-text { color: var(--tui-text-secondary); font-weight: 400; font-family: var(--font-sans); }
      .status-text { margin: 0; font-weight: 400; color: var(--tui-text-secondary); font-family: var(--font-sans); }
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
  readonly webhookOpen = signal(true);

  toggleWebhookOpen(): void {
    this.webhookOpen.update(v => !v);
  }

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

    // Load webhook config as soon as the instance name is available
    effect(() => {
      if (this.name() && !this.webhookConfig()) {
        void this.loadWebhookConfig();
      }
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
