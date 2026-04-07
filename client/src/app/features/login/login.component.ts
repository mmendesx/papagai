import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiLink } from '@taiga-ui/core/components/link';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { AuthService } from '../../core/auth/auth.service';

type LoginField = 'email' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiLink, TuiError, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center px-4"
         style="background: var(--color-surface)">
      <div class="w-full max-w-md p-8"
           style="background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); box-shadow: var(--shadow-lg); border-radius: var(--radius-2xl)">

        <h1 class="text-3xl text-center mb-8"
            style="font-weight: 300; color: var(--color-on-surface)">
          Papagai
        </h1>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
          <div>
            <tui-textfield>
              <label tuiLabel>E-mail</label>
              <input tuiTextfield type="email" formControlName="email" autocomplete="email" />
            </tui-textfield>
            <tui-error [error]="fieldError('email')" />
          </div>

          <div>
            <tui-textfield>
              <label tuiLabel>Senha</label>
              <input tuiTextfield type="password" formControlName="password" autocomplete="current-password" />
            </tui-textfield>
            <tui-error [error]="fieldError('password')" />
          </div>

          <button
            type="submit"
            [disabled]="submitting()"
            class="w-full py-3 px-6 rounded-xl text-white transition-all duration-200 hover:opacity-90 active:scale-95 mt-2"
            style="background: var(--color-primary); color: var(--color-on-primary); border: none; cursor: pointer; font-family: 'Figtree', sans-serif; font-size: 0.9rem; font-weight: 300; letter-spacing: 0.025em; border-radius: var(--radius-lg)">
            {{ submitting() ? 'Entrando\u2026' : 'Entrar' }}
          </button>
        </form>

        <p class="text-center mt-6 text-sm" style="font-weight: 200; color: var(--tui-text-secondary)">
          Não tem conta?
          <a tuiLink routerLink="/register">Registrar</a>
        </p>
      </div>
    </div>
  `,
  styles: [],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alerts = inject(TuiAlertService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);

  showFieldError(control: AbstractControl | null): boolean {
    if (!control) {
      return false;
    }
    return control.invalid && (control.touched || this.submitted());
  }

  fieldError(name: LoginField): string | null {
    const control = this.form.controls[name];
    if (!this.showFieldError(control)) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Campo obrigatório';
    }
    if (control.hasError('email')) {
      return 'E-mail inválido';
    }
    return 'Valor inválido';
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse
          ? (Array.isArray(e.error?.message)
              ? e.error.message.join(', ')
              : e.error?.message) || 'E-mail ou senha inválidos'
          : 'E-mail ou senha inválidos';
      this.alerts
        .open(msg, { label: 'Falha no login', appearance: 'negative', autoClose: 6000 })
        .subscribe();
    } finally {
      this.submitting.set(false);
    }
  }
}
