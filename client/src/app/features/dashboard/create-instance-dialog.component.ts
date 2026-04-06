import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { injectContext } from '@taiga-ui/polymorpheus';

@Component({
  selector: 'app-create-instance-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="form">
      <tui-textfield>
        <label tuiLabel>Instance name</label>
        <input tuiTextfield type="text" formControlName="name" autocomplete="off" />
      </tui-textfield>
      <tui-textfield>
        <label tuiLabel>Webhook URL (optional)</label>
        <input tuiTextfield type="url" formControlName="webhook" autocomplete="off" />
      </tui-textfield>
      <tui-textfield>
        <label tuiLabel>Webhook headers JSON (optional)</label>
        <input tuiTextfield type="text" formControlName="webhookHeadersJson" autocomplete="off" />
      </tui-textfield>
      <label class="toggle-row">
        <input type="checkbox" [checked]="webhookEnabled()" (change)="webhookEnabled.set(!webhookEnabled())" />
        <span>Enable webhook</span>
      </label>
      <fieldset class="events-fieldset">
        <legend>Webhook events</legend>
        @for (ev of availableEvents; track ev) {
          <label class="event-check">
            <input type="checkbox" [checked]="webhookEvents().includes(ev)" (change)="toggleEvent(ev)" />
            <span>{{ ev }}</span>
          </label>
        }
      </fieldset>
      <div class="actions">
        <button tuiButton type="button" appearance="secondary" size="m" (click)="cancel()">
          Cancel
        </button>
        <button tuiButton type="submit" size="m" [disabled]="form.invalid || busy()">Create</button>
      </div>
    </form>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 18rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
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
        margin: 0;
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
