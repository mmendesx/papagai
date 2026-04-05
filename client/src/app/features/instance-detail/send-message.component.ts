import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { TuiTextarea } from '@taiga-ui/kit/components/textarea';

type SendField = 'to' | 'body';

@Component({
  selector: 'app-send-message',
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TuiTextarea, TuiError, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="form">
      <tui-textfield>
        <label tuiLabel>To (WhatsApp number)</label>
        <input tuiTextfield type="text" formControlName="to" placeholder="5511999999999" />
      </tui-textfield>
      <tui-error [error]="fieldError('to')" />
      <tui-textfield>
        <label tuiLabel>Message</label>
        <textarea tuiTextarea rows="4" formControlName="body"></textarea>
      </tui-textfield>
      <tui-error [error]="fieldError('body')" />
      <button tuiButton type="submit" size="m" [disabled]="sending()">Send</button>
    </form>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 28rem;
      }
    `,
  ],
})
export class SendMessageComponent {
  readonly instanceName = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiAlertService);

  readonly form = this.fb.nonNullable.group({
    to: ['', Validators.required],
    body: ['', Validators.required],
  });

  readonly sending = signal(false);
  readonly submitted = signal(false);

  showFieldError(control: AbstractControl | null): boolean {
    if (!control) {
      return false;
    }
    return control.invalid && (control.touched || this.submitted());
  }

  fieldError(name: SendField): string | null {
    const control = this.form.controls[name];
    if (!this.showFieldError(control)) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Required';
    }
    return 'Invalid value';
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.sending.set(true);
    const { to, body } = this.form.getRawValue();
    const url = `/api/instances/${encodeURIComponent(this.instanceName())}/messages`;
    try {
      await firstValueFrom(
        this.http.post(url, {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      );
      this.alerts
        .open('Message sent.', { label: 'Success', appearance: 'positive', autoClose: 4000 })
        .subscribe();
      this.form.patchValue({ body: '' });
    } catch {
      // interceptor shows error
    } finally {
      this.sending.set(false);
    }
  }
}
