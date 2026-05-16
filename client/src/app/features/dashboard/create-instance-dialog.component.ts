import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
import { TuiCheckbox } from '@taiga-ui/kit/components/checkbox';

@Component({
  selector: 'app-create-instance-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ...TuiTextfield,
    TuiSwitch,
    TuiCheckbox,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-dialog">
      <h2 class="app-dialog__title">Criar instância</h2>

      <form [formGroup]="form" (ngSubmit)="submit()" class="app-form">
        <div class="app-form__section">
          <h4 class="app-form__section-title">Informações básicas</h4>
          <tui-textfield>
            <label tuiLabel>Nome da instância</label>
            <input
              tuiTextfield
              type="text"
              formControlName="name"
              autocomplete="off"
            />
          </tui-textfield>

          <label class="provider-field">
            <span class="provider-label">Provedor</span>
            <select class="provider-select" formControlName="provider">
              <option value="web">WhatsApp account (web)</option>
              <option value="wba">WhatsApp Business API</option>
            </select>
          </label>
        </div>

        @if (form.controls.provider.value === 'wba') {
          <div class="app-form__section app-form__section--split">
            <h4 class="app-form__section-title">WhatsApp Business API</h4>
            <p class="wba-note">
              Papagai stores WBA messages only when sent through Papagai or
              delivered by Meta webhooks.
            </p>
            <tui-textfield>
              <label tuiLabel>Business Account ID</label>
              <input
                tuiTextfield
                type="text"
                formControlName="wbaBusinessAccountId"
                autocomplete="off"
              />
            </tui-textfield>
            <tui-textfield>
              <label tuiLabel>Phone Number ID</label>
              <input
                tuiTextfield
                type="text"
                formControlName="wbaPhoneNumberId"
                autocomplete="off"
              />
            </tui-textfield>
            <tui-textfield>
              <label tuiLabel>Display Phone Number</label>
              <input
                tuiTextfield
                type="text"
                formControlName="wbaDisplayPhoneNumber"
                autocomplete="off"
              />
            </tui-textfield>
            <tui-textfield>
              <label tuiLabel>Access Token</label>
              <input
                tuiTextfield
                type="password"
                formControlName="wbaAccessToken"
                autocomplete="off"
              />
            </tui-textfield>
            <tui-textfield>
              <label tuiLabel>App Secret (optional)</label>
              <input
                tuiTextfield
                type="password"
                formControlName="wbaAppSecret"
                autocomplete="off"
              />
            </tui-textfield>
            <tui-textfield>
              <label tuiLabel>Webhook Verify Token (optional)</label>
              <input
                tuiTextfield
                type="text"
                formControlName="wbaWebhookVerifyToken"
                autocomplete="off"
              />
            </tui-textfield>
          </div>
        }

        <div class="app-form__section app-form__section--split">
          <h4 class="app-form__section-title">Webhook</h4>

          <label class="toggle-row">
            <input
              tuiSwitch
              type="checkbox"
              [ngModel]="webhookEnabled()"
              (ngModelChange)="webhookEnabled.set($event)"
              [ngModelOptions]="{ standalone: true }"
            />
            <span class="toggle-label">Ativar webhook</span>
          </label>

          @if (webhookEnabled()) {
            <div>
              <tui-textfield>
                <label tuiLabel>URL do Webhook</label>
                <input
                  tuiTextfield
                  type="url"
                  formControlName="webhook"
                  autocomplete="off"
                />
              </tui-textfield>
            </div>

            <div>
              <tui-textfield>
                <label tuiLabel>Headers do Webhook (JSON)</label>
                <input
                  tuiTextfield
                  type="text"
                  formControlName="webhookHeadersJson"
                  autocomplete="off"
                />
              </tui-textfield>
            </div>

            <div class="events-section">
              <h5 class="app-form__section-title">Eventos</h5>
              <div class="events-grid">
                @for (ev of availableEvents; track ev) {
                  <label class="event-row">
                    <input
                      tuiCheckbox
                      type="checkbox"
                      [ngModel]="webhookEvents().includes(ev)"
                      (ngModelChange)="toggleEvent(ev)"
                      [ngModelOptions]="{ standalone: true }"
                    />
                    <span class="event-label">{{ ev }}</span>
                  </label>
                }
              </div>
            </div>
          }
        </div>

        <div class="app-form__actions">
          <button
            type="button"
            (click)="cancel()"
            class="app-btn app-btn--secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            [disabled]="form.invalid || busy()"
            class="app-btn app-btn--primary"
          >
            @if (busy()) {
              Criando…
            } @else {
              Criar
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .app-form__section--split {
        border-top: 1px solid var(--color-outline-variant);
        padding-top: 1rem;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
      }

      .toggle-label {
        font: 500 0.875rem/1.2 var(--font-sans);
        color: var(--color-on-surface);
      }

      .events-section {
        border-top: 1px solid var(--color-outline-variant);
        padding-top: 0.75rem;
      }

      .events-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .event-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.25rem 0;
      }

      .event-label {
        font: 400 0.8125rem/1.2 var(--font-sans);
        color: var(--color-on-surface);
      }

      .provider-field {
        display: grid;
        gap: 0.35rem;
      }

      .provider-label {
        font: 500 0.875rem/1.2 var(--font-sans);
        color: var(--color-on-surface);
      }

      .provider-select {
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-md);
        padding: 0.5rem 0.625rem;
        background: var(--color-surface);
      }

      .wba-note {
        margin: 0;
        font: 400 0.8125rem/1.4 var(--font-sans);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
export class CreateInstanceDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiAlertService);
  readonly context = injectContext<TuiDialogContext<string | void>>();

  readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
    ],
    provider: ['web' as 'web' | 'wba', Validators.required],
    webhook: [''],
    webhookHeadersJson: [''],
    wbaBusinessAccountId: [''],
    wbaPhoneNumberId: [''],
    wbaDisplayPhoneNumber: [''],
    wbaAccessToken: [''],
    wbaAppSecret: [''],
    wbaWebhookVerifyToken: [''],
  });

  readonly busy = signal(false);
  readonly webhookEnabled = signal(true);
  readonly webhookEvents = signal<string[]>([
    'message',
    'message_update',
    'qr',
    'connected',
    'disconnected',
  ]);
  readonly availableEvents = [
    'message',
    'message_update',
    'qr',
    'connected',
    'disconnected',
  ];

  toggleEvent(event: string): void {
    const current = this.webhookEvents();
    if (current.includes(event)) {
      this.webhookEvents.set(current.filter((e) => e !== event));
    } else {
      this.webhookEvents.set([...current, event]);
    }
  }

  cancel(): void {
    this.context.completeWith();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    this.busy.set(true);
    const {
      name,
      provider,
      webhook,
      webhookHeadersJson,
      wbaBusinessAccountId,
      wbaPhoneNumberId,
      wbaDisplayPhoneNumber,
      wbaAccessToken,
      wbaAppSecret,
      wbaWebhookVerifyToken,
    } = this.form.getRawValue();
    let webhookHeaders: Record<string, string> | undefined;
    const raw = webhookHeadersJson.trim();
    if (raw) {
      try {
        webhookHeaders = JSON.parse(raw) as Record<string, string>;
      } catch {
        this.busy.set(false);
        this.alerts
          .open('Webhook headers must be valid JSON object.', {
            label: 'Invalid JSON',
            appearance: 'negative',
            autoClose: 5000,
          })
          .subscribe();
        return;
      }
    }
    const body: {
      name: string;
      provider: 'web' | 'wba';
      webhook?: string;
      webhookHeaders?: Record<string, string>;
      webhookEnabled?: boolean;
      webhookEvents?: string[];
      wba?: {
        businessAccountId: string;
        phoneNumberId: string;
        displayPhoneNumber: string;
        accessToken: string;
        appSecret?: string;
        webhookVerifyToken?: string;
      };
    } = { name, provider };
    if (provider === 'wba') {
      body.wba = {
        businessAccountId: wbaBusinessAccountId.trim(),
        phoneNumberId: wbaPhoneNumberId.trim(),
        displayPhoneNumber: wbaDisplayPhoneNumber.trim(),
        accessToken: wbaAccessToken.trim(),
      };
      if (wbaAppSecret.trim()) {
        body.wba.appSecret = wbaAppSecret.trim();
      }
      if (wbaWebhookVerifyToken.trim()) {
        body.wba.webhookVerifyToken = wbaWebhookVerifyToken.trim();
      }
    }
    if (webhook.trim()) {
      body.webhook = webhook.trim();
    }
    if (webhookHeaders) {
      body.webhookHeaders = webhookHeaders;
    }
    if (webhook.trim()) {
      body.webhookEnabled = this.webhookEnabled();
      body.webhookEvents = this.webhookEvents();
    }
    try {
      await firstValueFrom(this.http.post('/api/instances/create', body));
      this.context.completeWith(name);
    } catch (e) {
      void e;
    } finally {
      this.busy.set(false);
    }
  }
}
