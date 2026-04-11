import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { LucideAngularModule, User, Mail, Shield, Palette, Globe, Key, Lock } from 'lucide-angular';
import { TuiAlertService } from '@taiga-ui/core';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { getAvatarColor } from '../../shared/avatar-colors';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('pageEntry', [
      transition(':enter', [
        query('.profile-section, .profile-hero', [
          style({ opacity: 0, transform: 'translateY(16px)' }),
          stagger('80ms', [animate('350ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))]),
        ], { optional: true }),
      ]),
    ]),
    trigger('avatarPop', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
  styles: [`
    :host {
      display: block;
      padding: 2rem 1.5rem 4rem;
    }

    .profile-page {
      max-width: 640px;
      margin: 0 auto;
    }

    /* Hero */
    .profile-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2.5rem 1.5rem 2rem;
      margin-bottom: 1.5rem;
      border-radius: var(--radius-xl);
      background: var(--color-surface-container-lowest);
      border: 1px solid var(--color-outline-variant);
      position: relative;
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at 50% -20%, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 70%);
      pointer-events: none;
    }

    .avatar-ring {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      padding: 3px;
      background: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 50%, var(--color-secondary)));
      margin-bottom: 1rem;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .avatar-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      font-family: var(--font-display);
      letter-spacing: -0.02em;
      border: 2px solid var(--color-surface-container-lowest);
    }

    .hero-name {
      font-size: 1.375rem;
      font-weight: 700;
      font-family: var(--font-display);
      color: var(--color-on-surface);
      margin: 0 0 0.25rem;
      position: relative;
      z-index: 1;
    }

    .hero-email {
      font-size: 0.875rem;
      color: var(--color-on-surface-variant);
      margin: 0 0 0.625rem;
      position: relative;
      z-index: 1;
    }

    .hero-member-since {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      position: relative;
      z-index: 1;
    }

    /* Sections */
    .profile-section {
      background: var(--color-surface-container-lowest);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-xl);
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-outline-variant);
    }

    .section-icon {
      width: 2rem;
      height: 2rem;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--color-on-surface);
      font-family: var(--font-display);
      margin: 0;
    }

    /* Info rows */
    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--color-outline-variant);
    }

    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .info-row:first-of-type {
      padding-top: 0;
    }

    .info-label {
      font-size: 0.8125rem;
      color: var(--color-on-surface-variant);
      font-weight: 400;
    }

    .info-value {
      font-size: 0.875rem;
      color: var(--color-on-surface);
      font-weight: 600;
      text-align: right;
      max-width: 60%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lang-value {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-on-surface);
    }

    .info-value.muted {
      color: var(--color-on-surface-variant);
      font-weight: 400;
      font-size: 0.8125rem;
    }

    /* Theme toggle */
    .theme-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--color-outline-variant);
    }

    .theme-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .pref-label-group {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .pref-label {
      font-size: 0.875rem;
      color: var(--color-on-surface);
      font-weight: 500;
    }

    .pref-sublabel {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
    }

    /* Toggle switch */
    .toggle-switch {
      position: relative;
      width: 44px;
      height: 24px;
      cursor: pointer;
      flex-shrink: 0;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    .toggle-track {
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      background: var(--color-outline-variant);
      transition: background var(--duration-fast) var(--ease-default);
    }

    .toggle-switch input:checked + .toggle-track {
      background: var(--color-primary);
    }

    .toggle-thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      transition: transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .toggle-switch input:checked ~ .toggle-thumb {
      transform: translateX(20px);
    }

    /* Security button */
    .security-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-outline-variant);
      background: transparent;
      color: var(--color-on-surface);
      font-size: 0.875rem;
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
    }

    .security-btn:hover {
      background: var(--color-surface-container-low);
      border-color: var(--color-outline);
    }

    .security-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--color-outline-variant);
    }

    .security-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .session-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent);
    }

    .session-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      flex-shrink: 0;
    }

    @media (max-width: 480px) {
      :host { padding: 1rem 1rem 3rem; }
      .profile-hero { padding: 2rem 1rem 1.5rem; }
      .profile-section { padding: 1.25rem 1rem; }
      .info-value { max-width: 55%; font-size: 0.8125rem; }
    }
  `],
  template: `
    <div class="profile-page" @pageEntry>
      <!-- Hero -->
      <div class="profile-hero">
        <div class="hero-bg" aria-hidden="true"></div>

        <div class="avatar-ring" @avatarPop>
          <div
            class="avatar-inner"
            [style.background]="avatarStyle().bg"
            [style.color]="avatarStyle().text"
            aria-hidden="true"
          >{{ initials() }}</div>
        </div>

        <h1 class="hero-name" @fadeInUp>{{ user()?.name }}</h1>
        <p class="hero-email" @fadeInUp>{{ user()?.email }}</p>
        <span class="hero-member-since" @fadeInUp>Membro desde {{ memberSince }}</span>
      </div>

      <!-- Account section -->
      <section class="profile-section" aria-labelledby="account-title">
        <div class="section-header">
          <div class="section-icon" aria-hidden="true">
            <lucide-icon [img]="icons.User" [size]="16" />
          </div>
          <h2 class="section-title" id="account-title">Conta</h2>
        </div>

        <div class="info-row">
          <span class="info-label">Nome</span>
          <span class="info-value">{{ user()?.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">E-mail</span>
          <span class="info-value">{{ user()?.email }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Chave de acesso</span>
          <span class="info-value muted">Gerenciado pelo servidor</span>
        </div>
      </section>

      <!-- Preferences section -->
      <section class="profile-section" aria-labelledby="prefs-title">
        <div class="section-header">
          <div class="section-icon" aria-hidden="true">
            <lucide-icon [img]="icons.Palette" [size]="16" />
          </div>
          <h2 class="section-title" id="prefs-title">Preferências</h2>
        </div>

        <div class="theme-row">
          <div class="pref-label-group">
            <span class="pref-label">Tema escuro</span>
            <span class="pref-sublabel">{{ theme.isDark() ? 'Ativado' : 'Desativado' }}</span>
          </div>
          <label class="toggle-switch" [title]="theme.isDark() ? 'Desativar tema escuro' : 'Ativar tema escuro'">
            <input
              type="checkbox"
              [checked]="theme.isDark()"
              (change)="theme.toggle()"
              [attr.aria-label]="theme.isDark() ? 'Desativar tema escuro' : 'Ativar tema escuro'"
            />
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </label>
        </div>

        <div class="theme-row">
          <div class="pref-label-group">
            <span class="pref-label">Idioma</span>
            <span class="pref-sublabel">Interface do sistema</span>
          </div>
          <div class="lang-value">
            <lucide-icon [img]="icons.Globe" [size]="14" aria-hidden="true" />
            Português (BR)
          </div>
        </div>
      </section>

      <!-- Security section -->
      <section class="profile-section" aria-labelledby="security-title">
        <div class="section-header">
          <div class="section-icon" aria-hidden="true">
            <lucide-icon [img]="icons.Shield" [size]="16" />
          </div>
          <h2 class="section-title" id="security-title">Segurança</h2>
        </div>

        <div class="security-row">
          <div class="pref-label-group">
            <span class="pref-label">Senha</span>
            <span class="pref-sublabel">Altere sua senha de acesso</span>
          </div>
          <button
            type="button"
            class="security-btn"
            (click)="showPasswordComingSoon()"
            aria-label="Alterar senha"
          >
            <lucide-icon [img]="icons.Lock" [size]="14" aria-hidden="true" />
            Alterar senha
          </button>
        </div>

        <div class="security-row">
          <div class="pref-label-group">
            <span class="pref-label">Sessao atual</span>
            <span class="pref-sublabel">Autenticado neste dispositivo</span>
          </div>
          <div class="session-badge">
            <span class="session-dot" aria-hidden="true"></span>
            Ativa
          </div>
        </div>
      </section>
    </div>
  `,
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly alerts = inject(TuiAlertService);

  protected readonly icons = { User, Mail, Shield, Palette, Globe, Key, Lock };

  readonly user = this.auth.currentUser;

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  });

  readonly avatarStyle = computed(() => getAvatarColor(this.user()?.name ?? ''));

  readonly memberSince = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  showPasswordComingSoon(): void {
    this.alerts
      .open('A alteracao de senha estara disponivel em breve.', {
        label: 'Em breve',
        appearance: 'info',
        autoClose: 4000,
      })
      .subscribe();
  }
}
