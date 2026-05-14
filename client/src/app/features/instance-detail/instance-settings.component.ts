import { HttpClient, HttpContext } from '@angular/common/http';
import { SUPPRESS_ERROR_ALERT } from '../../core/http/suppress-error-alert.context';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  animate,
  query,
  stagger,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { TuiConfirmService } from '@taiga-ui/kit/components/confirm';
import { TuiCheckbox } from '@taiga-ui/kit/components/checkbox';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { HeaderActionsService } from '../../shared/header-actions.service';
import { InstanceTabsComponent } from './instance-tabs.component';

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
  selector: 'app-instance-settings',
  standalone: true,
  imports: [
    InstanceTabsComponent,
    FormsModule,
    TuiButton,
    TuiCheckbox,
    TuiSwitch,
    ...TuiTextfield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('expandCollapse', [
      state('open', style({ height: '*', opacity: 1, overflow: 'hidden' })),
      state('closed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
      transition('open <=> closed', animate('250ms cubic-bezier(0, 0, 0.2, 1)')),
    ]),
    trigger('staggerSections', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger('80ms', [animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))])
        ], { optional: true })
      ])
    ]),
    trigger('slideInRight', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(16px)' }),
        animate('250ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
  ],
  template: `
    <!-- Unified tab bar -->
    @if (name(); as n) {
      <app-instance-tabs
        [instanceName]="n"
        [connected]="status()?.connected ?? null"
      />
    }

    <div class="settings-body" [@staggerSections]>

      <!-- Webhook section -->
      <section class="settings-section" aria-labelledby="webhook-heading" [@fadeInUp]>
        <div class="section-header">
          <h2 class="section-heading" id="webhook-heading">Webhook</h2>
          <span class="webhook-badge" [class.webhook-badge--active]="whEnabled()">
            {{ whEnabled() ? 'ativo' : 'inativo' }}
          </span>
        </div>
        <p class="section-desc">Configure a URL e os eventos que serão enviados para o seu servidor.</p>

        @if (webhookLoading()) {
          <p class="loading-text">Carregando configurações…</p>
        }

        <form class="webhook-form app-form" (ngSubmit)="saveWebhook()" aria-label="Formulário de webhook"
              [@expandCollapse]="webhookLoading() ? 'closed' : 'open'">
          <label class="toggle-row">
            <input tuiSwitch type="checkbox"
              [ngModel]="whEnabled()"
              (ngModelChange)="whEnabled.set($event)"
              [ngModelOptions]="{ standalone: true }"
              id="webhook-enabled" />
            <span class="toggle-label" id="webhook-enabled-label">Ativar webhook</span>
          </label>

          <div class="field-group">
            <tui-textfield>
              <label tuiLabel>URL</label>
              <input tuiTextfield type="url"
                [ngModel]="whUrl()"
                (ngModelChange)="whUrl.set($event)"
                [ngModelOptions]="{ standalone: true }"
                autocomplete="off"
                placeholder="https://example.com/webhook" />
            </tui-textfield>
          </div>

          <div class="field-group">
            <tui-textfield>
              <label tuiLabel>Cabeçalhos (JSON)</label>
              <input tuiTextfield type="text"
                [ngModel]="whHeadersJson()"
                (ngModelChange)="whHeadersJson.set($event)"
                [ngModelOptions]="{ standalone: true }"
                autocomplete="off"
                placeholder="{}" />
            </tui-textfield>
          </div>

          <fieldset class="events-fieldset">
            <legend class="events-legend app-form__section-title">Eventos</legend>
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
          </fieldset>

          <div class="form-footer app-form__actions">
            <button tuiButton type="submit" size="s" appearance="primary"
                    [disabled]="webhookSaving()">
              {{ webhookSaving() ? 'Salvando…' : 'Salvar configurações' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Danger zone -->
      <section class="settings-section danger-section" aria-labelledby="danger-heading" [@fadeInUp]>
        <div class="section-header">
          <h2 class="section-heading danger-heading" id="danger-heading">Zona de risco</h2>
        </div>
        <p class="section-desc">Ações irreversíveis. Prossiga com cautela.</p>
        <div class="danger-action">
          <div class="danger-action-body">
            <span class="danger-action-title">Excluir instância</span>
            <span class="danger-action-desc">Remove permanentemente esta instância e todos os seus dados.</span>
          </div>
          <button type="button" class="delete-btn" (click)="confirmDelete()">
            Excluir instância
          </button>
        </div>
      </section>

    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        font-family: var(--font-sans);
      }

      /* ── Settings body ─────────────────────────────────────── */
      .settings-body {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 1.5rem;
        max-width: 42rem;
        width: 100%;
      }

      /* ── Section card ──────────────────────────────────────── */
      .settings-section {
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .section-header {
        display: flex;
        align-items: center;
        gap: 0.625rem;
      }
      .section-heading {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-on-surface);
        margin: 0;
      }
      .section-desc {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
        line-height: 1.5;
      }

      /* ── Webhook badge ─────────────────────────────────────── */
      .webhook-badge {
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.1875rem 0.5rem;
        border-radius: var(--radius-full);
        background: var(--color-error-container);
        color: var(--color-on-error-container);
      }
      .webhook-badge--active {
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        color: color-mix(in srgb, var(--color-primary) 80%, var(--color-on-surface));
        border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-outline-variant));
      }

      /* ── Webhook form ──────────────────────────────────────── */
      .webhook-form {
        gap: 1rem;
      }
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
      }
      .toggle-label {
        font-size: 0.875rem;
        font-weight: 400;
        color: var(--color-on-surface);
      }
      .field-group { display: flex; flex-direction: column; }

      .events-fieldset {
        border: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .events-legend {
        color: var(--color-on-surface-variant);
        margin-bottom: 0.25rem;
        float: left;
        width: 100%;
      }
      .events-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
      }
      .event-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.25rem 0;
      }
      .event-label {
        font-size: 0.8125rem;
        color: var(--color-on-surface);
      }
      .form-footer {
        padding-top: 0.25rem;
        margin-top: 0;
      }
      .loading-text { color: var(--tui-text-secondary); font-size: 0.875rem; }

      /* ── Danger zone ───────────────────────────────────────── */
      .danger-section {
        border-color: color-mix(in srgb, var(--color-error) 20%, var(--color-outline-variant));
      }
      .danger-heading { color: var(--color-error); }
      .danger-action {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: color-mix(in srgb, var(--color-error) 4%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-error) 15%, var(--color-outline-variant));
        border-radius: var(--radius-lg);
      }
      .danger-action-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .danger-action-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .danger-action-desc {
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
      .delete-btn {
        flex-shrink: 0;
        padding: 0.5rem 1rem;
        background: var(--color-error-bg, transparent);
        color: var(--color-error);
        border: 1px solid color-mix(in srgb, var(--color-error) 30%, var(--color-outline-variant));
        border-radius: var(--radius-lg);
        font-size: 0.875rem;
        font-weight: 500;
        font-family: var(--font-sans);
        cursor: pointer;
        transition:
          background var(--duration-fast) var(--ease-default),
          border-color var(--duration-fast) var(--ease-default);
        white-space: nowrap;
      }
      .delete-btn:hover {
        background: var(--color-error-container);
        border-color: var(--color-error);
      }
      .delete-btn:focus-visible {
        outline: 2px solid var(--color-error);
        outline-offset: 2px;
      }
    `,
  ],
})
export class InstanceSettingsComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(TuiConfirmService);
  private readonly alerts = inject(TuiAlertService);

  readonly name = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('name'))),
    { initialValue: null as string | null },
  );

  readonly status = signal<StatusResponse | null>(null);
  readonly webhookConfig = signal<WebhookConfig | null>(null);
  readonly webhookLoading = signal(false);
  readonly webhookSaving = signal(false);

  readonly whUrl = signal('');
  readonly whHeadersJson = signal('{}');
  readonly whEnabled = signal(false);
  readonly whEvents = signal<string[]>([]);

  readonly availableEvents = ['message', 'message_update', 'qr', 'connected', 'disconnected'];

  private static readonly EVENT_LABELS: Record<string, string> = {
    message:        'Mensagem',
    message_update: 'Atualização de mensagem',
    qr:             'QR Code',
    connected:      'Conectado',
    disconnected:   'Desconectado',
  };

  translateEvent(event: string): string {
    return InstanceSettingsComponent.EVENT_LABELS[event] ?? event;
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

    // Load status for the breadcrumb pill
    this.route.paramMap
      .pipe(
        map((p) => p.get('name')),
        takeUntilDestroyed(),
      )
      .subscribe((instanceName) => {
        if (!instanceName) return;
        void firstValueFrom(
          this.http.get<StatusResponse>(
            `/api/instances/${encodeURIComponent(instanceName)}/status`,
            { context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true) },
          ),
        )
          .then((s) => this.status.set(s))
          .catch(() => this.status.set(null));
      });

    // Load webhook config
    effect(() => {
      if (this.name() && !this.webhookConfig()) {
        void this.loadWebhookConfig();
      }
    });
  }

  async loadWebhookConfig(): Promise<void> {
    const n = this.name();
    if (!n) return;
    this.webhookLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<StatusResponse>(
          `/api/instances/${encodeURIComponent(n)}/status`,
          { context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true) },
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
