import { httpResource, HttpClient, HttpContext } from '@angular/common/http';
import { SUPPRESS_ERROR_ALERT } from '../../core/http/suppress-error-alert.context';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { InstanceTabsComponent } from './instance-tabs.component';
import { getAvatarColor } from '../../shared/avatar-colors';
import { TuiAlertService } from '@taiga-ui/core';
import { DatePipe } from '@angular/common';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatusResponse {
  name: string;
  connected: boolean;
  startTime: string;
  uptime: number;
  phoneNumber?: string;
}

interface ChatsResponse {
  instance: string;
  total: number;
  chats: ChatItem[];
}

interface ChatItem {
  id: string;
  name?: string;
  lastMessage?: string;
  timestamp?: number;
  unreadCount?: number;
}

// TODO: Replace with real shape once backend exposes per-chat message endpoint
interface MessageItem {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  senderName?: string;
}

interface MessagesResponse {
  messages: MessageItem[];
}

type FilterTab = 'all' | 'unread' | 'direct' | 'groups';

const MAX_BODY = 4096;

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-instance-chats',
  standalone: true,
  imports: [InstanceTabsComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Tab bar — untouched -->
    @if (name(); as n) {
      <app-instance-tabs
        [instanceName]="n"
        [connected]="status()?.connected ?? null"
      />
    }

    <!-- Inbox layout -->
    @if (name(); as n) {
      <div class="inbox" [class.has-selection]="selectedId() !== null">

        <!-- ── LEFT PANE: conversation list ──────────────────── -->
        <aside class="inbox-sidebar" aria-label="Lista de conversas">

          <!-- Header -->
          <div class="sidebar-header">
            <span class="sidebar-label">CONVERSAS</span>
            <span class="sidebar-count" [attr.aria-label]="chatsRes.value().total + ' conversas'">
              {{ chatsRes.value().total }}
            </span>
          </div>

          <!-- Search -->
          <div class="search-wrap">
            <span class="search-icon" aria-hidden="true">
              <!-- Magnifying glass -->
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="search"
              class="search-input"
              placeholder="Buscar conversa…"
              aria-label="Buscar conversa"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
            />
          </div>

          <!-- Filter tabs -->
          <!-- TODO: Wire these filters to actual filtering logic when backend supports it -->
          <div class="filter-tabs" role="tablist" aria-label="Filtrar conversas">
            @for (tab of filterTabs; track tab.id) {
              <button
                type="button"
                role="tab"
                class="filter-tab"
                [class.filter-tab--active]="activeFilter() === tab.id"
                [attr.aria-selected]="activeFilter() === tab.id"
                (click)="activeFilter.set(tab.id)"
              >
                <span>{{ tab.label }}</span>
                @if (tab.id === 'unread' && unreadCount() > 0) {
                  <span class="filter-tab-count" aria-label="Conversas não lidas">{{ unreadCount() }}</span>
                }
              </button>
            }
          </div>

          <!-- Conversation list -->
          <div class="chat-list-wrap">
            @if (chatsRes.isLoading()) {
              <div class="list-state">Carregando conversas…</div>
            } @else if (chatsRes.error()) {
              <div class="list-state list-state--error">Falha ao carregar conversas</div>
            } @else if (filteredChats().length === 0) {
              <div class="list-empty" role="status">
                <!-- MessageSquare icon -->
                <svg class="list-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
                </svg>
                <span class="list-empty-title">Nenhuma conversa ainda</span>
                <span class="list-empty-sub">As conversas aparecerão aqui quando sua instância receber mensagens.</span>
              </div>
            } @else {
              <ul class="chat-list" role="list">
                @for (chat of filteredChats(); track chat.id) {
                  <li role="listitem">
                    <button
                      type="button"
                      class="chat-row"
                      [class.chat-row--selected]="selectedId() === chat.id"
                      (click)="selectChat(chat)"
                      [attr.aria-pressed]="selectedId() === chat.id"
                      [attr.aria-label]="'Abrir conversa com ' + formatChatName(chat)"
                    >
                      <!-- Avatar badge -->
                      <span
                        class="chat-avatar"
                        [style.background]="avatarStyle(chatInitials(chat)).bg"
                        [style.color]="avatarStyle(chatInitials(chat)).text"
                        aria-hidden="true"
                      >
                        <!-- Show unread count if > 0, else initials -->
                        @if (chat.unreadCount && chat.unreadCount > 0) {
                          <span class="chat-avatar-unread">{{ chat.unreadCount }}</span>
                        } @else {
                          {{ chatInitials(chat) }}
                        }
                      </span>

                      <!-- Main content -->
                      <span class="chat-content">
                        <span class="chat-name">{{ formatChatName(chat) }}</span>
                        @if (chat.lastMessage) {
                          <span class="chat-preview">{{ chat.lastMessage }}</span>
                        }
                      </span>

                      <!-- Right meta -->
                      <span class="chat-meta">
                        @if (chat.timestamp) {
                          <span class="chat-time">{{ formatRelativeTime(chat.timestamp) }}</span>
                        }
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        </aside>

        <!-- ── RIGHT PANE: thread view ────────────────────────── -->
        <main class="inbox-thread" aria-label="Thread da conversa" aria-live="polite">

          @if (selectedId() === null) {
            <!-- Empty state: no conversation selected -->
            <div class="thread-empty">
              <svg class="thread-empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
              </svg>
              <p class="thread-empty-title">Selecione uma conversa</p>
              <p class="thread-empty-sub">Escolha um contato à esquerda para ver as mensagens.</p>
            </div>
          } @else {
            <!-- Thread header -->
            <header class="thread-header">
              <!-- Mobile back button -->
              <button
                type="button"
                class="thread-back-btn"
                (click)="clearSelection()"
                aria-label="Voltar para lista de conversas"
              >
                <!-- ArrowLeft icon -->
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
                </svg>
                Voltar
              </button>

              <!-- Avatar + name -->
              <span
                class="chat-avatar chat-avatar--header"
                [style.background]="selectedChat() ? avatarStyle(chatInitials(selectedChat()!)).bg : ''"
                [style.color]="selectedChat() ? avatarStyle(chatInitials(selectedChat()!)).text : ''"
                aria-hidden="true"
              >{{ selectedChat() ? chatInitials(selectedChat()!) : '' }}</span>

              <span class="thread-header-info">
                <span class="thread-header-name">{{ selectedChat() ? formatChatName(selectedChat()!) : '' }}</span>
                <span class="thread-header-id">{{ stripJidSuffix(selectedId() ?? '') }}</span>
              </span>

            </header>

            <!-- Messages area -->
            <div class="messages-area" #messagesArea>
              @if (messagesRes.isLoading()) {
                <div class="messages-state">Carregando mensagens…</div>
              } @else if (messages().length === 0) {
                <!-- Empty thread — backend endpoint may not exist yet for per-chat messages -->
                <!-- TODO: Remove this empty state once GET /api/instances/{name}/chats/{chatId}/messages is implemented -->
                <div class="messages-empty">
                  <svg class="messages-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
                  </svg>
                  <p class="messages-empty-text">Sem mensagens nesta conversa.</p>
                </div>
              } @else {
                <!-- Date separator placeholder -->
                <div class="date-separator">
                  <span class="date-sep-pill">{{ today() }}</span>
                </div>

                <!-- Message bubbles -->
                @for (msg of messages(); track msg.id) {
                  <div class="bubble-wrap" [class.bubble-wrap--out]="msg.fromMe">
                    <div class="bubble" [class.bubble--out]="msg.fromMe" [class.bubble--in]="!msg.fromMe">
                      @if (msg.fromMe && msg.senderName) {
                        <span class="bubble-sender">{{ msg.senderName }}</span>
                      }
                      <p class="bubble-body">{{ msg.body }}</p>
                      <span class="bubble-footer">
                        <span class="bubble-time">{{ msg.timestamp * 1000 | date:'HH:mm' }}</span>
                        @if (msg.fromMe) {
                          <!-- CheckCheck icon (read receipt) -->
                          <svg class="bubble-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Enviado">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5M9 12l2.25 2.25 4.5-6.75"/>
                          </svg>
                        }
                      </span>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Composer bar -->
            <div class="composer-bar">
              <div class="composer-inner">
                <!-- Attachment button (disabled) -->
                <button
                  type="button"
                  class="composer-attach"
                  disabled
                  title="Em breve"
                  aria-label="Anexar arquivo (em breve)"
                >
                  <!-- Paperclip icon -->
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                  </svg>
                </button>

                <!-- Growing textarea -->
                <textarea
                  #composerTextarea
                  class="composer-textarea"
                  placeholder="Digite sua mensagem…"
                  aria-label="Digite sua mensagem"
                  rows="1"
                  [value]="composerText()"
                  (input)="onComposerInput($event)"
                  (keydown)="onComposerKeydown($event)"
                  [disabled]="sending()"
                ></textarea>

                <!-- Send button -->
                <button
                  type="button"
                  class="composer-send"
                  (click)="sendMessage()"
                  [disabled]="composerText().trim().length === 0 || sending()"
                  aria-label="Enviar mensagem"
                  [attr.aria-busy]="sending()"
                >
                  @if (sending()) {
                    <span class="composer-spinner" aria-hidden="true"></span>
                  } @else {
                    <!-- Send (paper-plane) icon -->
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                    </svg>
                  }
                </button>
              </div>

              <!-- Hints row -->
              <div class="composer-hints">
                <span>Enter para enviar · Shift+Enter para quebrar linha</span>
                @if (composerText().length > 500) {
                  <span class="composer-char-count" [class.composer-char-count--warn]="composerText().length > 3800">
                    {{ composerText().length }} / {{ maxBody }}
                  </span>
                }
              </div>
            </div>
          }
        </main>
      </div>
    }
  `,
  styles: [`
    /* ── Host ────────────────────────────────────────────────────── */
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      font-family: var(--font-sans);
    }

    /* ── Inbox shell ─────────────────────────────────────────────── */
    .inbox {
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Left sidebar ────────────────────────────────────────────── */
    .inbox-sidebar {
      width: 340px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--color-outline-variant);
      background: var(--color-surface-container-lowest);
      overflow: hidden;
    }

    /* Sidebar header row */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1rem 0.625rem;
      flex-shrink: 0;
    }
    .sidebar-label {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
    }
    .sidebar-count {
      font-size: 0.6875rem;
      font-weight: 600;
      font-feature-settings: "tnum";
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container);
      border-radius: var(--radius-full);
      padding: 0.1rem 0.5rem;
      min-width: 1.5rem;
      text-align: center;
    }

    /* Search bar */
    .search-wrap {
      position: relative;
      padding: 0 0.75rem 0.5rem;
      flex-shrink: 0;
    }
    .search-icon {
      position: absolute;
      left: 1.25rem;
      top: 50%;
      transform: translateY(-60%);
      color: var(--color-on-surface-variant);
      pointer-events: none;
      display: flex;
      align-items: center;
    }
    .search-input {
      width: 100%;
      padding: 0.5rem 0.75rem 0.5rem 2.125rem;
      background: var(--color-surface-container-low);
      border: 1px solid transparent;
      border-radius: var(--radius-full);
      font-family: var(--font-sans);
      font-size: 0.8125rem;
      color: var(--color-on-surface);
      outline: none;
      box-sizing: border-box;
      transition: border-color var(--duration-fast) var(--ease-default),
                  box-shadow var(--duration-fast) var(--ease-default);
    }
    .search-input::placeholder { color: var(--color-on-surface-variant); opacity: 0.7; }
    .search-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    /* Filter tabs */
    .filter-tabs {
      display: flex;
      gap: 0.25rem;
      padding: 0 0.75rem 0.625rem;
      flex-shrink: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .filter-tabs::-webkit-scrollbar { display: none; }

    .filter-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      border: none;
      border-radius: var(--radius-full);
      font-family: var(--font-sans);
      font-size: 0.75rem;
      font-weight: 500;
      background: transparent;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--duration-fast) var(--ease-default),
                  color var(--duration-fast) var(--ease-default);
      min-height: 0; /* override global 44px on mobile */
    }
    .filter-tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.125rem;
      height: 1.125rem;
      padding: 0 0.3125rem;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--color-primary) 18%, transparent);
      color: color-mix(in srgb, var(--color-primary) 85%, var(--color-on-surface));
      font-size: 0.625rem;
      font-weight: 600;
      font-feature-settings: "tnum";
    }
    .filter-tab--active .filter-tab-count {
      background: color-mix(in srgb, var(--color-on-primary) 22%, transparent);
      color: var(--color-on-primary);
    }
    .filter-tab:hover:not(.filter-tab--active) {
      background: var(--color-surface-container-low);
      color: var(--color-on-surface);
    }
    .filter-tab--active {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .filter-tab:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* Chat list wrapper */
    .chat-list-wrap {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-outline-variant) transparent;
    }

    .list-state {
      padding: 2rem 1rem;
      text-align: center;
      font-size: 0.875rem;
      color: var(--color-on-surface-variant);
    }
    .list-state--error { color: var(--color-error); }

    .list-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1.5rem;
      text-align: center;
      gap: 0.5rem;
    }
    .list-empty-icon { color: var(--color-on-surface-variant); opacity: 0.35; margin-bottom: 0.5rem; }
    .list-empty-title { font-size: 0.9375rem; font-weight: 600; color: var(--color-on-surface); }
    .list-empty-sub { font-size: 0.8125rem; color: var(--color-on-surface-variant); line-height: 1.4; }

    /* The list itself */
    .chat-list {
      list-style: none;
      margin: 0;
      padding: 0.25rem 0;
    }

    /* Chat row button */
    .chat-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.875rem;
      border: none;
      border-left: 2px solid transparent;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font-family: var(--font-sans);
      transition: background var(--duration-fast) var(--ease-default),
                  border-left-color var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .chat-row:hover {
      background: var(--color-surface-container-low);
    }
    .chat-row--selected {
      background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-container-lowest));
      border-left-color: var(--color-primary);
    }
    .chat-row:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    /* Chat avatar circle */
    .chat-avatar {
      width: 2.625rem;
      height: 2.625rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 700;
      flex-shrink: 0;
      font-feature-settings: "tnum";
      position: relative;
    }
    .chat-avatar--header {
      width: 2.25rem;
      height: 2.25rem;
      font-size: 0.75rem;
    }
    .chat-avatar-unread {
      font-size: 0.75rem;
      font-weight: 800;
      font-feature-settings: "tnum";
      line-height: 1;
    }

    /* Chat content */
    .chat-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .chat-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .chat-preview {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    /* Chat meta (time) */
    .chat-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
      flex-shrink: 0;
    }
    .chat-time {
      font-size: 0.6875rem;
      color: var(--color-on-surface-variant);
      font-feature-settings: "tnum";
    }

    /* ── Right thread pane ───────────────────────────────────────── */
    .inbox-thread {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-surface);
    }

    /* Thread empty state */
    .thread-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      text-align: center;
      padding: 2rem;
      color: var(--color-on-surface-variant);
    }
    .thread-empty-icon { opacity: 0.3; margin-bottom: 0.25rem; }
    .thread-empty-title {
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--color-on-surface);
      margin: 0;
    }
    .thread-empty-sub {
      font-size: 0.875rem;
      margin: 0;
      line-height: 1.4;
    }

    /* Thread header */
    .thread-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: var(--color-surface-container-lowest);
      border-bottom: 1px solid var(--color-outline-variant);
      flex-shrink: 0;
    }
    .thread-back-btn {
      display: none; /* shown only on mobile via .has-selection */
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-on-surface-variant);
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: var(--font-sans);
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-md);
      min-height: 0;
    }
    .thread-back-btn:hover { color: var(--color-on-surface); background: var(--color-surface-container-low); }
    .thread-back-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

    .thread-header-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .thread-header-name {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .thread-header-id {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .thread-agent-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-outline-variant));
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 600;
      color: color-mix(in srgb, var(--color-primary) 80%, var(--color-on-surface));
      flex-shrink: 0;
      white-space: nowrap;
    }
    .thread-agent-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-primary);
      flex-shrink: 0;
    }

    /* ── Messages area ───────────────────────────────────────────── */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      background: var(--color-surface-container-lowest);
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      scrollbar-width: thin;
      scrollbar-color: var(--color-outline-variant) transparent;
    }

    .messages-state {
      text-align: center;
      padding: 3rem 1rem;
      font-size: 0.875rem;
      color: var(--color-on-surface-variant);
    }

    .messages-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      text-align: center;
      padding: 3rem 1.5rem;
    }
    .messages-empty-icon { opacity: 0.3; color: var(--color-on-surface-variant); }
    .messages-empty-text {
      font-size: 0.9375rem;
      color: var(--color-on-surface-variant);
      margin: 0;
    }

    /* Date separator */
    .date-separator {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0.75rem 0;
    }
    .date-sep-pill {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--color-on-surface-variant);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-full);
      padding: 0.15rem 0.625rem;
      background: var(--color-surface-container-lowest);
    }

    /* Bubble wrappers */
    .bubble-wrap {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 0.375rem;
    }
    .bubble-wrap--out { justify-content: flex-end; }

    /* Bubbles */
    .bubble {
      max-width: 60%;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-2xl);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .bubble--in {
      background: var(--color-surface-container);
      border-bottom-left-radius: var(--radius-sm);
    }
    .bubble--out {
      background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-container-lowest));
      border-bottom-right-radius: var(--radius-sm);
    }

    .bubble-sender {
      font-size: 0.6875rem;
      font-weight: 700;
      color: color-mix(in srgb, var(--color-primary) 75%, var(--color-on-surface));
    }
    .bubble-body {
      font-size: 0.875rem;
      line-height: 1.45;
      color: var(--color-on-surface);
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .bubble-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.2rem;
      margin-top: 0.125rem;
    }
    .bubble-time {
      font-size: 0.625rem;
      color: var(--color-on-surface-variant);
      font-feature-settings: "tnum";
    }
    .bubble-check {
      color: color-mix(in srgb, var(--color-primary) 70%, var(--color-on-surface-variant));
      flex-shrink: 0;
    }

    /* ── Composer bar ────────────────────────────────────────────── */
    .composer-bar {
      flex-shrink: 0;
      background: var(--color-surface-container-lowest);
      border-top: 1px solid var(--color-outline-variant);
      padding: 0.75rem 1rem 0.5rem;
    }
    .composer-inner {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .composer-attach {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--color-on-surface-variant);
      flex-shrink: 0;
      cursor: not-allowed;
      opacity: 0.45;
      min-height: 0;
    }

    .composer-textarea {
      flex: 1;
      min-height: 2.25rem;
      max-height: 120px;
      padding: 0.5rem 0.75rem;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-xl);
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      color: var(--color-on-surface);
      resize: none;
      outline: none;
      overflow-y: auto;
      line-height: 1.45;
      transition: border-color var(--duration-fast) var(--ease-default),
                  box-shadow var(--duration-fast) var(--ease-default);
      box-sizing: border-box;
    }
    .composer-textarea::placeholder { color: var(--color-on-surface-variant); opacity: 0.6; }
    .composer-textarea:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
    .composer-textarea:disabled { opacity: 0.5; cursor: not-allowed; }

    .composer-send {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      color: var(--color-on-primary);
      border: none;
      border-radius: var(--radius-full);
      flex-shrink: 0;
      cursor: pointer;
      transition: opacity var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .composer-send:hover:not(:disabled) { opacity: 0.85; }
    .composer-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .composer-send:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .composer-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid color-mix(in srgb, var(--color-on-primary) 35%, transparent);
      border-top-color: var(--color-on-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .composer-hints {
      display: flex;
      justify-content: space-between;
      font-size: 0.6875rem;
      color: var(--color-on-surface-variant);
      margin-top: 0.375rem;
      padding: 0 0.25rem;
    }
    .composer-char-count {
      font-feature-settings: "tnum";
      font-weight: 500;
    }
    .composer-char-count--warn { color: var(--color-method-patch); }

    /* ── Mobile: split-pane via .has-selection ───────────────────── */
    @media (max-width: 768px) {
      .inbox-sidebar {
        width: 100%;
        position: absolute;
        inset: 0;
        z-index: 1;
        transition: transform var(--duration-normal) var(--ease-out);
      }
      .inbox-thread {
        width: 100%;
        position: absolute;
        inset: 0;
        z-index: 2;
        transform: translateX(100%);
        transition: transform var(--duration-normal) var(--ease-out);
      }

      /* When a conversation is selected: slide list out, thread in */
      .inbox.has-selection .inbox-sidebar {
        transform: translateX(-100%);
      }
      .inbox.has-selection .inbox-thread {
        transform: translateX(0);
      }

      /* inbox must be positioned so children can be absolute */
      .inbox {
        position: relative;
      }

      /* Show back button on mobile */
      .thread-back-btn {
        display: inline-flex;
      }

      /* Bubbles wider on small screens */
      .bubble { max-width: 85%; }
    }
  `],
})
export class InstanceChatsComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(TuiAlertService);

  @ViewChild('composerTextarea') composerTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly name = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('name'))),
    { initialValue: null as string | null },
  );

  readonly status = signal<StatusResponse | null>(null);

  // ── Chat list ──────────────────────────────────────────────────────────────

  readonly chatsRes = httpResource<ChatsResponse>(() => {
    const n = this.name();
    return n
      ? `/api/instances/${encodeURIComponent(n)}/chats?include_messages=false`
      : undefined;
  }, { defaultValue: { instance: '', total: 0, chats: [] } });

  // ── Selection state ────────────────────────────────────────────────────────

  /** ID of the currently-selected chat, or null when nothing is selected. */
  readonly selectedId = signal<string | null>(null);

  readonly selectedChat = computed<ChatItem | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.chatsRes.value().chats.find((c) => c.id === id) ?? null;
  });

  selectChat(chat: ChatItem): void {
    this.selectedId.set(chat.id);
    this.composerText.set('');

    // Clear unread locally for instant feedback
    if (chat.unreadCount && chat.unreadCount > 0) {
      chat.unreadCount = 0;
    }

    // Persist read status to backend (fire-and-forget)
    const n = this.name();
    if (n && chat.id) {
      this.http.post(
        `/api/instances/${encodeURIComponent(n)}/chats/${encodeURIComponent(chat.id)}/read`,
        {},
      ).subscribe();
    }

    setTimeout(() => this.scrollToBottom(), 50);
  }

  clearSelection(): void {
    this.selectedId.set(null);
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  readonly filterTabs: Array<{ id: FilterTab; label: string }> = [
    { id: 'all',    label: 'Todas' },
    { id: 'unread', label: 'Não lidas' },
    { id: 'direct', label: 'Diretas' },
    { id: 'groups', label: 'Grupos' },
  ];

  readonly activeFilter = signal<FilterTab>('all');

  readonly searchQuery = signal('');

  readonly unreadCount = computed(() =>
    this.chatsRes.value().chats.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
  );

  readonly filteredChats = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const tab = this.activeFilter();
    const all = this.chatsRes.value().chats;

    const byTab = all.filter((c) => {
      switch (tab) {
        case 'unread': return (c.unreadCount ?? 0) > 0;
        case 'direct': return !this.isGroupChat(c);
        case 'groups': return this.isGroupChat(c);
        default:       return true;
      }
    });

    if (!q) return byTab;
    return byTab.filter((c) => {
      const haystack = `${c.name ?? ''} ${c.id ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  private isGroupChat(chat: { id?: string; isGroup?: boolean }): boolean {
    if (typeof chat.isGroup === 'boolean') return chat.isGroup;
    return (chat.id ?? '').endsWith('@g.us');
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  /**
   * TODO: Backend endpoint GET /api/instances/{name}/chats/{chatId}/messages
   * may not exist yet. When it 404s or returns empty, we show the empty state.
   * Replace this placeholder httpResource when the endpoint is available.
   */
  readonly messagesRes = httpResource<MessagesResponse>(
    () => {
      const n = this.name();
      const id = this.selectedId();
      if (!n || !id) return undefined;
      return {
        url: `/api/instances/${encodeURIComponent(n)}/chats/${encodeURIComponent(id)}/messages`,
        context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true),
      };
    },
    { defaultValue: { messages: [] } },
  );

  /** Local messages signal — merged from API + optimistic appends */
  readonly localMessages = signal<MessageItem[]>([]);

  readonly messages = computed<MessageItem[]>(() => {
    const fromApi = this.messagesRes.value().messages;
    const local = this.localMessages();
    // When API returns data, start from it; local additions are layered on top
    return [...fromApi, ...local];
  });

  // ── Composer ───────────────────────────────────────────────────────────────

  readonly composerText = signal('');
  readonly sending = signal(false);
  readonly maxBody = MAX_BODY;

  onComposerInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.composerText.set(el.value);
    // Auto-grow up to 120px
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }

  async sendMessage(): Promise<void> {
    const body = this.composerText().trim();
    const instanceName = this.name();
    const chatId = this.selectedId();

    if (!body || !instanceName || !chatId || this.sending()) return;

    this.sending.set(true);
    const to = chatId.split('@')[0]; // strip @s.whatsapp.net

    // Optimistic append
    const optimisticMsg: MessageItem = {
      id: `local-${Date.now()}`,
      body,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.localMessages.update((msgs) => [...msgs, optimisticMsg]);
    this.composerText.set('');

    // Reset textarea height
    if (this.composerTextareaRef) {
      this.composerTextareaRef.nativeElement.value = '';
      this.composerTextareaRef.nativeElement.style.height = 'auto';
    }

    setTimeout(() => this.scrollToBottom(), 30);

    try {
      await firstValueFrom(
        this.http.post(
          `/api/instances/${encodeURIComponent(instanceName)}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body },
          },
        ),
      );
    } catch {
      // Interceptor shows error toast. Roll back optimistic message.
      this.localMessages.update((msgs) =>
        msgs.filter((m) => m.id !== optimisticMsg.id),
      );
    } finally {
      this.sending.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  readonly today = computed(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  chatInitials(chat: ChatItem): string {
    const name = chat.name ?? chat.id ?? '';
    return name
      .split(/[@\s]/)
      .map((p: string) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  }

  formatChatName(chat: ChatItem): string {
    const name: string = chat.name ?? chat.id ?? '';
    return name
      .replace(/@s\.whatsapp\.net$/, '')
      .replace(/@g\.us$/, ' (grupo)')
      .replace(/@[\w.-]+$/, '');
  }

  stripJidSuffix(jid: string): string {
    return jid.replace(/@[\w.-]+$/, '');
  }

  formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp * 1000;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const months = Math.floor(days / 30);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    if (hours < 24) return `há ${hours}h`;
    if (days < 7) return `há ${days}d`;
    if (months < 1) return `há ${days}d`;
    if (months === 1) return 'há 1 mês';
    return `há ${months} meses`;
  }

  avatarStyle(initials: string): { bg: string; text: string } {
    return getAvatarColor(initials);
  }

  private scrollToBottom(): void {
    // Scroll the messages area to the bottom after new message
    const el = document.querySelector('.messages-area');
    if (el) el.scrollTop = el.scrollHeight;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('name')),
        takeUntilDestroyed(),
      )
      .subscribe((instanceName) => {
        if (!instanceName) return;
        void firstValueFrom(
          this.http.get<StatusResponse>(
            `/api/instances/${encodeURIComponent(instanceName)}/status`,
            { context: new HttpContext().set(SUPPRESS_ERROR_ALERT, true) },
          ),
        )
          .then((s) => this.status.set(s))
          .catch(() => this.status.set(null));
      });
  }
}
