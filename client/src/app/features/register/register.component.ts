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

type RegisterField = 'name' | 'email' | 'password' | 'appKey';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiLink, TuiError, ...TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-layout">
      <!-- Brand panel (left) -->
      <div class="brand-panel" aria-hidden="true">
        <div class="brand-inner">
          <div class="brand-logo">
            <img src="/parrot.png" alt="" />
          </div>
          <div class="brand-wordmark">PAPAGAI</div>
          <p class="brand-tagline">Crie sua conta e comece agora</p>
          <ul class="brand-features">
            <li>Conecte múltiplos números WhatsApp</li>
            <li>Configure webhooks por instância</li>
            <li>Envie e receba mensagens via API</li>
          </ul>
        </div>
      </div>

      <!-- Form panel (right) -->
      <div class="form-panel">
        <div class="form-inner">
          <!-- Mobile-only logo -->
          <div class="mobile-logo" aria-hidden="true">
            <img src="/parrot.png" alt="" />
          </div>

          <h1 class="form-title">Criar conta</h1>
          <p class="form-subtitle">Preencha os dados para se registrar</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
            <div class="field-group">
              <tui-textfield>
                <label tuiLabel>Nome</label>
                <input tuiTextfield type="text" formControlName="name" autocomplete="name" />
              </tui-textfield>
              <tui-error [error]="fieldError('name')" />
            </div>

            <div class="field-group">
              <tui-textfield>
                <label tuiLabel>E-mail</label>
                <input tuiTextfield type="email" formControlName="email" autocomplete="email" />
              </tui-textfield>
              <tui-error [error]="fieldError('email')" />
            </div>

            <div class="field-group">
              <tui-textfield>
                <label tuiLabel>Senha</label>
                <input tuiTextfield type="password" formControlName="password" autocomplete="new-password" />
              </tui-textfield>
              <tui-error [error]="fieldError('password')" />
            </div>

            <div class="field-group">
              <tui-textfield>
                <label tuiLabel>Chave de aplicação</label>
                <input tuiTextfield type="password" formControlName="appKey" autocomplete="off" />
              </tui-textfield>
              <tui-error [error]="fieldError('appKey')" />
            </div>

            <button type="submit" class="submit-btn" [disabled]="submitting()">
              {{ submitting() ? 'Criando conta…' : 'Criar conta' }}
            </button>
          </form>

          <p class="form-footer">
            Já tem conta?
            <a tuiLink routerLink="/login">Entrar</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }

    .auth-layout {
      display: flex;
      height: 100%;
    }

    /* ── Brand panel ───────────────────────────────── */
    .brand-panel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #006a2d 0%, #004d20 60%, #003015 100%);
      padding: 3rem 2.5rem;
      position: relative;
      overflow: hidden;
    }

    .brand-panel::before {
      content: '';
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(107,255,143,0.12) 0%, transparent 70%);
      top: -100px;
      right: -100px;
      pointer-events: none;
    }

    .brand-inner {
      position: relative;
      z-index: 1;
      max-width: 360px;
    }

    .brand-logo {
      width: 72px;
      height: 72px;
      background: rgba(255,255,255,0.12);
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
      padding: 10px;
      backdrop-filter: blur(4px);
    }
    .brand-logo img { width: 100%; height: 100%; display: block; }

    .brand-wordmark {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: 0.14em;
      color: #ffffff;
      margin-bottom: 0.5rem;
    }

    .brand-tagline {
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      font-weight: 400;
      color: rgba(255,255,255,0.72);
      margin: 0 0 2rem;
      line-height: 1.5;
    }

    .brand-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .brand-features li {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 400;
      color: rgba(255,255,255,0.80);
      padding-left: 1.25rem;
      position: relative;
      line-height: 1.4;
    }
    .brand-features li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #6bff8f;
      font-weight: 700;
    }

    /* ── Form panel ────────────────────────────────── */
    .form-panel {
      width: 480px;
      min-width: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-container-lowest);
      border-left: 1px solid var(--color-outline-variant);
      padding: 2rem;
      overflow-y: auto;
    }

    .form-inner {
      width: 100%;
      max-width: 360px;
    }

    .mobile-logo { display: none; }

    .form-title {
      font-family: var(--font-display);
      font-size: 1.625rem;
      font-weight: 700;
      color: var(--color-on-surface);
      margin: 0 0 0.375rem;
    }

    .form-subtitle {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
      margin: 0 0 2rem;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .field-group {
      display: flex;
      flex-direction: column;
    }

    .submit-btn {
      width: 100%;
      padding: 0.75rem 1.5rem;
      margin-top: 0.5rem;
      background: var(--color-primary);
      color: var(--color-on-primary);
      border: none;
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity var(--duration-fast) var(--ease-default);
      letter-spacing: 0.02em;
    }
    .submit-btn:hover:not(:disabled) { opacity: 0.88; }
    .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .form-footer {
      margin-top: 1.5rem;
      text-align: center;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
    }

    /* ── Mobile ────────────────────────────────────── */
    @media (max-width: 767px) {
      .brand-panel { display: none; }
      .form-panel {
        width: 100%;
        min-width: unset;
        border-left: none;
        background: var(--color-surface);
        align-items: flex-start;
        padding-top: 3rem;
      }
      .form-inner { max-width: 100%; }
      .mobile-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.5rem;
      }
      .mobile-logo img {
        width: 56px;
        height: 56px;
      }
    }
  `],
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
      return 'Campo obrigatório';
    }
    if (control.hasError('email')) {
      return 'E-mail inválido';
    }
    if (control.hasError('minlength')) {
      const min = control.getError('minlength')?.requiredLength ?? 8;
      return `Mínimo ${min} caracteres`;
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
    const v = this.form.getRawValue();
    try {
      await this.auth.register(v.name, v.email, v.password, v.appKey);
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      let msg = 'Falha no registro';
      if (e instanceof HttpErrorResponse) {
        if (e.status === 403) {
          const code = e.error?.code;
          if (code === 'REGISTRATION_DISABLED') {
            msg = 'Registro desabilitado';
          } else if (code === 'INVALID_APP_KEY') {
            msg = 'Chave de aplicação inválida';
          } else {
            msg =
              (Array.isArray(e.error?.message)
                ? e.error.message.join(', ')
                : e.error?.message) || 'Falha no registro';
          }
        } else if (e.status === 409) {
          msg = 'E-mail já cadastrado';
        } else {
          msg =
            (Array.isArray(e.error?.message)
              ? e.error.message.join(', ')
              : e.error?.message) || msg;
        }
      }
      this.alerts
        .open(msg, { label: 'Registro', appearance: 'negative', autoClose: 6000 })
        .subscribe();
    } finally {
      this.submitting.set(false);
    }
  }
}
