import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [ReactiveFormsModule, FormsModule, ...TuiTextfield, TuiSwitch, TuiCheckbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-dialog">

      <h2 class="app-dialog__title">Criar instância</h2>

      <form [formGroup]="form" (ngSubmit)="submit()" class="app-form">

        <div class="app-form__section">
          <h4 class="app-form__section-title">Informações básicas</h4>
          <tui-textfield>
            <label tuiLabel>Nome da instância</label>
            <input tuiTextfield type="text" formControlName="name" autocomplete="off" />
          </tui-textfield>
        </div>

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
                <input tuiTextfield type="url" formControlName="webhook" autocomplete="off" />
              </tui-textfield>
            </div>

            <div>
              <tui-textfield>
                <label tuiLabel>Headers do Webhook (JSON)</label>
                <input tuiTextfield type="text" formControlName="webhookHeadersJson" autocomplete="off" />
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
          >Cancelar</button>
          <button
            type="submit"
            [disabled]="form.invalid || busy()"
            class="app-btn app-btn--primary"
          >
            @if (busy()) { Criando… } @else { Criar }
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
    `,
  ],
})
export class CreateInstanceDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiAlertService);
  readonly context = injectContext<TuiDialogContext<string | void>>();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
    webhook: [''],
    webhookHeadersJson: [''],
  });

  readonly busy = signal(false);
  readonly webhookEnabled = signal(true);
  readonly webhookEvents = signal<string[]>(['message', 'message_update', 'qr', 'connected', 'disconnected']);
  readonly availableEvents = ['message', 'message_update', 'qr', 'connected', 'disconnected'];

  toggleEvent(event: string): void {
    const current = this.webhookEvents();
    if (current.includes(event)) {
      this.webhookEvents.set(current.filter(e => e !== event));
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
    const { name, webhook, webhookHeadersJson } = this.form.getRawValue();
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
      webhook?: string;
      webhookHeaders?: Record<string, string>;
      webhookEnabled?: boolean;
      webhookEvents?: string[];
    } = { name };
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
