import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService, TuiButton } from '@taiga-ui/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiLink } from '@taiga-ui/core/components/link';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { AuthService } from '../../core/auth/auth.service';

type LoginField = 'email' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiLink, TuiError, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card">
      <h1 class="tui-text_h4">Sign in</h1>
      <p class="muted">Papagai dashboard</p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <tui-textfield>
          <label tuiLabel>Email</label>
          <input tuiTextfield type="email" formControlName="email" autocomplete="email" />
        </tui-textfield>
        <tui-error [error]="fieldError('email')" />
        <tui-textfield>
          <label tuiLabel>Password</label>
          <input tuiTextfield type="password" formControlName="password" autocomplete="current-password" />
        </tui-textfield>
        <tui-error [error]="fieldError('password')" />
        <button tuiButton type="submit" size="m" [disabled]="submitting()">
          Sign in
        </button>
      </form>
      <p class="footer">
        <a tuiLink routerLink="/register">Create an account</a>
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        min-height: 100vh;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .auth-card {
        width: 100%;
        max-width: 22rem;
        padding: 2rem;
        border-radius: var(--tui-radius-l);
        background: var(--tui-background-elevation-1);
        box-shadow: var(--tui-shadow-dropdown);
      }
      .muted {
        color: var(--tui-text-secondary);
        margin: 0 0 1.5rem;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .footer {
        margin-top: 1.25rem;
        text-align: center;
      }
    `,
  ],
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
      return 'Required';
    }
    if (control.hasError('email')) {
      return 'Invalid email';
    }
    return 'Invalid value';
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
              : e.error?.message) || 'Invalid email or password'
          : 'Invalid email or password';
      this.alerts
        .open(msg, { label: 'Login failed', appearance: 'negative', autoClose: 6000 })
        .subscribe();
    } finally {
      this.submitting.set(false);
    }
  }
}
