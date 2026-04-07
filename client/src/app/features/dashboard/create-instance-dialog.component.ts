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
    <div style="padding: 1.5rem; min-width: 400px; max-width: 500px;">

      <!-- Header -->
      <h2 style="
        font-size: 1.25rem;
        font-weight: 300;
        margin: 0 0 1.5rem;
        font-family: 'Figtree', sans-serif;
        color: var(--tui-text-primary);
      ">Criar instância</h2>

      <form [formGroup]="form" (ngSubmit)="submit()">

        <!-- Section 1: Basic info -->
        <div style="margin-bottom: 1.5rem;">
          <h4 class="section-label">Informações básicas</h4>
          <tui-textfield>
            <label tuiLabel>Nome da instância</label>
            <input tuiTextfield type="text" formControlName="name" autocomplete="off" />
          </tui-textfield>
        </div>

        <!-- Section 2: Webhook -->
        <div style="
          border-top: 1px solid var(--color-outline-variant);
          padding-top: 1rem;
          margin-bottom: 1.5rem;
        ">
          <h4 class="section-label">Webhook</h4>

          <!-- Enable toggle -->
          <label style="
            display: flex;
            align-items: center;
            gap: 0.75rem;
            cursor: pointer;
            padding: 0.25rem 0 0.75rem;
          ">
            <input
              tuiSwitch
              type="checkbox"
              [ngModel]="webhookEnabled()"
              (ngModelChange)="webhookEnabled.set($event)"
              [ngModelOptions]="{ standalone: true }"
            />
            <span style="font-weight: 300; font-family: 'Figtree', sans-serif;">Ativar webhook</span>
          </label>

          @if (webhookEnabled()) {
            <!-- Webhook URL -->
            <div style="margin-bottom: 0.75rem;">
              <tui-textfield>
                <label tuiLabel>URL do Webhook</label>
                <input tuiTextfield type="url" formControlName="webhook" autocomplete="off" />
              </tui-textfield>
            </div>

            <!-- Webhook headers -->
            <div style="margin-bottom: 0.5rem;">
              <tui-textfield>
                <label tuiLabel>Headers do Webhook (JSON)</label>
                <input tuiTextfield type="text" formControlName="webhookHeadersJson" autocomplete="off" />
              </tui-textfield>
            </div>

            <!-- Events subsection -->
            <div style="
              border-top: 1px solid var(--color-outline-variant);
              padding-top: 0.75rem;
              margin-top: 0.75rem;
            ">
              <h5 class="section-label" style="font-size: 0.7rem; margin-bottom: 0.5rem;">Eventos</h5>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                @for (ev of availableEvents; track ev) {
                  <label style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    padding: 0.25rem 0;
                  ">
                    <input
                      tuiCheckbox
                      type="checkbox"
                      [ngModel]="webhookEvents().includes(ev)"
                      (ngModelChange)="toggleEvent(ev)"
                      [ngModelOptions]="{ standalone: true }"
                    />
                    <span style="
                      font-size: 0.8125rem;
                      font-weight: 300;
                      font-family: 'Figtree', sans-serif;
                      color: var(--tui-text-primary);
                    ">{{ ev }}</span>
                  </label>
                }
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button
            type="button"
            (click)="cancel()"
            class="cancel-btn"
          >Cancelar</button>
          <button
            type="submit"
            [disabled]="form.invalid || busy()"
            class="gradient-btn"
          >
            @if (busy()) { Criando… } @else { Criar }
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [
    `
      .section-label {
        font-size: 0.75rem;
        font-weight: 300;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--tui-text-secondary);
        margin: 0 0 0.75rem;
        font-family: 'Figtree', sans-serif;
      }

      .cancel-btn {
        padding: 0.5rem 1.25rem;
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-outline-variant);
        background: transparent;
        font-family: 'Figtree', sans-serif;
        font-weight: 200;
        font-size: 0.875rem;
        cursor: pointer;
        color: var(--color-on-surface);
        transition: border-color var(--duration-fast) var(--ease-default);
      }

      .cancel-btn:hover {
        border-color: var(--color-outline);
      }

      .gradient-btn {
        padding: 0.5rem 1.25rem;
        border-radius: var(--radius-lg);
        border: none;
        background: var(--color-primary);
        color: var(--color-on-primary);
        font-family: 'Figtree', sans-serif;
        font-weight: 200;
        font-size: 0.875rem;
        cursor: pointer;
        transition: opacity var(--duration-fast) var(--ease-default);
      }

      .gradient-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .gradient-btn:not(:disabled):hover {
        opacity: 0.9;
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
