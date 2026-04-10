import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
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
          <h2 class="brand-headline">Sua empresa no WhatsApp, no controle.</h2>
          <p class="brand-tagline">Conecte sistemas, gerencie múltiplos números e automatize conversas com uma API production-grade.</p>

          <div class="feature-grid">
            <div class="feature-card">
              <span class="feature-icon" aria-hidden="true">📱</span>
              <div class="feature-text">
                <strong class="feature-title">Multi-instância</strong>
                <span class="feature-desc">Gerencie vários números de WhatsApp em um só lugar.</span>
              </div>
            </div>
            <div class="feature-card">
              <span class="feature-icon" aria-hidden="true">⚡</span>
              <div class="feature-text">
                <strong class="feature-title">API Completa</strong>
                <span class="feature-desc">Envie texto, mídia e mensagens interativas via REST.</span>
              </div>
            </div>
            <div class="feature-card">
              <span class="feature-icon" aria-hidden="true">🔔</span>
              <div class="feature-text">
                <strong class="feature-title">Webhooks em Tempo Real</strong>
                <span class="feature-desc">Receba eventos instantâneos para cada mensagem e status.</span>
              </div>
            </div>
            <div class="feature-card">
              <span class="feature-icon" aria-hidden="true">🔄</span>
              <div class="feature-text">
                <strong class="feature-title">Reconexão Automática</strong>
                <span class="feature-desc">Sessões persistentes que se recuperam sem intervenção.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form panel (right) -->
      <div class="form-panel">
        <div class="form-inner">
          <h1 class="form-title">Criar conta</h1>
          <p class="form-subtitle">Comece agora. Leva menos de um minuto.</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
            <div class="field-group">
              <tui-textfield>
                <label tuiLabel>Nome</label>
                <input
                  #nameInput
                  tuiTextfield
                  type="text"
                  formControlName="name"
                  autocomplete="name"
                />
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

    /* ── Keyframes ─────────────────────────────────────── */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.85); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes floatOrb {
      0%   { transform: translateY(0)     scale(1); }
      50%  { transform: translateY(-40px) scale(1.08); }
      100% { transform: translateY(0)     scale(1); }
    }

    @keyframes floatOrbAlt {
      0%   { transform: translateY(0)    scale(1); }
      50%  { transform: translateY(32px) scale(0.94); }
      100% { transform: translateY(0)    scale(1); }
    }

    /* ── Layout ────────────────────────────────────────── */
    .auth-layout {
      display: flex;
      height: 100%;
    }

    /* ── Brand panel ───────────────────────────────────── */
    .brand-panel {
      flex: 0 0 60%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%);
      padding: var(--space-12) var(--space-10);
      position: relative;
      overflow: hidden;
    }

    /* Floating orb — cyan */
    .brand-panel::before {
      content: '';
      position: absolute;
      width: 480px;
      height: 480px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(8,145,178,0.35) 0%, transparent 70%);
      filter: blur(80px);
      top: -80px;
      right: -80px;
      pointer-events: none;
      z-index: 0;
      animation: floatOrb 10s var(--ease-default) infinite;
    }

    /* Floating orb — tangerine */
    .brand-panel::after {
      content: '';
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(234,88,12,0.25) 0%, transparent 70%);
      filter: blur(80px);
      bottom: -60px;
      left: -60px;
      pointer-events: none;
      z-index: 0;
      animation: floatOrbAlt 12s var(--ease-default) infinite;
    }

    [data-theme="dark"] .brand-panel {
      background: linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%);
    }

    .brand-inner {
      position: relative;
      z-index: 1;
      max-width: 420px;
      width: 100%;
    }

    /* ── Logo ──────────────────────────────────────────── */
    .brand-logo {
      width: 88px;
      height: 88px;
      background: rgba(255,255,255,0.12);
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-6);
      padding: 12px;
      backdrop-filter: blur(4px);
      box-shadow: 0 0 32px rgba(96,165,250,0.35);
      opacity: 0;
      animation: scaleIn 400ms var(--ease-spring) 0ms forwards;
    }
    .brand-logo img { width: 100%; height: 100%; display: block; object-fit: contain; }

    /* ── Wordmark ──────────────────────────────────────── */
    .brand-wordmark {
      font-family: var(--font-brand);
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #ffffff;
      margin-bottom: var(--space-4);
      opacity: 0;
      animation: fadeInUp 350ms var(--ease-out) 80ms forwards;
    }

    /* ── Headline ──────────────────────────────────────── */
    .brand-headline {
      font-family: var(--font-display);
      font-size: 2.25rem;
      font-weight: 900;
      color: #fff;
      line-height: 1.15;
      margin: 0 0 var(--space-3);
      opacity: 0;
      animation: fadeInUp 350ms var(--ease-out) 160ms forwards;
    }

    /* ── Tagline ───────────────────────────────────────── */
    .brand-tagline {
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      font-weight: 400;
      color: rgba(255,255,255,0.72);
      margin: 0 0 var(--space-8);
      line-height: 1.5;
      opacity: 0;
      animation: fadeInUp 350ms var(--ease-out) 240ms forwards;
    }

    /* ── Feature grid ──────────────────────────────────── */
    .feature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .feature-card {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-lg);
      padding: var(--space-3) var(--space-4);
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      opacity: 0;
    }
    .feature-card:nth-child(1) { animation: fadeInUp 300ms var(--ease-out) 350ms forwards; }
    .feature-card:nth-child(2) { animation: fadeInUp 300ms var(--ease-out) 450ms forwards; }
    .feature-card:nth-child(3) { animation: fadeInUp 300ms var(--ease-out) 550ms forwards; }
    .feature-card:nth-child(4) { animation: fadeInUp 300ms var(--ease-out) 650ms forwards; }

    .feature-icon {
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .feature-text {
      display: flex;
      flex-direction: column;
    }

    .feature-title {
      font-family: var(--font-display);
      font-size: 0.8125rem;
      font-weight: 700;
      color: #fff;
      display: block;
      margin-bottom: 0.2rem;
    }

    .feature-desc {
      font-family: var(--font-sans);
      font-size: 0.75rem;
      color: rgba(255,255,255,0.72);
      line-height: 1.4;
    }

    /* ── Form panel ────────────────────────────────────── */
    .form-panel {
      flex: 0 0 40%;
      min-width: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-container-lowest);
      border-left: 1px solid var(--color-outline-variant);
      padding: var(--space-8);
      overflow-y: auto;
    }

    .form-inner {
      width: 100%;
      max-width: 360px;
      opacity: 0;
      animation: fadeInUp 450ms var(--ease-out) 300ms forwards;
    }

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

    /* ── Submit button ─────────────────────────────────── */
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
      letter-spacing: 0.02em;
      transition:
        transform var(--duration-fast) var(--ease-spring),
        box-shadow var(--duration-fast) var(--ease-default),
        opacity var(--duration-fast) var(--ease-default);
    }
    .submit-btn:hover:not(:disabled) {
      transform: scale(1.02);
      box-shadow: 0 4px 16px rgba(37,99,235,0.35);
      opacity: 1;
    }
    .submit-btn:active:not(:disabled) { transform: scale(0.98); }
    .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    /* ── Form footer ───────────────────────────────────── */
    .form-footer {
      margin-top: 1.5rem;
      text-align: center;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
    }

    /* ── Tablet (768–1024px) ───────────────────────────── */
    @media (min-width: 768px) and (max-width: 1023px) {
      .brand-panel { flex: 0 0 55%; }
      .form-panel  { flex: 0 0 45%; min-width: unset; }
      .brand-headline { font-size: 1.75rem; }
    }

    /* ── Mobile (<768px) ───────────────────────────────── */
    @media (max-width: 767px) {
      .auth-layout { flex-direction: column; }

      .brand-panel {
        flex: none;
        width: 100%;
        height: 80px;
        min-height: 80px;
        padding: 0 var(--space-6);
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: var(--space-4);
      }

      .brand-inner {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--space-4);
        max-width: 100%;
      }

      .brand-logo {
        width: 40px;
        height: 40px;
        margin-bottom: 0;
        box-shadow: none;
        padding: 6px;
        animation: none;
        opacity: 1;
      }

      .brand-wordmark {
        font-size: 1.25rem;
        margin-bottom: 0;
        animation: none;
        opacity: 1;
      }

      .brand-tagline,
      .feature-grid,
      .brand-headline { display: none; }

      .form-panel {
        flex: 1;
        width: 100%;
        min-width: unset;
        border-left: none;
        padding: var(--space-8) var(--space-6);
      }

      .form-inner { max-width: 100%; }
    }

    /* ── Reduced motion ────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .brand-panel::before,
      .brand-panel::after {
        animation-play-state: paused;
      }

      .brand-logo,
      .brand-wordmark,
      .brand-headline,
      .brand-tagline,
      .feature-card,
      .form-inner {
        animation: none;
        opacity: 1;
        transform: none;
      }
    }
  `],
})
export class RegisterComponent implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alerts = inject(TuiAlertService);

  @ViewChild('nameInput') nameInputRef!: ElementRef<HTMLInputElement>;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    appKey: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);

  ngAfterViewInit(): void {
    setTimeout(() => this.nameInputRef?.nativeElement.focus(), 850);
  }

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
