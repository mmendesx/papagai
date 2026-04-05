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
    const body: { name: string; webhook?: string; webhookHeaders?: Record<string, string> } = {
      name,
    };
    if (webhook.trim()) {
      body.webhook = webhook.trim();
    }
    if (webhookHeaders) {
      body.webhookHeaders = webhookHeaders;
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
