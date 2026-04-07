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
import { TuiAlertService } from '@taiga-ui/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { TuiTextarea } from '@taiga-ui/kit/components/textarea';

type SendField = 'to' | 'body';

@Component({
  selector: 'app-send-message',
  standalone: true,
  imports: [ReactiveFormsModule, TuiTextarea, TuiError, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="form">
      <tui-textfield>
        <label tuiLabel>Para (número WhatsApp)</label>
        <input tuiTextfield type="text" formControlName="to" placeholder="5511999999999" />
      </tui-textfield>
      <tui-error [error]="fieldError('to')" />
      <tui-textfield>
        <label tuiLabel>Mensagem</label>
        <textarea tuiTextarea rows="4" formControlName="body"></textarea>
      </tui-textfield>
      <tui-error [error]="fieldError('body')" />
      <button type="submit" [disabled]="sending()"
              style="display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.25rem; background: var(--color-primary); color: var(--color-on-primary); border: none; border-radius: var(--radius-lg); font-family: 'Figtree', sans-serif; font-weight: 200; cursor: pointer; transition: opacity var(--duration-fast) var(--ease-default); margin-top: 0.5rem;">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
        </svg>
        {{ sending() ? 'Enviando…' : 'Enviar mensagem' }}
      </button>
    </form>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        max-width: 28rem;
        padding: 1.5rem;
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
      return 'Obrigatório';
    }
    return 'Valor inválido';
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
        .open('Mensagem enviada.', { label: 'Sucesso', appearance: 'positive', autoClose: 4000 })
        .subscribe();
      this.form.patchValue({ body: '' });
    } catch {
      // interceptor shows error
    } finally {
      this.sending.set(false);
    }
  }
}
