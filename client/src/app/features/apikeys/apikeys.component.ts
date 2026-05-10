import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { TuiAlertService, TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { firstValueFrom } from 'rxjs';
import { ApiKeyRecord, ApiKeysService } from '../../core/services/api-keys.service';
import { HeaderActionsService } from '../../shared/header-actions.service';
import { CreateApiKeyDialogComponent } from './create-api-key-dialog.component';

@Component({
  selector: 'app-apikeys',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('staggerRows', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(8px)' }),
          stagger('50ms', [
            animate('250ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    <div class="page-wrapper">

      <!-- Loading state -->
      @if (loading()) {
        <div class="table-shell" aria-busy="true" aria-label="Carregando chaves API">
          <table class="keys-table" role="presentation">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Escopo</th>
                <th>Prefixo</th>
                <th>Criada em</th>
                <th>Último uso</th>
                <th>Expira em</th>
                <th aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody>
              @for (n of [1, 2, 3]; track n) {
                <tr class="skeleton-row" aria-hidden="true">
                  <td><div class="ec-skeleton skel-name"></div></td>
                  <td><div class="ec-skeleton skel-badge"></div></td>
                  <td><div class="ec-skeleton skel-prefix"></div></td>
                  <td><div class="ec-skeleton skel-date"></div></td>
                  <td><div class="ec-skeleton skel-date"></div></td>
                  <td><div class="ec-skeleton skel-date"></div></td>
                  <td><div class="ec-skeleton skel-action"></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Error state -->
      @else if (error()) {
        <div class="status-message" @fadeInUp>
          <svg class="status-icon status-icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <p class="status-heading">Falha ao carregar chaves</p>
          <button type="button" class="gradient-btn" (click)="loadKeys()">Tentar novamente</button>
        </div>
      }

      <!-- Empty state -->
      @else if (!loading() && keys().length === 0) {
        <div class="empty-state" @fadeInUp>
          <div class="empty-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
            </svg>
          </div>
          <h3 class="empty-heading">Nenhuma chave criada ainda</h3>
          <p class="empty-body">Crie uma chave de API para integrar com o Papagai</p>
          <button type="button" class="gradient-btn" (click)="openCreate()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Nova Chave
          </button>
        </div>
      }

      <!-- Populated state -->
      @else {
        <div class="table-shell" @staggerRows>
          <table class="keys-table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Escopo</th>
                <th scope="col">Prefixo</th>
                <th scope="col">Criada em</th>
                <th scope="col">Último uso</th>
                <th scope="col">Expira em</th>
                <th scope="col" aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody>
              @for (key of keys(); track key.id) {
                <tr class="key-row" [class.key-row--disabled]="!key.enabled" @fadeInUp>
                  <td class="cell-name">
                    <div class="key-name-wrap">
                      <span class="key-name">{{ key.name }}</span>
                      @if (!key.enabled) {
                        <span class="badge badge--muted">inativa</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="badge badge--scope">
                      Conta
                    </span>
                  </td>
                  <td>
                    <code class="key-prefix">{{ key.prefix }}</code>
                  </td>
                  <td class="cell-date">{{ formatDate(key.createdAt) }}</td>
                  <td class="cell-date">{{ key.lastUsedAt ? formatDate(key.lastUsedAt) : '—' }}</td>
                  <td class="cell-date">{{ key.expiresAt ? formatDate(key.expiresAt) : 'Nunca' }}</td>
                  <td class="cell-actions">
                    @if (revokingId() === key.id) {
                      <!-- Inline confirmation -->
                      <div class="confirm-row">
                        <span class="confirm-label">Revogar?</span>
                        <button type="button" class="negative-btn" (click)="confirmRevoke(key.id)">Sim</button>
                        <button type="button" class="cancel-btn" (click)="revokingId.set(null)">Não</button>
                      </div>
                    } @else {
                      <button
                        type="button"
                        class="revoke-btn"
                        (click)="requestRevoke(key.id)"
                        [attr.aria-label]="'Revogar chave ' + key.name"
                      >
                        Revogar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Page wrapper ─────────────────────────────────────── */
    .page-wrapper {
      padding: 1.25rem 1.5rem 2rem;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 640px) {
      .page-wrapper { padding: 1rem; }
    }

    /* ── Buttons ──────────────────────────────────────────── */
    .gradient-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-lg);
      border: none;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-family: 'Figtree', sans-serif;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition: opacity var(--duration-fast) var(--ease-default);
      white-space: nowrap;
    }
    .gradient-btn:hover { opacity: 0.88; }

    .revoke-btn {
      padding: 0.3125rem 0.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-error-container);
      background: var(--color-error-bg);
      color: var(--color-error);
      font-family: 'Figtree', sans-serif;
      font-weight: 400;
      font-size: 0.75rem;
      cursor: pointer;
      transition:
        background var(--duration-fast) var(--ease-default),
        border-color var(--duration-fast) var(--ease-default);
    }
    .revoke-btn:hover {
      background: var(--color-error-container);
    }

    .negative-btn {
      padding: 0.3125rem 0.625rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-error-container);
      background: var(--color-error-container);
      color: var(--color-on-error-container);
      font-family: 'Figtree', sans-serif;
      font-weight: 500;
      font-size: 0.75rem;
      cursor: pointer;
      transition: opacity var(--duration-fast) var(--ease-default);
    }
    .negative-btn:hover { opacity: 0.85; }

    .cancel-btn {
      padding: 0.3125rem 0.625rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-outline-variant);
      background: transparent;
      color: var(--color-on-surface-variant);
      font-family: 'Figtree', sans-serif;
      font-weight: 400;
      font-size: 0.75rem;
      cursor: pointer;
      transition: border-color var(--duration-fast) var(--ease-default);
    }
    .cancel-btn:hover { border-color: var(--color-outline); }

    /* ── Table shell ──────────────────────────────────────── */
    .table-shell {
      background: var(--color-surface-container-lowest);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    .keys-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Figtree', sans-serif;
      font-size: 0.8125rem;
    }

    .keys-table thead tr {
      border-bottom: 1px solid var(--color-outline-variant);
    }

    .keys-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-size: 0.6875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
    }

    .keys-table td {
      padding: 0.875rem 1rem;
      vertical-align: middle;
      color: var(--color-on-surface);
    }

    .key-row {
      border-bottom: 1px solid var(--color-outline-variant);
      transition: background var(--duration-fast) var(--ease-default);
    }
    .key-row:last-child { border-bottom: none; }
    .key-row:hover { background: var(--color-surface-container-low); }
    .key-row--disabled { opacity: 0.65; }

    /* ── Cell content ─────────────────────────────────────── */
    .cell-name { max-width: 220px; }

    .key-name-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .key-name {
      font-weight: 500;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .key-prefix {
      font-family: 'Geist', monospace;
      font-size: 0.8125rem;
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container);
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-sm);
      letter-spacing: 0.02em;
    }

    .cell-date {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
    }

    .cell-actions {
      text-align: right;
      white-space: nowrap;
    }

    /* ── Badges ───────────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-full);
      font-size: 0.6875rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .badge--scope {
      background: var(--color-secondary-container);
      color: var(--color-on-secondary-container);
    }
    .badge--muted {
      background: var(--color-surface-container);
      color: var(--color-on-surface-variant);
    }

    /* ── Inline revoke confirmation ───────────────────────── */
    .confirm-row {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      justify-content: flex-end;
    }
    .confirm-label {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
    }

    /* ── Skeleton rows ────────────────────────────────────── */
    .skeleton-row td { padding: 1rem; }
    .ec-skeleton {
      border-radius: var(--radius-md);
      background: linear-gradient(
        90deg,
        rgba(20,20,19,.05) 0%,
        rgba(20,20,19,.10) 50%,
        rgba(20,20,19,.05) 100%
      );
      background-size: 200% 100%;
      animation: shimmer 2s linear infinite;
    }
    .skel-name   { height: 0.875rem; width: 120px; }
    .skel-badge  { height: 1.25rem; width: 60px; border-radius: var(--radius-full); }
    .skel-prefix { height: 0.875rem; width: 72px; }
    .skel-date   { height: 0.75rem; width: 88px; }
    .skel-action { height: 1.625rem; width: 60px; border-radius: var(--radius-md); }

    @keyframes shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }

    /* ── Empty / error state ──────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      gap: 0.75rem;
    }

    .empty-icon {
      color: var(--color-on-surface-variant);
      opacity: 0.5;
      margin-bottom: 0.5rem;
    }

    .empty-heading {
      font-size: 1.125rem;
      font-weight: 300;
      margin: 0;
      color: var(--tui-text-primary);
      font-family: 'Figtree', sans-serif;
    }

    .empty-body {
      font-size: 0.875rem;
      font-weight: 200;
      color: var(--tui-text-secondary);
      margin: 0 0 0.5rem;
      font-family: 'Figtree', sans-serif;
    }

    .status-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 2rem;
      text-align: center;
    }

    .status-icon {
      width: 2.5rem;
      height: 2.5rem;
      opacity: 0.65;
    }
    .status-icon--error { color: var(--color-error); }

    .status-heading {
      font-size: 0.875rem;
      font-weight: 200;
      margin: 0;
      font-family: 'Figtree', sans-serif;
      color: var(--tui-text-secondary);
    }

    /* ── Responsive: collapse table on narrow screens ─────── */
    @media (max-width: 768px) {
      .keys-table th:nth-child(4),
      .keys-table th:nth-child(5),
      .keys-table th:nth-child(6),
      .keys-table td:nth-child(4),
      .keys-table td:nth-child(5),
      .keys-table td:nth-child(6) {
        display: none;
      }
    }
  `],
})
export class ApikeysComponent implements OnInit {
  private readonly apiKeysService = inject(ApiKeysService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly headerActions = inject(HeaderActionsService);

  readonly keys = signal<ApiKeyRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly revokingId = signal<string | null>(null);

  constructor() {
    this.headerActions.setActions([
      {
        id: 'new-key',
        label: '+ Nova Chave',
        variant: 'primary',
        onClick: () => this.openCreate(),
      },
    ]);
    inject(DestroyRef).onDestroy(() => this.headerActions.clearActions());
  }

  ngOnInit(): void {
    this.loadKeys();
  }

  loadKeys(): void {
    this.loading.set(true);
    this.error.set(false);
    this.apiKeysService.listAccountKeys().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.dialogs
      .open(
        new PolymorpheusComponent(CreateApiKeyDialogComponent, this.injector),
        {
          label: 'Nova chave API',
          size: 'm',
          data: { scope: 'account' },
        },
      )
      .subscribe((result) => {
        if (result != null) {
          this.loadKeys();
          this.alerts
            .open('Chave criada com sucesso.', {
              label: 'Sucesso',
              appearance: 'positive',
              autoClose: 4000,
            })
            .subscribe();
        }
      });
  }

  requestRevoke(id: string): void {
    this.revokingId.set(id);
  }

  async confirmRevoke(id: string): Promise<void> {
    this.revokingId.set(null);
    try {
      await firstValueFrom(this.apiKeysService.revokeAccountKey(id));
      this.keys.update((current) => current.filter((k) => k.id !== id));
      this.alerts
        .open('Chave revogada.', {
          label: 'Sucesso',
          appearance: 'positive',
          autoClose: 4000,
        })
        .subscribe();
    } catch {
      this.alerts
        .open('Falha ao revogar a chave. Tente novamente.', {
          label: 'Erro',
          appearance: 'negative',
          autoClose: 5000,
        })
        .subscribe();
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
