import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ResourceStatus,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { httpResource } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { TuiDataList } from '@taiga-ui/core/components/data-list';
import { TuiSelect } from '@taiga-ui/kit/components/select';
import { injectContext } from '@taiga-ui/polymorpheus';
import {
  ApiKeyPermissionTemplate,
  ApiKeysService,
  ApiKeyRecord,
} from '../../core/services/api-keys.service';
import { firstValueFrom } from 'rxjs';

export type CreateApiKeyResult = ApiKeyRecord | void;

export type CreateApiKeyDialogData = {
  scope: 'account' | 'instance';
  instanceName?: string;
};

interface InstanceRow {
  name: string;
  connected: boolean;
  phoneNumber: string | null;
}

interface InstancesListResponse {
  instances: InstanceRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Component({
  selector: 'app-create-api-key-dialog',
  standalone: true,
  imports: [FormsModule, ...TuiTextfield, ...TuiDataList, ...TuiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="padding: 1.5rem; min-width: 400px; max-width: 500px;">

      @if (!createdKey()) {

        <!-- ── Form step ─────────────────────────────────── -->
        <h2 style="
          font-size: 1.25rem;
          font-weight: 300;
          margin: 0 0 1.5rem;
          font-family: 'Figtree', sans-serif;
          color: var(--tui-text-primary);
        ">Nova chave API</h2>

        <div style="display: flex; flex-direction: column; gap: 1rem;">

          <!-- Name -->
          <tui-textfield>
            <label tuiLabel>Nome da chave</label>
            <input
              tuiTextfield
              type="text"
              [(ngModel)]="keyName"
              [ngModelOptions]="{ standalone: true }"
              autocomplete="off"
              placeholder="ex: Integração Zapier"
            />
          </tui-textfield>

          <!-- Scope -->
          <div>
            <p class="field-label">Escopo</p>
            <div style="display: flex; gap: 0.75rem;">
              <label class="scope-option" [class.scope-option--active]="scope() === 'account'" (click)="scope.set('account')">
                <span class="scope-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                  </svg>
                </span>
                <span style="font-size: 0.8125rem;">Conta</span>
              </label>
              <label
                class="scope-option"
                [class.scope-option--active]="scope() === 'instance'"
                [class.scope-option--disabled]="instancesDisabled()"
                [attr.aria-disabled]="instancesDisabled() ? 'true' : null"
                (click)="!instancesDisabled() && scope.set('instance')"
              >
                <span class="scope-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <path stroke-linecap="round" d="M14 17.5h7M17.5 14v7"/>
                  </svg>
                </span>
                <span style="font-size: 0.8125rem;">Instância</span>
              </label>
            </div>
          </div>

          <!-- Permission template (account scope) -->
          @if (scope() === 'account') {
            @if (templatesRes.isLoading()) {
              <div class="ec-skeleton" style="height: 2.5rem; border-radius: var(--radius-md);"></div>
            } @else if (templatesRes.status() === ResourceStatus.Error) {
              <p class="instance-msg instance-msg--error">Erro ao carregar templates de permissao</p>
            } @else if (templatesRes.value().templates.length === 0) {
              <p class="instance-msg">Nenhum template disponivel. A chave sera criada com acesso total.</p>
            } @else {
              <tui-textfield>
                <label tuiLabel>Template de permissao</label>
                <input
                  tuiTextfield
                  tuiSelect
                  placeholder="Selecione um template"
                  [(ngModel)]="selectedTemplateIdModel"
                  [ngModelOptions]="{ standalone: true }"
                />
                <tui-data-list>
                  @for (template of templatesRes.value().templates; track template.id) {
                    <button tuiOption new [value]="template.id" type="button">
                      {{ template.name }}
                    </button>
                  }
                </tui-data-list>
              </tui-textfield>

              @if (selectedTemplate(); as template) {
                <p class="template-hint">{{ template.description }}</p>
              }
            }
          }

          <!-- Instance dropdown (conditional) -->
          @if (scope() === 'instance') {
            @if (instancesRes.isLoading()) {
              <div class="ec-skeleton" style="height: 2.5rem; border-radius: var(--radius-md);"></div>
            } @else if (instancesRes.status() === ResourceStatus.Error) {
              <p class="instance-msg instance-msg--error">Erro ao carregar instâncias</p>
            } @else if (instancesRes.value().instances.length === 0) {
              <p class="instance-msg">Nenhuma instância disponível</p>
            } @else {
              <tui-textfield>
                <label tuiLabel>Instância</label>
                <input
                  tuiTextfield
                  tuiSelect
                  placeholder="Selecione uma instância"
                  [(ngModel)]="selectedInstanceModel"
                  [ngModelOptions]="{ standalone: true }"
                />
                <tui-data-list>
                  @for (instance of instancesRes.value().instances; track instance.name) {
                    <button
                      tuiOption
                      new
                      [value]="instance"
                      type="button"
                    >
                      {{ instance.name }}
                    </button>
                  }
                </tui-data-list>
              </tui-textfield>
            }
          }

          <!-- Expiry (optional) -->
          <tui-textfield>
            <label tuiLabel>Expira em (opcional)</label>
            <input
              tuiTextfield
              type="date"
              [(ngModel)]="expiresAt"
              [ngModelOptions]="{ standalone: true }"
            />
          </tui-textfield>

        </div>

        <!-- Footer -->
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" class="cancel-btn" (click)="cancel()">Cancelar</button>
          <button
            type="button"
            class="gradient-btn"
            [disabled]="!canSubmit() || busy()"
            (click)="submit()"
          >
            @if (busy()) { Criando… } @else { Criar }
          </button>
        </div>

      } @else {

        <!-- ── Key reveal step ───────────────────────────── -->
        <h2 style="
          font-size: 1.25rem;
          font-weight: 300;
          margin: 0 0 0.75rem;
          font-family: 'Figtree', sans-serif;
          color: var(--tui-text-primary);
        ">Chave criada</h2>

        <div class="warning-banner" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <span>Salve esta chave agora. Ela não será exibida novamente.</span>
        </div>

        <div style="margin-top: 1rem;">
          <p class="field-label">Sua chave API</p>
          <div class="key-reveal-row">
            <input
              type="text"
              class="key-readonly-input"
              [value]="createdKey()!.key ?? ''"
              readonly
              aria-label="Chave API gerada"
            />
            <button
              type="button"
              class="copy-btn"
              (click)="copyKey()"
              [attr.aria-label]="copied() ? 'Copiado!' : 'Copiar chave'"
              [title]="copied() ? 'Copiado!' : 'Copiar chave'"
            >
              @if (copied()) {
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
              } @else {
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              }
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" class="gradient-btn" (click)="done()">Concluir</button>
        </div>

      }

    </div>
  `,
  styles: [`
    .field-label {
      font-size: 0.75rem;
      font-weight: 300;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--tui-text-secondary);
      margin: 0 0 0.5rem;
      font-family: 'Figtree', sans-serif;
    }

    .scope-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-outline-variant);
      cursor: pointer;
      font-family: 'Figtree', sans-serif;
      font-weight: 300;
      color: var(--color-on-surface-variant);
      transition:
        border-color var(--duration-fast) var(--ease-default),
        background var(--duration-fast) var(--ease-default),
        color var(--duration-fast) var(--ease-default);
      user-select: none;
    }
    .scope-option--active {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      color: var(--color-primary);
    }
    .scope-option:not(.scope-option--active):not(.scope-option--disabled):hover {
      border-color: var(--color-outline);
      background: var(--color-surface-container-low);
    }
    .scope-option--disabled {
      opacity: 0.45;
      pointer-events: none;
      cursor: not-allowed;
    }

    .scope-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .warning-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      background: var(--color-warning-bg);
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      color: var(--color-warning);
      font-size: 0.8125rem;
      font-weight: 400;
      font-family: 'Figtree', sans-serif;
      line-height: 1.5;
    }
    .warning-banner svg { flex-shrink: 0; margin-top: 1px; }

    .key-reveal-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .key-readonly-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-md);
      background: var(--color-surface-container-low);
      font-family: 'Geist', monospace;
      font-size: 0.8125rem;
      color: var(--color-on-surface);
      outline: none;
      min-width: 0;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-md);
      background: transparent;
      cursor: pointer;
      color: var(--color-on-surface-variant);
      transition:
        background var(--duration-fast) var(--ease-default),
        color var(--duration-fast) var(--ease-default),
        border-color var(--duration-fast) var(--ease-default);
    }
    .copy-btn:hover {
      background: var(--color-surface-container);
      color: var(--color-primary);
      border-color: var(--color-outline);
    }

    .cancel-btn {
      padding: 0.5rem 1.25rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-outline-variant);
      background: transparent;
      font-family: 'Figtree', sans-serif;
      font-weight: 200;
      font-size: 0.875rem;
      cursor: pointer;
      color: var(--color-on-surface);
      transition: border-color var(--duration-fast) var(--ease-default);
    }
    .cancel-btn:hover { border-color: var(--color-outline); }

    .gradient-btn {
      padding: 0.5rem 1.25rem;
      border-radius: var(--radius-lg);
      border: none;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-family: 'Figtree', sans-serif;
      font-weight: 200;
      font-size: 0.875rem;
      cursor: pointer;
      transition: opacity var(--duration-fast) var(--ease-default);
    }
    .gradient-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .gradient-btn:not(:disabled):hover { opacity: 0.9; }

    .instance-msg {
      font-size: 0.8125rem;
      color: var(--color-on-surface-variant);
      font-family: 'Figtree', sans-serif;
      margin: 0;
    }
    .instance-msg--error {
      color: var(--color-error);
    }

    .template-hint {
      margin: 0.375rem 0 0;
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      font-family: 'Figtree', sans-serif;
      line-height: 1.45;
    }

    @keyframes ec-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .ec-skeleton {
      background: linear-gradient(
        90deg,
        var(--color-surface-container-low) 25%,
        var(--color-surface-container) 50%,
        var(--color-surface-container-low) 75%
      );
      background-size: 200% 100%;
      animation: ec-shimmer 1.4s ease infinite;
    }
  `],
})
export class CreateApiKeyDialogComponent {
  private readonly apiKeysService = inject(ApiKeysService);
  private readonly alerts = inject(TuiAlertService);
  readonly context = injectContext<TuiDialogContext<CreateApiKeyResult, CreateApiKeyDialogData>>();
  readonly ResourceStatus = ResourceStatus;

  readonly keyName = signal('');
  readonly scope = signal<'account' | 'instance'>(
    this.context.data?.scope ?? 'account'
  );
  readonly selectedInstance = signal<InstanceRow | null>(null);
  readonly selectedTemplateId = signal<string>('instance_manager');
  readonly instancesRes = httpResource<InstancesListResponse>(() => '/api/instances', {
    defaultValue: { instances: [], total: 0, page: 1, limit: 20, totalPages: 0 },
  });
  readonly templatesRes = httpResource<{ templates: ApiKeyPermissionTemplate[] }>(() => {
    return this.scope() === 'account' ? '/api/auth/apikeys/templates' : undefined;
  }, {
    defaultValue: { templates: [] },
  });
  readonly instancesDisabled = computed(() =>
    this.instancesRes.isLoading() ||
    this.instancesRes.status() === ResourceStatus.Error ||
    this.instancesRes.value().instances.length === 0
  );
  readonly selectedTemplate = computed(() =>
    this.templatesRes
      .value()
      .templates.find((template) => template.id === this.selectedTemplateId()) ??
    null,
  );
  readonly expiresAt = signal('');
  readonly busy = signal(false);
  readonly createdKey = signal<ApiKeyRecord | null>(null);
  readonly copied = signal(false);

  /** Two-way binding bridge for TuiSelect ngModel ↔ selectedInstance signal */
  get selectedInstanceModel(): InstanceRow | null {
    return this.selectedInstance();
  }
  set selectedInstanceModel(value: InstanceRow | null) {
    this.selectedInstance.set(value);
  }

  get selectedTemplateIdModel(): string {
    return this.selectedTemplateId();
  }
  set selectedTemplateIdModel(value: string) {
    this.selectedTemplateId.set(value);
  }

  constructor() {
    effect(() => {
      const list = this.instancesRes.value().instances;
      const target = this.context.data?.instanceName;
      if (!target) return;
      const match = list.find(i => i.name === target) ?? null;
      this.selectedInstance.set(match);
    });

    effect(() => {
      if (this.scope() !== 'account') {
        this.selectedTemplateId.set('');
        return;
      }

      const templates = this.templatesRes.value().templates;
      if (templates.length === 0) {
        this.selectedTemplateId.set('');
        return;
      }

      const currentTemplate = templates.some(
        (template) => template.id === this.selectedTemplateId(),
      );
      if (currentTemplate) {
        return;
      }

      const preferredTemplate =
        templates.find((template) => template.id === 'instance_manager') ?? templates[0];
      this.selectedTemplateId.set(preferredTemplate.id);
    });
  }

  canSubmit(): boolean {
    const name = this.keyName().trim();
    if (!name) return false;
    if (this.scope() === 'instance' && !this.selectedInstance()) return false;
    if (
      this.scope() === 'account' &&
      this.templatesRes.value().templates.length > 0 &&
      !this.selectedTemplateId()
    ) {
      return false;
    }
    return true;
  }

  cancel(): void {
    this.context.completeWith();
  }

  done(): void {
    this.context.completeWith(this.createdKey() ?? undefined);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);

    const payload = {
      name: this.keyName().trim(),
      ...(this.expiresAt() ? { expiresAt: this.expiresAt() } : {}),
      ...(this.scope() === 'account' && this.selectedTemplateId()
        ? { permissionsTemplate: this.selectedTemplateId() }
        : {}),
    };

    const request$ =
      this.scope() === 'instance'
        ? this.apiKeysService.createInstanceKey(this.selectedInstance()!.name, payload)
        : this.apiKeysService.createAccountKey(payload);

    try {
      const created = await firstValueFrom(request$);
      this.createdKey.set(created);
    } catch {
      this.alerts
        .open('Falha ao criar a chave. Tente novamente.', {
          label: 'Erro',
          appearance: 'negative',
          autoClose: 5000,
        })
        .subscribe();
    } finally {
      this.busy.set(false);
    }
  }

  copyKey(): void {
    const key = this.createdKey()?.key ?? '';
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
