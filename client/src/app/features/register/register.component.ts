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

type RegisterField = 'name' | 'email' | 'password' | 'appKey';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiLink, TuiError, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card">
      <h1 class="tui-text_h4">Register</h1>
      <p class="muted">You need a valid application key from the server administrator.</p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <tui-textfield>
          <label tuiLabel>Name</label>
          <input tuiTextfield type="text" formControlName="name" autocomplete="name" />
        </tui-textfield>
        <tui-error [error]="fieldError('name')" />
        <tui-textfield>
          <label tuiLabel>Email</label>
          <input tuiTextfield type="email" formControlName="email" autocomplete="email" />
        </tui-textfield>
        <tui-error [error]="fieldError('email')" />
        <tui-textfield>
          <label tuiLabel>Password</label>
          <input tuiTextfield type="password" formControlName="password" autocomplete="new-password" />
        </tui-textfield>
        <tui-error [error]="fieldError('password')" />
        <tui-textfield>
          <label tuiLabel>Application key</label>
          <input tuiTextfield type="password" formControlName="appKey" autocomplete="off" />
        </tui-textfield>
        <tui-error [error]="fieldError('appKey')" />
        <button tuiButton type="submit" size="m" [disabled]="submitting()">
          Create account
        </button>
      </form>
      <p class="footer">
        <a tuiLink routerLink="/login">Back to sign in</a>
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
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alerts = inject(TuiAlertService);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    appKey: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);

  showFieldError(control: AbstractControl | null): boolean {
    if (!control) {
      return false;
    }
    return control.invalid && (control.touched || this.submitted());
  }

  fieldError(name: RegisterField): string | null {
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
    if (control.hasError('minlength')) {
      const min = control.getError('minlength')?.requiredLength ?? 8;
      return `At least ${min} characters`;
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
    const v = this.form.getRawValue();
    try {
      await this.auth.register(v.name, v.email, v.password, v.appKey);
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      let msg = 'Registration failed';
      if (e instanceof HttpErrorResponse) {
        if (e.status === 403) {
          const code = e.error?.code;
          if (code === 'REGISTRATION_DISABLED') {
            msg = 'Registration is disabled';
          } else if (code === 'INVALID_APP_KEY') {
            msg = 'Invalid application key';
          } else {
            msg =
              (Array.isArray(e.error?.message)
                ? e.error.message.join(', ')
                : e.error?.message) || 'Registration failed';
          }
        } else if (e.status === 409) {
          msg = 'Email already registered';
        } else {
          msg =
            (Array.isArray(e.error?.message)
              ? e.error.message.join(', ')
              : e.error?.message) || msg;
        }
      }
      this.alerts
        .open(msg, { label: 'Registration', appearance: 'negative', autoClose: 6000 })
        .subscribe();
    } finally {
      this.submitting.set(false);
    }
  }
}
