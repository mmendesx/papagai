import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { NgxFlickeringGridComponent } from '@omnedia/ngx-flickering-grid';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiLink } from '@taiga-ui/core/components/link';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { animate, keyframes, state, style, transition, trigger } from '@angular/animations';
import { AuthService } from '../../core/auth/auth.service';

type RegisterField = 'name' | 'email' | 'password' | 'appKey';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TuiLink, TuiError, ...TuiTextfield, NgxFlickeringGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('350ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.85)' }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
    trigger('shake', [
      state('idle', style({ transform: 'translateX(0)' })),
      state('shaking', style({ transform: 'translateX(0)' })),
      transition('idle => shaking', animate('300ms', keyframes([
        style({ transform: 'translateX(0)', offset: 0 }),
        style({ transform: 'translateX(-8px)', offset: 0.2 }),
        style({ transform: 'translateX(8px)', offset: 0.4 }),
        style({ transform: 'translateX(-5px)', offset: 0.6 }),
        style({ transform: 'translateX(5px)', offset: 0.8 }),
        style({ transform: 'translateX(0)', offset: 1 }),
      ]))),
      transition('shaking => idle', animate('0ms')),
    ]),
  ],
  template: `
    <div class="auth-layout">
      <!-- Brand panel (left) -->
      <div class="brand-panel" aria-hidden="true">
        <div class="grid-bg">
          <om-flickering-grid
            styleClass="auth-flicker"
            [squareSize]="4"
            [gridGap]="6"
            [flickerChance]="0.3"
            color="rgb(255, 255, 255)"
            [maxOpacity]="0.15"
          />
        </div>
        <div class="brand-inner">
          <div class="brand-identity">
            <div class="brand-logo" [@scaleIn]>
              <img src="/parrot.png" alt="" />
            </div>
            <div class="brand-wordmark" [@fadeInUp]>Papagai</div>
          </div>
          <h2 class="brand-headline" [@fadeInUp]>Sua empresa no WhatsApp, no controle.</h2>
          <p class="brand-tagline" [@fadeInUp]>Conecte sistemas, gerencie múltiplos números e automatize conversas com uma API production-grade.</p>

          <div class="feature-grid">
            <div class="feature-card" [style.animation-delay]="'350ms'">
              <span class="feature-icon" aria-hidden="true">📱</span>
              <div class="feature-text">
                <strong class="feature-title">Multi-instância</strong>
                <span class="feature-desc">Gerencie vários números de WhatsApp em um só lugar.</span>
              </div>
            </div>
            <div class="feature-card" [style.animation-delay]="'450ms'">
              <span class="feature-icon" aria-hidden="true">⚡</span>
              <div class="feature-text">
                <strong class="feature-title">API Completa</strong>
                <span class="feature-desc">Envie texto, mídia e mensagens interativas via REST.</span>
              </div>
            </div>
            <div class="feature-card" [style.animation-delay]="'550ms'">
              <span class="feature-icon" aria-hidden="true">🔔</span>
              <div class="feature-text">
                <strong class="feature-title">Webhooks em Tempo Real</strong>
                <span class="feature-desc">Receba eventos instantâneos para cada mensagem e status.</span>
              </div>
            </div>
            <div class="feature-card" [style.animation-delay]="'650ms'">
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
        <div class="form-inner" [@fadeInUp]>
          <h1 class="form-title">Criar conta</h1>
          <p class="form-subtitle">Comece agora. Leva menos de um minuto.</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
            <div class="field-group" [@shake]="shakeName() ? 'shaking' : 'idle'">
              <tui-textfield size="s">
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

            <div class="field-group" [@shake]="shakeEmail() ? 'shaking' : 'idle'">
              <tui-textfield size="s">
                <label tuiLabel>E-mail</label>
                <input tuiTextfield type="email" formControlName="email" autocomplete="email" />
              </tui-textfield>
              <tui-error [error]="fieldError('email')" />
            </div>

            <div class="field-group" [@shake]="shakePassword() ? 'shaking' : 'idle'">
              <tui-textfield size="s">
                <label tuiLabel>Senha</label>
                <input tuiTextfield type="password" formControlName="password" autocomplete="new-password" />
              </tui-textfield>
              <tui-error [error]="fieldError('password')" />
            </div>

            <div class="field-group" [@shake]="shakeAppKey() ? 'shaking' : 'idle'">
              <tui-textfield size="s">
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

    [data-theme="dark"] .brand-panel {
      background: linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%);
    }

    .brand-inner {
      position: relative;
      z-index: 2;
      max-width: 420px;
      width: 100%;
    }

    /* ── Brand identity (logo + wordmark inline) ──────── */
    .brand-identity {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    /* ── Logo ──────────────────────────────────────────── */
    .brand-logo {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-logo img { width: 100%; height: 100%; display: block; object-fit: contain; }

    /* ── Wordmark ──────────────────────────────────────── */
    .brand-wordmark {
      font-family: 'Cookie', cursive;
      font-size: 3rem;
      font-weight: 400;
      color: #ffffff;
      margin-bottom: 0;
    }

    /* ── Headline ──────────────────────────────────────── */
    .brand-headline {
      font-family: var(--font-display);
      font-size: 2.25rem;
      font-weight: 900;
      color: #fff;
      line-height: 1.15;
      margin: 0 0 var(--space-3);
    }

    /* ── Tagline ───────────────────────────────────────── */
    .brand-tagline {
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      font-weight: 400;
      color: rgba(255,255,255,0.72);
      margin: 0 0 var(--space-8);
      line-height: 1.5;
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
      animation: fadeInUp 300ms var(--ease-out) both;
    }

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

      .brand-identity {
        margin-bottom: 0;
      }

      .brand-logo {
        width: 36px;
        height: 36px;
      }

      .brand-wordmark {
        font-size: 1.75rem;
        margin-bottom: 0;
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

    /* ── Flickering grid ───────────────────────────────── */
    .grid-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }

    .grid-bg om-flickering-grid {
      display: block;
      height: 100%;
      width: 100%;
    }

    /* ── Reduced motion ────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .feature-card {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .grid-bg { display: none; }
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
  readonly shakeName = signal(false);
  readonly shakeEmail = signal(false);
  readonly shakePassword = signal(false);
  readonly shakeAppKey = signal(false);

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
      const shakeAndReset = (sig: ReturnType<typeof signal<boolean>>) => {
        sig.set(true);
        setTimeout(() => sig.set(false), 400);
      };
      if (this.form.get('name')?.invalid) shakeAndReset(this.shakeName);
      if (this.form.get('email')?.invalid) shakeAndReset(this.shakeEmail);
      if (this.form.get('password')?.invalid) shakeAndReset(this.shakePassword);
      if (this.form.get('appKey')?.invalid) shakeAndReset(this.shakeAppKey);
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
