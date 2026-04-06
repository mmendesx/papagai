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
    <div class="min-h-screen flex items-center justify-center px-4"
         style="background: var(--papagai-gradient-page)">
      <div class="w-full max-w-md mx-4 p-8 rounded-2xl shadow-2xl"
           style="background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.9)">

        <h1 class="text-3xl text-center mb-8"
            style="font-weight: 300; background: var(--papagai-gradient-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text">
          Papagai
        </h1>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
          <div>
            <tui-textfield>
              <label tuiLabel>Nome</label>
              <input tuiTextfield type="text" formControlName="name" autocomplete="name" />
            </tui-textfield>
            <tui-error [error]="fieldError('name')" />
          </div>

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
              <input tuiTextfield type="password" formControlName="password" autocomplete="new-password" />
            </tui-textfield>
            <tui-error [error]="fieldError('password')" />
          </div>

          <div>
            <tui-textfield>
              <label tuiLabel>Chave de aplicação</label>
              <input tuiTextfield type="password" formControlName="appKey" autocomplete="off" />
            </tui-textfield>
            <tui-error [error]="fieldError('appKey')" />
          </div>

          <button
            type="submit"
            [disabled]="submitting()"
            class="w-full py-3 px-6 rounded-xl text-white transition-all duration-200 hover:opacity-90 active:scale-95 mt-2"
            style="background: var(--papagai-gradient-button); border: none; cursor: pointer; font-family: 'Lexend', sans-serif; font-size: 0.9rem; font-weight: 300; letter-spacing: 0.025em;">
            {{ submitting() ? 'Criando conta\u2026' : 'Criar conta' }}
          </button>
        </form>

        <p class="text-center mt-6 text-sm" style="font-weight: 200; color: var(--tui-text-secondary)">
          Já tem conta?
          <a tuiLink routerLink="/login">Entrar</a>
        </p>
      </div>
    </div>
  `,
  styles: [],
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
