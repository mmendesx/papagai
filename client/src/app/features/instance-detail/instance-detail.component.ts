import { HttpClient, HttpContext, httpResource } from '@angular/common/http';
import { SUPPRESS_ERROR_ALERT } from '../../core/http/suppress-error-alert.context';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, of, timer } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { HeaderActionsService } from '../../shared/header-actions.service';
import { InstanceTabsComponent } from './instance-tabs.component';

type QrResponse = {
  qr?: string;
  qrImageData?: string | null;
  status: string;
  instance?: string;
  message?: string;
  phoneNumber?: string;
};

type StatusResponse = {
  name: string;
  provider: 'web' | 'wba';
  capabilities: {
    qr: boolean;
    sendMessages: boolean;
    receiveMessages: boolean;
    chatHistorySync: boolean;
    contactLookup: boolean;
    markRead: boolean;
    templates: boolean;
  };
  connected: boolean;
  startTime: string;
  uptime: number;
  phoneNumber?: string;
  webhook?: {
    url: string | null;
    headers: Record<string, string>;
    enabled: boolean;
    events: string[];
  };
  wba?: {
    phoneNumberId?: string | null;
    displayPhoneNumber?: string | null;
    businessAccountId?: string | null;
    webhookConfiguredAt?: string | null;
    lastHealthCheckAt?: string | null;
    lastHealthCheckStatus?: string | null;
    appSecretConfigured?: boolean;
  };
};

interface InstanceMetrics {
  messagesSent: number | null;
  messagesReceived: number | null;
  activeConversations: number | null;
  webhookEnabled: boolean | null;
}

interface RecentActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface DashboardRealtimeEvent {
  type?: 'chat_updated' | 'chat_read' | 'history_synced' | 'heartbeat';
  chatId?: string;
  timestamp?: number;
  source?: 'incoming' | 'outgoing' | string;
  chat?: {
    id: string;
    name?: string | null;
    lastMessage?: string | null;
  };
  message?: {
    id?: string;
    body?: string | null;
    fromMe?: boolean;
    type?: string;
    sender?: string | null;
  };
}

const EMPTY_METRICS: InstanceMetrics = {
  messagesSent: null,
  messagesReceived: null,
  activeConversations: null,
  webhookEnabled: null,
};
const TOKEN_KEY = 'papagai_access_token';
const ACTIVITY_LIMIT = 20;
const STREAM_RETRY_DELAY_MS = 2000;
const MS_EPOCH_THRESHOLD = 1_000_000_000_000;

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [RouterLink, InstanceTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate(
          '300ms cubic-bezier(0, 0, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('slideInRight', [
      transition(':enter', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateX(12px)' }),
            stagger('50ms', [
              animate(
                '280ms cubic-bezier(0, 0, 0.2, 1)',
                style({ opacity: 1, transform: 'translateX(0)' }),
              ),
            ]),
          ],
          { optional: true },
        ),
      ]),
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.92)' }),
        animate(
          '350ms cubic-bezier(0, 0, 0.2, 1)',
          style({ opacity: 1, transform: 'scale(1)' }),
        ),
      ]),
    ]),
  ],
  template: `
    @if (qrData(); as q) {
      @if (q.status === 'connected') {
        <!-- Unified tab bar -->
        @if (name(); as n) {
          <app-instance-tabs
            [instanceName]="n"
            [connected]="status()?.connected ?? null"
          />
        }

        <!-- Main content area -->
        <div class="page-content" @fadeInUp>
          <!-- Inline connection meta row -->
          <div class="conn-meta-row" aria-label="Status da conexão">
            <span class="conn-status-dot" aria-hidden="true"></span>
            <span class="conn-status-label">Conectado</span>
            @if (q.phoneNumber ?? status()?.phoneNumber; as phone) {
              <span class="conn-meta-sep" aria-hidden="true">·</span>
              <span class="conn-meta-text">{{ formatPhone(phone) }}</span>
            }
            @if (status(); as s) {
              <span class="conn-meta-sep" aria-hidden="true">·</span>
              <span class="conn-meta-text"
                >Ativo há {{ formatMs(s.uptime) }}</span
              >
            }
          </div>

          @if (status()?.provider === 'wba') {
            <div class="other-status-card">
              <p class="other-status-text">
                WBA mode: Papagai stores only messages sent through Papagai and
                messages delivered by Meta webhooks.
              </p>
            </div>
          }

          <!-- RESUMO section -->
          <section class="content-section" aria-label="Resumo da instância">
            <h2 class="section-label" aria-label="Seção: Resumo">RESUMO</h2>
            <div class="metrics-grid" @slideInRight>
              <!-- Mensagens Enviadas -->
              <div class="metric-card">
                <div class="metric-card-top">
                  <div
                    class="metric-icon-tile metric-icon-tile--sent"
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                      />
                    </svg>
                  </div>
                </div>
                <span
                  class="metric-value"
                  [attr.aria-label]="
                    'Mensagens enviadas: ' +
                    (metrics().messagesSent ?? 'sem dados')
                  "
                >
                  {{ metrics().messagesSent ?? '—' }}
                </span>
                <span class="metric-label">Mensagens Enviadas</span>
                <span class="metric-trend">Últimos 7 dias</span>
              </div>

              <!-- Mensagens Recebidas -->
              <div class="metric-card">
                <div class="metric-card-top">
                  <div
                    class="metric-icon-tile metric-icon-tile--received"
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3"
                      />
                    </svg>
                  </div>
                </div>
                <span
                  class="metric-value"
                  [attr.aria-label]="
                    'Mensagens recebidas: ' +
                    (metrics().messagesReceived ?? 'sem dados')
                  "
                >
                  {{ metrics().messagesReceived ?? '—' }}
                </span>
                <span class="metric-label">Mensagens Recebidas</span>
                <span class="metric-trend">Últimos 7 dias</span>
              </div>

              <!-- Conversas Ativas -->
              <div class="metric-card">
                <div class="metric-card-top">
                  <div
                    class="metric-icon-tile metric-icon-tile--conv"
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                      />
                    </svg>
                  </div>
                </div>
                <span
                  class="metric-value"
                  [attr.aria-label]="
                    'Conversas ativas: ' +
                    (metrics().activeConversations ?? 'sem dados')
                  "
                >
                  {{ metrics().activeConversations ?? '—' }}
                </span>
                <span class="metric-label">Conversas Ativas</span>
                <span class="metric-trend">Momento atual</span>
              </div>

              <!-- Webhook -->
              <div class="metric-card">
                <div class="metric-card-top">
                  <div
                    class="metric-icon-tile metric-icon-tile--webhook"
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                      />
                    </svg>
                  </div>
                </div>
                @if (metrics().webhookEnabled === null) {
                  <span
                    class="metric-value metric-value--muted"
                    aria-label="Webhook: sem dados"
                    >—</span
                  >
                } @else if (metrics().webhookEnabled) {
                  <span
                    class="webhook-chip webhook-chip--on"
                    aria-label="Webhook: ativo"
                    >Ativo</span
                  >
                } @else {
                  <span
                    class="webhook-chip webhook-chip--off"
                    aria-label="Webhook: inativo"
                    >Inativo</span
                  >
                }
                <span class="metric-label">Webhook</span>
                <span class="metric-trend">Configuração atual</span>
              </div>
            </div>
          </section>

          <!-- ACESSO RÁPIDO section -->
          <section class="content-section" aria-label="Acesso rápido">
            <h2 class="section-label" aria-label="Seção: Acesso rápido">
              ACESSO RÁPIDO
            </h2>
            <div class="nav-grid">
              <a
                [routerLink]="['./chats']"
                class="nav-tile"
                aria-label="Ir para Conversas"
              >
                <div
                  class="nav-tile-icon nav-tile-icon--chat"
                  aria-hidden="true"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                    />
                  </svg>
                </div>
                <div class="nav-tile-body">
                  <span class="nav-tile-title">Conversas</span>
                  <span class="nav-tile-desc">Mensagens e histórico</span>
                </div>
                <svg
                  class="nav-tile-chevron"
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 4l6 6-6 6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </a>

              <a
                [routerLink]="['./settings']"
                class="nav-tile"
                aria-label="Ir para Configurações"
              >
                <div
                  class="nav-tile-icon nav-tile-icon--settings"
                  aria-hidden="true"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div class="nav-tile-body">
                  <span class="nav-tile-title">Configurações</span>
                  <span class="nav-tile-desc">Webhook e gerenciamento</span>
                </div>
                <svg
                  class="nav-tile-chevron"
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 4l6 6-6 6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </a>
            </div>
          </section>

          <!-- ATIVIDADE RECENTE section -->
          <section class="content-section" aria-label="Atividade recente">
            <h2 class="section-label" aria-label="Seção: Atividade recente">
              ATIVIDADE RECENTE
            </h2>
            @if (activityStreamError()) {
              <p class="activity-stream-note" role="status">
                Atualização em tempo real indisponível. Tentando reconectar…
              </p>
            }
            @if (recentActivity().length > 0) {
              <div class="activity-list">
                @for (item of recentActivity(); track item.id) {
                  <div class="activity-item">
                    <span class="activity-desc">{{ item.description }}</span>
                    <span class="activity-time">{{ item.timestamp }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="activity-empty">
                <div class="activity-empty-icon" aria-hidden="true">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.25"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p class="activity-empty-text">
                  Nenhuma atividade registrada ainda. As mensagens recebidas e
                  eventos aparecerão aqui.
                </p>
              </div>
            }
          </section>
        </div>
        <!-- /page-content -->
      } @else if (q.status === 'qr' && q.qrImageData) {
        <!-- QR scan state: centered -->
        <div class="qr-layout">
          <div class="qr-card" @scaleIn>
            <div class="qr-status-header">
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="11" fill="var(--color-warning-bg)" />
                <path
                  d="M11 7v4l2.5 1.5"
                  style="stroke: var(--color-method-patch);"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              <span class="qr-status-label">Aguardando leitura do QR Code</span>
            </div>
            <p class="qr-hint">Escaneie com o WhatsApp para conectar</p>
            <img
              [src]="q.qrImageData"
              alt="WhatsApp QR Code"
              class="qr-image"
            />
          </div>
        </div>
      } @else {
        <!-- Other status (disconnected, connecting, etc.) -->
        <div class="centered-state">
          <div class="other-status-card">
            <p class="other-status-text">
              {{ q.message ?? translateStatus(q.status) }}
            </p>
          </div>
        </div>
      }
    } @else {
      <div class="centered-state">
        <p class="loading-text">Carregando…</p>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        font-family: var(--font-sans);
      }

      /* ── Page content wrapper ──────────────────────────────── */
      .page-content {
        flex: 1;
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
        padding: 1.25rem 1.5rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
      }

      /* ── Inline connection meta row ────────────────────────── */
      .conn-meta-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
      }
      .conn-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--color-success);
        flex-shrink: 0;
        box-shadow: 0 0 0 2px
          color-mix(in srgb, var(--color-success) 22%, transparent);
      }
      .conn-status-label {
        font-weight: 600;
        color: color-mix(
          in srgb,
          var(--color-primary) 85%,
          var(--color-on-surface)
        );
      }
      .conn-meta-sep {
        color: var(--color-outline-variant);
      }
      .conn-meta-text {
        color: var(--color-on-surface-variant);
      }

      /* ── Section label ─────────────────────────────────────── */
      .content-section {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
      }
      .section-label {
        margin: 0;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-on-surface-variant);
      }

      /* ── Metrics grid ──────────────────────────────────────── */
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
      }
      .metric-card {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1rem 1.125rem 0.875rem;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        transition:
          border-color var(--duration-fast) var(--ease-default),
          transform var(--duration-fast) var(--ease-default),
          box-shadow var(--duration-fast) var(--ease-default);
      }
      .metric-card:hover {
        border-color: var(--color-outline);
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }
      .metric-card-top {
        margin-bottom: 0.375rem;
      }

      /* Icon tiles */
      .metric-icon-tile {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .metric-icon-tile--sent {
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: color-mix(
          in srgb,
          var(--color-primary) 75%,
          var(--color-on-surface)
        );
      }
      .metric-icon-tile--received {
        background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
        color: color-mix(
          in srgb,
          var(--color-secondary) 75%,
          var(--color-on-surface)
        );
      }
      .metric-icon-tile--conv {
        background: color-mix(
          in srgb,
          var(--color-tertiary, var(--color-primary)) 10%,
          transparent
        );
        color: color-mix(
          in srgb,
          var(--color-tertiary, var(--color-primary)) 75%,
          var(--color-on-surface)
        );
      }
      .metric-icon-tile--webhook {
        background: color-mix(
          in srgb,
          var(--color-on-surface-variant) 8%,
          transparent
        );
        color: var(--color-on-surface-variant);
      }

      /* Numeric value */
      .metric-value {
        font-size: 2rem;
        font-weight: 400;
        color: var(--color-on-surface);
        line-height: 1.1;
        font-feature-settings: 'tnum';
        letter-spacing: -0.02em;
        margin-bottom: 0.375rem;
        min-height: 2.25rem;
      }
      .metric-value--muted {
        color: var(--color-on-surface-variant);
      }

      /* Sparkline placeholder */
      .metric-sparkline {
        display: block;
        margin: 0.25rem 0 0.125rem;
        opacity: 0.5;
        overflow: visible;
      }
      .metric-sparkline-placeholder {
        height: 18px;
        margin: 0.25rem 0 0.125rem;
      }

      /* Webhook chip */
      .webhook-chip {
        display: inline-flex;
        align-items: center;
        align-self: flex-start;
        padding: 0.1875rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 600;
        margin-top: 0.25rem;
        margin-bottom: 0.125rem;
      }
      .webhook-chip--on {
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: color-mix(
          in srgb,
          var(--color-primary) 80%,
          var(--color-on-surface)
        );
        border: 1px solid
          color-mix(in srgb, var(--color-primary) 20%, transparent);
      }
      .webhook-chip--off {
        background: color-mix(
          in srgb,
          var(--color-on-surface-variant) 8%,
          transparent
        );
        color: var(--color-on-surface-variant);
        border: 1px solid
          color-mix(in srgb, var(--color-on-surface-variant) 15%, transparent);
      }

      /* Label + trend */
      .metric-label {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface);
        margin-top: 0.125rem;
      }
      .metric-trend {
        font-size: 0.6875rem;
        font-weight: 400;
        color: var(--color-on-surface-variant);
      }

      /* ── Nav grid ──────────────────────────────────────────── */
      .nav-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
      }
      .nav-tile {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 1rem 1.125rem;
        min-height: 80px;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        text-decoration: none;
        color: inherit;
        transition:
          background var(--duration-fast) var(--ease-default),
          border-color var(--duration-fast) var(--ease-default),
          transform var(--duration-fast) var(--ease-default),
          box-shadow var(--duration-fast) var(--ease-default);
      }
      .nav-tile:hover {
        background: var(--color-surface-container-low);
        border-color: var(--color-outline);
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }
      .nav-tile:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .nav-tile-icon {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .nav-tile-icon--chat {
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: color-mix(
          in srgb,
          var(--color-primary) 80%,
          var(--color-on-surface)
        );
      }
      .nav-tile-icon--settings {
        background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
        color: color-mix(
          in srgb,
          var(--color-secondary) 80%,
          var(--color-on-surface)
        );
      }
      .nav-tile-body {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        flex: 1;
        min-width: 0;
      }
      .nav-tile-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .nav-tile-desc {
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--color-on-surface-variant);
        white-space: normal;
        line-height: 1.35;
      }
      .nav-tile-chevron {
        color: var(--color-outline-variant);
        flex-shrink: 0;
        transition:
          transform var(--duration-fast) var(--ease-default),
          color var(--duration-fast) var(--ease-default);
      }
      .nav-tile:hover .nav-tile-chevron {
        transform: translateX(3px);
        color: var(--color-on-surface-variant);
      }

      /* ── Activity section ──────────────────────────────────── */
      .activity-list {
        display: flex;
        flex-direction: column;
        gap: 0;
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        overflow: hidden;
        background: var(--color-surface-container-lowest);
      }
      .activity-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1.125rem;
        border-bottom: 1px solid var(--color-outline-variant);
        font-size: 0.8125rem;
      }
      .activity-item:last-child {
        border-bottom: none;
      }
      .activity-desc {
        color: var(--color-on-surface);
      }
      .activity-time {
        color: var(--color-on-surface-variant);
        font-size: 0.75rem;
        white-space: nowrap;
      }
      .activity-stream-note {
        margin: 0 0 0.75rem;
        color: var(--color-on-surface-variant);
        font-size: 0.75rem;
      }

      .activity-empty {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.625rem;
        padding: 2rem 1.5rem;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-xl);
        text-align: center;
      }
      .activity-empty-icon {
        color: var(--color-outline-variant);
        margin-bottom: 0.125rem;
      }
      .activity-empty-text {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--color-on-surface-variant);
        max-width: 36ch;
        line-height: 1.5;
      }
      /* ── QR state ──────────────────────────────────────────── */
      .qr-layout {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .qr-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-2xl);
        padding: 2rem 2.5rem;
      }
      .qr-status-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .qr-status-label {
        font-size: 1rem;
        font-weight: 400;
        color: var(--color-method-patch);
      }
      .qr-hint {
        margin: 0;
        font-weight: 400;
        color: var(--tui-text-secondary);
      }
      .qr-image {
        max-width: 260px;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        padding: 1rem;
        background: white;
      }

      /* ── Mobile ────────────────────────────────────────────── */
      @media (max-width: 540px) {
        .page-content {
          padding: 0.875rem 0.875rem 2rem;
          gap: 1.25rem;
        }

        .conn-meta-row {
          flex-wrap: wrap;
          row-gap: 0.2rem;
        }

        .metrics-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .metric-card {
          padding: 0.75rem 0.875rem 0.625rem;
        }

        .metric-value {
          font-size: 1.5rem;
          min-height: 1.75rem;
        }

        .metric-label {
          font-size: 0.625rem;
        }

        .metric-trend {
          font-size: 0.625rem;
        }

        .nav-grid {
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }

        .nav-tile {
          min-height: 60px;
          padding: 0.75rem 1rem;
          gap: 0.75rem;
        }

        .nav-tile-icon {
          width: 32px;
          height: 32px;
        }

        .nav-tile-title {
          font-size: 0.875rem;
        }

        .activity-empty {
          padding: 1.5rem 1rem;
        }
      }

      /* ── Loading / other states ────────────────────────────── */
      .centered-state {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .other-status-card {
        border-radius: var(--radius-xl);
        padding: 1.5rem;
        border-left: 4px solid var(--tui-border-normal);
        max-width: 28rem;
        background: var(--tui-background-neutral-1);
      }
      .other-status-text {
        margin: 0;
        font-weight: 400;
        color: var(--tui-text-secondary);
      }
      .loading-text {
        color: var(--tui-text-secondary);
        font-weight: 400;
      }
    `,
  ],
})
export class InstanceDetailComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly name = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('name'))),
    { initialValue: null as string | null },
  );

  readonly qrData = signal<QrResponse | null>(null);
  readonly status = signal<StatusResponse | null>(null);

  // Live metrics from GET /api/instances/:name/metrics.
  private readonly metricsRes = httpResource<{
    instance: string;
    metrics: InstanceMetrics;
  }>(() => {
    const n = this.name();
    return n && this.qrData()?.status === 'connected'
      ? `/api/instances/${encodeURIComponent(n)}/metrics`
      : undefined;
  });
  private readonly lastMetrics = signal<InstanceMetrics>(EMPTY_METRICS);
  private readonly metricsSyncEffect = effect(() => {
    const next = this.metricsRes.value()?.metrics;
    if (next) {
      this.lastMetrics.set(next);
    }
  });
  readonly metrics = computed<InstanceMetrics>(() => this.lastMetrics());

  readonly recentActivity = signal<RecentActivityItem[]>([]);
  readonly activityStreamError = signal(false);

  private streamAbortController: AbortController | null = null;
  private readonly streamEffect = effect((onCleanup) => {
    const instanceName = this.name();
    const connected = this.qrData()?.status === 'connected';

    if (!instanceName || !connected) {
      this.stopActivityStream();
      return;
    }

    this.startActivityStream(instanceName);
    onCleanup(() => this.stopActivityStream());
  });

  private static readonly STATUS_LABELS: Record<string, string> = {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    qr: 'Aguardando QR Code',
    connecting: 'Conectando…',
    timeout: 'Tempo esgotado',
    close: 'Conexão encerrada',
    logout: 'Desconectado',
  };

  translateStatus(status: string): string {
    return InstanceDetailComponent.STATUS_LABELS[status] ?? status;
  }

  formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      // Brazilian mobile (9-digit): +55 XX 9XXXX-XXXX
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12 && digits.startsWith('55')) {
      // Brazilian 8-digit: +55 XX XXXX-XXXX
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return `+${digits}`;
  }

  constructor() {
    const headerActions = inject(HeaderActionsService);
    headerActions.clearActions();
    inject(DestroyRef).onDestroy(() => {
      this.stopActivityStream();
      headerActions.clearActions();
    });

    // Provider-aware status polling
    this.route.paramMap
      .pipe(
        map((p) => p.get('name')),
        filter((n): n is string => !!n),
        switchMap((instanceName) =>
          timer(0, 3000).pipe(
            switchMap(() =>
              this.http.get<StatusResponse>(
                `/api/instances/${encodeURIComponent(instanceName)}/status`,
                {
                  context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true),
                },
              ),
            ),
            switchMap((s) => {
              this.status.set(s);
              if (s.provider === 'wba') {
                return of<QrResponse>({
                  status: s.connected ? 'connected' : 'connecting',
                  phoneNumber: s.phoneNumber ?? undefined,
                  message: s.connected
                    ? 'WBA instance ready'
                    : 'WBA instance waiting for health/webhook readiness',
                });
              }
              return this.http
                .get<QrResponse>(
                  `/api/instances/${encodeURIComponent(instanceName)}/qr`,
                  {
                    context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true),
                  },
                )
                .pipe(
                  catchError(() =>
                    of<QrResponse>({
                      status: s.connected ? 'connected' : 'connecting',
                      phoneNumber: s.phoneNumber ?? undefined,
                    }),
                  ),
                );
            }),
            tap((q) => {
              if (q.status !== 'connected') {
                return;
              }
              void firstValueFrom(
                this.http.get<StatusResponse>(
                  `/api/instances/${encodeURIComponent(instanceName)}/status`,
                  {
                    context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true),
                  },
                ),
              )
                .then((s) => this.status.set(s))
                .catch(() => this.status.set(null));
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (r) => this.qrData.set(r),
        error: () => this.qrData.set(null),
      });
  }

  formatMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  private startActivityStream(instanceName: string): void {
    this.stopActivityStream();

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.activityStreamError.set(true);
      return;
    }

    const controller = new AbortController();
    this.streamAbortController = controller;
    this.activityStreamError.set(false);

    void fetchEventSource(
      `/api/instances/${encodeURIComponent(instanceName)}/events`,
      {
        method: 'GET',
        signal: controller.signal,
        openWhenHidden: true,
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        onopen: (response) => {
          if (response.ok) {
            this.activityStreamError.set(false);
            return Promise.resolve();
          }
          this.activityStreamError.set(true);
          if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized activity stream');
          }
          throw new Error(
            `Failed to open activity stream (${response.status})`,
          );
        },
        onmessage: (event) => {
          this.handleActivityEvent(event.data, event.event);
        },
        onclose: () => {
          if (controller.signal.aborted) return;
          this.activityStreamError.set(true);
          throw new Error('Activity stream closed unexpectedly');
        },
        onerror: (error) => {
          if (controller.signal.aborted) return;
          this.activityStreamError.set(true);
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('Unauthorized activity stream')) {
            this.stopActivityStream();
            return;
          }
          return STREAM_RETRY_DELAY_MS;
        },
      },
    ).catch(() => undefined);
  }

  private stopActivityStream(): void {
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }
  }

  private handleActivityEvent(rawData: string, eventType?: string): void {
    if (!rawData) return;

    let parsed: DashboardRealtimeEvent | null = null;
    try {
      parsed = JSON.parse(rawData) as DashboardRealtimeEvent;
    } catch {
      return;
    }

    if (!parsed) return;

    const type = parsed.type ?? eventType;
    if (!type) return;
    if (type === 'heartbeat') return;

    const item = this.mapActivityItem(parsed, type);
    if (!item) return;

    this.activityStreamError.set(false);
    this.recentActivity.update((current) =>
      [item, ...current].slice(0, ACTIVITY_LIMIT),
    );

    if (
      type === 'chat_updated' ||
      type === 'chat_read' ||
      type === 'history_synced'
    ) {
      this.metricsRes.reload();
    }
  }

  private mapActivityItem(
    event: DashboardRealtimeEvent,
    type: string,
  ): RecentActivityItem | null {
    const timestamp = this.toEpochMs(event.timestamp);
    const chatName =
      event.chat?.name || event.chatId || event.chat?.id || 'conversa';

    if (type === 'chat_updated') {
      const direction =
        event.message?.fromMe || event.source === 'outgoing'
          ? 'Mensagem enviada'
          : 'Mensagem recebida';
      const preview = this.activityPreview(
        event.message?.body ?? event.chat?.lastMessage ?? null,
      );
      return {
        id: `${type}-${event.message?.id ?? event.chatId ?? timestamp}-${timestamp}`,
        type,
        description: preview
          ? `${direction} em ${chatName}: ${preview}`
          : `${direction} em ${chatName}`,
        timestamp: this.formatActivityTime(timestamp),
      };
    }

    if (type === 'chat_read') {
      return {
        id: `${type}-${event.chatId ?? timestamp}-${timestamp}`,
        type,
        description: `Conversa marcada como lida: ${chatName}`,
        timestamp: this.formatActivityTime(timestamp),
      };
    }

    if (type === 'history_synced') {
      return {
        id: `${type}-${event.chatId ?? timestamp}-${timestamp}`,
        type,
        description: event.chatId
          ? `Histórico sincronizado para ${chatName}`
          : 'Histórico de conversas sincronizado',
        timestamp: this.formatActivityTime(timestamp),
      };
    }

    return null;
  }

  private activityPreview(value: string | null): string {
    const preview = (value ?? '').trim();
    if (!preview) return '';
    return preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;
  }

  private formatActivityTime(timestamp: number): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  private toEpochMs(timestamp?: number): number {
    if (!timestamp) return Date.now();
    return timestamp > MS_EPOCH_THRESHOLD ? timestamp : timestamp * 1000;
  }
}
