import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';

const PHONE_RE = /^55\d{11}$/; // 55 + 11 digits = 13 total (BR mobile)
const MAX_BODY = 4096;
const BODY_WARN = 3800;

type SendField = 'to' | 'body';

@Component({
  selector: 'app-send-message',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; font-family: var(--font-sans); }

    /* ── Composer card ──────────────────────────────────────── */
    .composer {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 1.25rem;
    }

    /* ── Field wrapper ──────────────────────────────────────── */
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 1rem;
    }
    .field:last-of-type { margin-bottom: 0; }

    /* ── Label ──────────────────────────────────────────────── */
    .field-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-on-surface-variant);
    }

    /* ── Input wrapper (icon + input) ───────────────────────── */
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 0.75rem;
      color: var(--color-on-surface-variant);
      pointer-events: none;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .input-suffix {
      position: absolute;
      right: 0.75rem;
      display: flex;
      align-items: center;
      pointer-events: none;
    }

    /* ── Text inputs ────────────────────────────────────────── */
    .text-input {
      width: 100%;
      padding: 0.625rem 0.75rem 0.625rem 2.375rem;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      color: var(--color-on-surface);
      transition:
        border-color var(--duration-fast) var(--ease-default),
        box-shadow var(--duration-fast) var(--ease-default);
      outline: none;
      box-sizing: border-box;
    }
    .text-input::placeholder { color: var(--color-on-surface-variant); opacity: 0.6; }
    .text-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }
    .text-input[aria-invalid="true"] {
      border-color: var(--color-error);
    }
    .text-input[aria-invalid="true"]:focus {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 15%, transparent);
    }
    /* When valid phone — make room for checkmark on right */
    .text-input.has-valid-suffix { padding-right: 2.375rem; }

    /* ── Textarea ───────────────────────────────────────────── */
    .textarea-input {
      width: 100%;
      padding: 0.625rem 0.75rem;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      color: var(--color-on-surface);
      resize: vertical;
      min-height: 140px;
      max-height: 320px;
      line-height: 1.55;
      transition:
        border-color var(--duration-fast) var(--ease-default),
        box-shadow var(--duration-fast) var(--ease-default);
      outline: none;
      box-sizing: border-box;
    }
    .textarea-input::placeholder { color: var(--color-on-surface-variant); opacity: 0.6; }
    .textarea-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }
    .textarea-input[aria-invalid="true"] { border-color: var(--color-error); }
    .textarea-input[aria-invalid="true"]:focus {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 15%, transparent);
    }

    /* ── Field hint ─────────────────────────────────────────── */
    .field-hint {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      margin: 0;
      line-height: 1.4;
    }

    /* ── Inline validation error ────────────────────────────── */
    .field-error {
      font-size: 0.75rem;
      color: var(--color-error);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* ── Character count ────────────────────────────────────── */
    .char-count-row {
      display: flex;
      justify-content: flex-end;
    }
    .char-count {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--color-on-surface-variant);
      font-feature-settings: "tnum";
      transition: color var(--duration-fast) var(--ease-default);
    }
    .char-count.warn { color: var(--color-method-patch, #d97706); }
    .char-count.limit { color: var(--color-error); }

    /* ── Valid phone checkmark ──────────────────────────────── */
    .check-icon {
      color: color-mix(in srgb, var(--color-primary) 80%, var(--color-on-surface));
    }

    /* ── Footer row: shortcut hint + send button ────────────── */
    .composer-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .shortcut-hint {
      font-size: 0.6875rem;
      color: var(--color-on-surface-variant);
      font-family: var(--font-sans);
      background: color-mix(in srgb, var(--color-on-surface) 6%, transparent);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-sm);
      padding: 0.125rem 0.375rem;
      white-space: nowrap;
    }

    /* ── Send button ────────────────────────────────────────── */
    .send-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5625rem 1.25rem;
      background: var(--color-primary);
      color: var(--color-on-primary);
      border: none;
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: opacity var(--duration-fast) var(--ease-default);
      white-space: nowrap;
    }
    .send-btn:hover:not(:disabled) { opacity: 0.88; }
    .send-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Spinner (pure CSS) ─────────────────────────────────── */
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid color-mix(in srgb, var(--color-on-primary) 35%, transparent);
      border-top-color: var(--color-on-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="composer" aria-label="Compositor de mensagem">

      <!-- Recipient field -->
      <div class="field">
        <label class="field-label" for="send-to">Destinatário</label>
        <div class="input-wrap">
          <!-- User icon -->
          <span class="input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
            </svg>
          </span>
          <input
            id="send-to"
            type="text"
            inputmode="numeric"
            formControlName="to"
            class="text-input"
            [class.has-valid-suffix]="isPhoneValid()"
            placeholder="55 11 99999-9999"
            autocomplete="off"
            [attr.aria-invalid]="showFieldError('to') || null"
            aria-describedby="send-to-hint send-to-error"
          />
          <!-- Valid checkmark -->
          @if (isPhoneValid()) {
            <span class="input-suffix check-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </span>
          }
        </div>
        <p id="send-to-hint" class="field-hint">Código do país + DDD + número — ex: 5511999999999</p>
        @if (showFieldError('to')) {
          <p id="send-to-error" class="field-error" role="alert">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4.5zm0 7a.875.875 0 110-1.75.875.875 0 010 1.75z"/>
            </svg>
            {{ fieldError('to') }}
          </p>
        }
      </div>

      <!-- Message body field -->
      <div class="field">
        <div class="input-wrap">
          <textarea
            id="send-body"
            formControlName="body"
            class="textarea-input"
            placeholder="Escreva sua mensagem…"
            [attr.maxlength]="maxBody"
            [attr.aria-invalid]="showFieldError('body') || null"
            aria-describedby="send-body-error"
            aria-label="Mensagem"
          ></textarea>
        </div>
        <div class="char-count-row">
          <span
            class="char-count"
            [class.warn]="bodyLength() > bodyWarn && bodyLength() < maxBody"
            [class.limit]="bodyLength() >= maxBody"
            aria-live="polite"
            [attr.aria-label]="bodyLength() + ' de ' + maxBody + ' caracteres'"
          >{{ bodyLength() }} / {{ maxBody }}</span>
        </div>
        @if (showFieldError('body')) {
          <p id="send-body-error" class="field-error" role="alert">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4.5zm0 7a.875.875 0 110-1.75.875.875 0 010 1.75z"/>
            </svg>
            {{ fieldError('body') }}
          </p>
        }
      </div>

      <!-- Footer: shortcut hint + send button -->
      <div class="composer-footer">
        <span class="shortcut-hint" aria-label="Atalho: Command ou Control + Enter para enviar">⌘↵</span>
        <button
          type="submit"
          class="send-btn"
          [disabled]="sending() || form.invalid"
          aria-label="Enviar mensagem"
          [attr.aria-busy]="sending()"
        >
          @if (sending()) {
            <span class="spinner" aria-hidden="true"></span>
            Enviando…
          } @else {
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
            </svg>
            Enviar
          }
        </button>
      </div>

    </form>
  `,
})
export class SendMessageComponent {
  readonly instanceName = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiAlertService);

  readonly maxBody = MAX_BODY;
  readonly bodyWarn = BODY_WARN;

  readonly form = this.fb.nonNullable.group({
    to: ['', [Validators.required, Validators.pattern(PHONE_RE)]],
    body: ['', [Validators.required, Validators.maxLength(MAX_BODY)]],
  });

  readonly sending = signal(false);
  readonly submitted = signal(false);

  readonly bodyLength = computed(() => this.form.controls.body.value.length);

  readonly isPhoneValid = computed(() => {
    const ctrl = this.form.controls.to;
    return ctrl.valid && PHONE_RE.test(ctrl.value);
  });

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void this.submit();
    }
  }

  showFieldError(name: SendField): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  fieldError(name: SendField): string | null {
    if (!this.showFieldError(name)) return null;
    const control = this.form.controls[name];
    if (control.hasError('required')) return 'Campo obrigatório';
    if (control.hasError('pattern')) return 'Formato inválido — use: 5511999999999';
    if (control.hasError('maxlength')) return `Limite de ${MAX_BODY} caracteres atingido`;
    return 'Valor inválido';
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;

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
        .open('Mensagem enviada com sucesso.', { label: 'Sucesso', appearance: 'positive', autoClose: 4000 })
        .subscribe();
      this.form.patchValue({ body: '' });
      this.submitted.set(false);
    } catch {
      // interceptor shows error toast
    } finally {
      this.sending.set(false);
    }
  }
}
