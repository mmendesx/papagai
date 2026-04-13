import { httpResource, HttpClient, HttpContext } from '@angular/common/http';
import { SUPPRESS_ERROR_ALERT } from '../../core/http/suppress-error-alert.context';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  signal,
  ViewChild,
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
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { fetchEventSource } from '@microsoft/fetch-event-source';
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
  isGroup?: boolean;
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
  type?: string;
  mediaUrl?: string;
  caption?: string;
  interactiveButtons?: string[]; // labels of buttons for interactive messages
}

interface MessagesResponse {
  messages: MessageItem[];
}

interface SendMessageResponse {
  messages?: Array<{ id?: string }>;
}

interface ChatRealtimeEvent {
  type: 'chat_updated' | 'chat_read' | 'history_synced' | 'heartbeat';
  chatId?: string;
  timestamp: number;
  chat?: {
    id: string;
    name: string | null;
    isGroup: boolean;
    lastMessage: string | null;
    lastMessageAt: number;
    unreadCount: number;
  };
  message?: {
    id: string;
    chatId: string;
    fromMe: boolean;
    sender: string | null;
    body: string | null;
    timestamp: number;
    type?: string;
    interactiveButtons?: string[];
  };
}

type FilterTab = 'all' | 'direct' | 'groups';

type InteractiveType = 'button' | 'list' | 'cta_url' | 'cta_copy';

interface ButtonRow { label: string; }
interface ListRow { title: string; description: string; }

const MAX_BODY = 4096;
const TOKEN_KEY = 'papagai_access_token';
const FALLBACK_REFRESH_INTERVAL_MS = 30000;
const STREAM_RETRY_DELAY_MS = 2000;
const RELOAD_COALESCE_MS = 250;
const MS_EPOCH_THRESHOLD = 1_000_000_000_000;

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-instance-chats',
  standalone: true,
  imports: [InstanceTabsComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('messageIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' }),
        animate('200ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ])
    ]),
    trigger('chatListItem', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-8px)' }),
        animate('200ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('panelSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(20px)' }),
        animate('250ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateX(20px)' }))
      ])
    ]),
    trigger('staggerMessages', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          stagger('30ms', [animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))])
        ], { optional: true })
      ])
    ]),
  ],
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
            <span class="sidebar-count" [attr.aria-label]="chats().length + ' conversas'">
              {{ chats().length }}
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
                  <li role="listitem" [@chatListItem]>
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
                        {{ chatInitials(chat) }}
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
                        @if ((chat.unreadCount ?? 0) > 0) {
                          <span class="chat-unread-count" aria-label="Mensagens não lidas">{{ chat.unreadCount }}</span>
                        } @else if (chat.timestamp) {
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
            <div class="thread-panel" [@panelSlide]>
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
            <div class="messages-area" #messagesArea [@staggerMessages]="messages().length" (click)="closeReactionPicker()">
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
                  <div class="bubble-wrap" [class.bubble-wrap--out]="msg.fromMe" [@messageIn]>
                    <div class="bubble-and-reaction">

                      <!-- React button (only for received messages) -->
                      @if (!msg.fromMe) {
                        <button
                          type="button"
                          class="bubble-react-btn"
                          (click)="toggleReactionPicker(msg.id, $event)"
                          [class.bubble-react-btn--open]="reactionPickerForId() === msg.id"
                          title="Reagir"
                          aria-label="Reagir a esta mensagem"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path stroke-linecap="round" d="M8 13s1.5 2 4 2 4-2 4-2"/>
                            <line x1="9" y1="9" x2="9.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
                            <line x1="15" y1="9" x2="15.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
                          </svg>
                        </button>
                      }

                      <!-- Mini reaction picker -->
                      @if (reactionPickerForId() === msg.id) {
                        <div class="reaction-picker" role="dialog" aria-label="Escolher reação">
                          @for (emoji of REACTIONS; track emoji) {
                            <button
                              type="button"
                              class="reaction-option"
                              (click)="sendReaction(msg, emoji)"
                              [attr.aria-label]="'Reagir com ' + emoji"
                              [title]="emoji"
                            >{{ emoji }}</button>
                          }
                        </div>
                      }

                      <!-- Main bubble -->
                      <div class="bubble" [class.bubble--out]="msg.fromMe" [class.bubble--in]="!msg.fromMe">
                        @if (msg.fromMe && msg.senderName) {
                          <span class="bubble-sender">{{ msg.senderName }}</span>
                        }
                        <!-- Image / Sticker -->
                        @if (msg.type === 'image' || msg.type === 'sticker') {
                          @if (msg.mediaUrl) {
                            <div class="bubble-media">
                              <img
                                class="bubble-image"
                                [src]="msg.mediaUrl"
                                [alt]="msg.caption || 'Imagem'"
                                (click)="openLightbox(msg.mediaUrl)"
                                style="cursor: pointer;"
                              />
                              @if (msg.caption) {
                                <p class="bubble-caption">{{ msg.caption }}</p>
                              }
                            </div>
                          } @else {
                            <p class="bubble-body bubble-media-placeholder">{{ msg.type === 'sticker' ? '🖼️ Figurinha' : '📷 Imagem' }}</p>
                          }
                        }
                        <!-- Video -->
                        @else if (msg.type === 'video') {
                          @if (msg.mediaUrl) {
                            <div class="bubble-media">
                              <video
                                class="bubble-video"
                                [src]="msg.mediaUrl"
                                controls
                                aria-label="Vídeo"
                              ></video>
                              @if (msg.caption) {
                                <p class="bubble-caption">{{ msg.caption }}</p>
                              }
                            </div>
                          } @else {
                            <p class="bubble-body bubble-media-placeholder">🎬 Vídeo</p>
                          }
                        }
                        <!-- Audio -->
                        @else if (msg.type === 'audio') {
                          @if (msg.mediaUrl) {
                            <audio
                              class="bubble-audio"
                              [src]="msg.mediaUrl"
                              controls
                              aria-label="Áudio"
                            ></audio>
                          } @else {
                            <p class="bubble-body bubble-media-placeholder">🎵 Áudio</p>
                          }
                        }
                        <!-- Document -->
                        @else if (msg.type === 'document') {
                          @if (msg.mediaUrl) {
                            <a
                              class="bubble-document"
                              [href]="msg.mediaUrl"
                              target="_blank"
                              rel="noopener"
                              [attr.aria-label]="'Baixar ' + (msg.body || 'documento')"
                            >
                              <!-- Document icon -->
                              <svg class="bubble-doc-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                              </svg>
                              <span class="bubble-doc-name">{{ msg.body || 'Documento' }}</span>
                            </a>
                          } @else {
                            <p class="bubble-body bubble-media-placeholder">📄 {{ msg.body || 'Documento' }}</p>
                          }
                        }
                        <!-- Interactive -->
                        @else if (msg.type === 'interactive') {
                          <div class="bubble-interactive">
                            <p class="bubble-body">{{ msg.body }}</p>
                            @if (msg.interactiveButtons && msg.interactiveButtons.length > 0) {
                              <div class="bubble-interactive-buttons">
                                @for (btn of msg.interactiveButtons; track btn) {
                                  <span class="bubble-interactive-chip">{{ btn }}</span>
                                }
                              </div>
                            }
                          </div>
                        }
                        <!-- Reaction (shouldn't render as a bubble, but just in case) -->
                        @else if (msg.type === 'reaction') {
                          <!-- reaction: not rendered as a message bubble -->
                        }
                        <!-- Unsupported / unknown type -->
                        @else if (msg.type && msg.type !== 'text') {
                          <em class="bubble-unsupported">Mensagem não suportada</em>
                        }
                        <!-- Default text -->
                        @else {
                          <p class="bubble-body">{{ msg.body }}</p>
                        }
                        <span class="bubble-footer">
                          <span class="bubble-time">{{ msg.timestamp * 1000 | date:'HH:mm' }}</span>
                          @if (msg.fromMe) {
                            <!-- CheckCheck icon (read receipt) -->
                            <svg class="bubble-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Enviado">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5M9 12l2.25 2.25 4.5-6.75"/>
                            </svg>
                          }
                        </span>

                        <!-- Reaction badge -->
                        @if (localReactions().get(msg.id); as reaction) {
                          <span class="reaction-badge" [attr.aria-label]="'Sua reação: ' + reaction">
                            {{ reaction }}
                          </span>
                        }
                      </div>

                    </div>
                  </div>
                }
              }
            </div>

            <!-- Composer bar -->
            <div class="composer-bar">
              <!-- Emoji picker overlay -->
              @if (showEmojiPicker()) {
                <div
                  class="emoji-overlay-backdrop"
                  (click)="closeEmojiPicker()"
                  aria-hidden="true"
                ></div>
                <div class="emoji-picker" role="dialog" aria-label="Selecionar emoji">
                  @for (group of emojiGroups; track group.label) {
                    <div class="emoji-group">
                      <span class="emoji-group-label">{{ group.label }}</span>
                      <div class="emoji-grid">
                        @for (emoji of group.emojis; track emoji) {
                          <button
                            type="button"
                            class="emoji-btn"
                            (click)="insertEmoji(emoji)"
                            [attr.aria-label]="emoji"
                            [title]="emoji"
                          >{{ emoji }}</button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              @if (pendingAttachment(); as file) {
                <div class="attachment-preview">
                  @if (attachmentPreviewUrl(); as previewUrl) {
                    <img
                      class="attachment-thumb"
                      [src]="previewUrl"
                      [alt]="file.name"
                      aria-hidden="true"
                    />
                  } @else {
                    <span class="attachment-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                      </svg>
                    </span>
                  }
                  <span class="attachment-name">{{ file.name }}</span>
                  <button
                    type="button"
                    class="attachment-remove"
                    (click)="clearAttachment()"
                    aria-label="Remover arquivo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              }
              <div class="composer-inner">
                <!-- Hidden file input -->
                <input
                  #fileInput
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/ogg,audio/mpeg,audio/aac"
                  style="display:none"
                  aria-hidden="true"
                  (change)="onFileSelected($event)"
                />

                <!-- Emoji button -->
                <button
                  type="button"
                  class="composer-emoji-btn"
                  [class.composer-emoji-btn--active]="showEmojiPicker()"
                  (click)="toggleEmojiPicker()"
                  title="Inserir emoji"
                  aria-label="Inserir emoji"
                  [attr.aria-expanded]="showEmojiPicker()"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <circle cx="12" cy="12" r="10"/>
                    <path stroke-linecap="round" d="M8 13s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
                    <line x1="15" y1="9" x2="15.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
                  </svg>
                </button>

                <!-- Attachment button -->
                <button
                  type="button"
                  class="composer-attach"
                  [class.composer-attach--active]="pendingAttachment() !== null"
                  (click)="openFilePicker()"
                  title="Anexar arquivo"
                  aria-label="Anexar arquivo"
                >
                  <!-- Paperclip icon -->
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                  </svg>
                </button>

                <!-- Interactive message builder button -->
                <button
                  type="button"
                  class="composer-interactive-btn"
                  (click)="openInteractiveDialog()"
                  title="Mensagem interativa"
                  aria-label="Criar mensagem interativa"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>
                  </svg>
                </button>

                <!-- Growing textarea -->
                <textarea
                  #composerTextarea
                  class="composer-textarea"
                  [placeholder]="pendingAttachment() ? 'Adicionar legenda…' : 'Digite sua mensagem…'"
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
                  [disabled]="(composerText().trim().length === 0 && pendingAttachment() === null) || sending()"
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
            </div>
          }
        </main>
      </div>

      <!-- Lightbox -->
      @if (lightboxUrl(); as url) {
        <div
          class="lightbox-backdrop"
          (click)="closeLightbox()"
          role="dialog"
          aria-label="Visualizar imagem"
          aria-modal="true"
        >
          <img
            class="lightbox-img"
            [src]="url"
            alt="Imagem ampliada"
            (click)="$event.stopPropagation()"
          />
          <button
            type="button"
            class="lightbox-close"
            (click)="closeLightbox()"
            aria-label="Fechar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      }

      <!-- Interactive message builder dialog -->
      @if (showInteractiveDialog()) {
        <div class="interactive-dialog-backdrop" (click)="closeInteractiveDialog()" role="dialog" aria-label="Criar mensagem interativa" aria-modal="true">
          <div class="interactive-dialog" (click)="$event.stopPropagation()">

            <!-- Header -->
            <div class="idialog-header">
              <h2 class="idialog-title">Mensagem Interativa</h2>
              <button type="button" class="idialog-close" (click)="closeInteractiveDialog()" aria-label="Fechar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Type selector tabs -->
            <div class="idialog-tabs" role="tablist">
              @for (tab of interactiveTypeTabs; track tab.value) {
                <button
                  type="button"
                  role="tab"
                  class="idialog-tab"
                  [class.idialog-tab--active]="interactiveType() === tab.value"
                  (click)="interactiveType.set(tab.value); interactiveErrors.set({})"
                >{{ tab.label }}</button>
              }
            </div>

            <!-- Body (common) -->
            <div class="idialog-field">
              <label class="idialog-label">Texto do corpo <span class="idialog-required">*</span></label>
              <textarea
                class="idialog-textarea"
                placeholder="Digite a mensagem principal…"
                [value]="interactiveBody()"
                (input)="interactiveBody.set($any($event.target).value)"
                rows="3"
                maxlength="1024"
              ></textarea>
              @if (interactiveErrors()['body']) {
                <span class="idialog-error">{{ interactiveErrors()['body'] }}</span>
              }
            </div>

            <!-- Footer (common, optional) -->
            <div class="idialog-field">
              <label class="idialog-label">Rodapé <span class="idialog-optional">(opcional)</span></label>
              <input
                type="text"
                class="idialog-input"
                placeholder="Texto do rodapé…"
                [value]="interactiveFooter()"
                (input)="interactiveFooter.set($any($event.target).value)"
                maxlength="60"
              />
            </div>

            <!-- Type-specific fields -->
            @if (interactiveType() === 'button') {
              <div class="idialog-section">
                <div class="idialog-section-header">
                  <span class="idialog-label">Botões</span>
                  @if (interactiveButtons().length < 3) {
                    <button type="button" class="idialog-add-btn" (click)="addInteractiveButton()">+ Adicionar</button>
                  }
                </div>
                @for (btn of interactiveButtons(); track $index) {
                  <div class="idialog-row">
                    <input
                      type="text"
                      class="idialog-input"
                      [placeholder]="'Botão ' + ($index + 1)"
                      [value]="btn.label"
                      (input)="updateInteractiveButton($index, $any($event.target).value)"
                      maxlength="20"
                    />
                    @if (interactiveButtons().length > 1) {
                      <button type="button" class="idialog-remove-btn" (click)="removeInteractiveButton($index)" aria-label="Remover botão">×</button>
                    }
                  </div>
                }
                @if (interactiveErrors()['buttons']) {
                  <span class="idialog-error">{{ interactiveErrors()['buttons'] }}</span>
                }
              </div>
            }

            @if (interactiveType() === 'list') {
              <div class="idialog-section">
                <div class="idialog-field">
                  <label class="idialog-label">Texto do botão da lista <span class="idialog-required">*</span></label>
                  <input
                    type="text"
                    class="idialog-input"
                    placeholder="Ex: Escolher opção"
                    [value]="interactiveListButtonLabel()"
                    (input)="interactiveListButtonLabel.set($any($event.target).value)"
                    maxlength="20"
                  />
                  @if (interactiveErrors()['listButton']) {
                    <span class="idialog-error">{{ interactiveErrors()['listButton'] }}</span>
                  }
                </div>
                <div class="idialog-section-header">
                  <span class="idialog-label">Opções</span>
                  @if (interactiveListRows().length < 10) {
                    <button type="button" class="idialog-add-btn" (click)="addListRow()">+ Adicionar</button>
                  }
                </div>
                @for (row of interactiveListRows(); track $index) {
                  <div class="idialog-list-row">
                    <div class="idialog-list-row-fields">
                      <input
                        type="text"
                        class="idialog-input"
                        [placeholder]="'Título ' + ($index + 1)"
                        [value]="row.title"
                        (input)="updateListRowTitle($index, $any($event.target).value)"
                        maxlength="24"
                      />
                      <input
                        type="text"
                        class="idialog-input idialog-input--small"
                        placeholder="Descrição (opcional)"
                        [value]="row.description"
                        (input)="updateListRowDescription($index, $any($event.target).value)"
                        maxlength="72"
                      />
                    </div>
                    @if (interactiveListRows().length > 1) {
                      <button type="button" class="idialog-remove-btn" (click)="removeListRow($index)" aria-label="Remover opção">×</button>
                    }
                  </div>
                }
                @if (interactiveErrors()['rows']) {
                  <span class="idialog-error">{{ interactiveErrors()['rows'] }}</span>
                }
              </div>
            }

            @if (interactiveType() === 'cta_url') {
              <div class="idialog-section">
                <div class="idialog-field">
                  <label class="idialog-label">Texto do botão <span class="idialog-required">*</span></label>
                  <input
                    type="text"
                    class="idialog-input"
                    placeholder="Ex: Visitar site"
                    [value]="interactiveCtaText()"
                    (input)="interactiveCtaText.set($any($event.target).value)"
                    maxlength="25"
                  />
                  @if (interactiveErrors()['ctaText']) {
                    <span class="idialog-error">{{ interactiveErrors()['ctaText'] }}</span>
                  }
                </div>
                <div class="idialog-field">
                  <label class="idialog-label">URL <span class="idialog-required">*</span></label>
                  <input
                    type="url"
                    class="idialog-input"
                    placeholder="https://exemplo.com"
                    [value]="interactiveCtaUrl()"
                    (input)="interactiveCtaUrl.set($any($event.target).value)"
                  />
                  @if (interactiveErrors()['ctaUrl']) {
                    <span class="idialog-error">{{ interactiveErrors()['ctaUrl'] }}</span>
                  }
                </div>
              </div>
            }

            @if (interactiveType() === 'cta_copy') {
              <div class="idialog-section">
                <div class="idialog-field">
                  <label class="idialog-label">Código para copiar <span class="idialog-required">*</span></label>
                  <input
                    type="text"
                    class="idialog-input"
                    placeholder="Ex: DESCONTO50"
                    [value]="interactiveCopyCode()"
                    (input)="interactiveCopyCode.set($any($event.target).value)"
                    maxlength="15"
                  />
                  @if (interactiveErrors()['copyCode']) {
                    <span class="idialog-error">{{ interactiveErrors()['copyCode'] }}</span>
                  }
                </div>
              </div>
            }

            <!-- Actions -->
            <div class="idialog-footer">
              <button type="button" class="idialog-cancel" (click)="closeInteractiveDialog()">Cancelar</button>
              <button
                type="button"
                class="idialog-send"
                (click)="sendInteractiveMessage()"
                [disabled]="interactiveSending()"
              >
                @if (interactiveSending()) {
                  <span class="composer-spinner" aria-hidden="true"></span>
                } @else {
                  Enviar
                }
              </button>
            </div>
          </div>
        </div>
      }
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
    .chat-unread-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.375rem;
      border-radius: var(--radius-full);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: 0.6875rem;
      font-weight: 700;
      font-feature-settings: "tnum";
      line-height: 1;
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

    /* Thread panel wrapper (animatable) */
    .thread-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
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

    /* Bubble + reaction layout */
    .bubble-and-reaction {
      position: relative;
      display: flex;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .bubble-wrap--out .bubble-and-reaction {
      flex-direction: row-reverse;
    }

    /* React button — visible on hover of bubble-and-reaction */
    .bubble-react-btn {
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-full);
      color: var(--color-on-surface-variant);
      cursor: pointer;
      opacity: 0;
      transition: opacity var(--duration-fast) var(--ease-default);
      flex-shrink: 0;
      min-height: 0;
      margin-bottom: 0.25rem;
    }
    .bubble-and-reaction:hover .bubble-react-btn,
    .bubble-react-btn--open {
      opacity: 1;
    }
    .bubble-react-btn:hover,
    .bubble-react-btn--open {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    /* Mini reaction picker */
    .reaction-picker {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 0;
      z-index: 200;
      display: flex;
      gap: 0.125rem;
      background: var(--color-surface-container-high);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-full);
      padding: 0.375rem 0.5rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      animation: popIn 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.85); }
      to   { opacity: 1; transform: scale(1); }
    }
    .reaction-option {
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      font-size: 1.125rem;
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-default),
                  transform var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .reaction-option:hover {
      background: var(--color-surface-container);
      transform: scale(1.2);
    }

    /* Reaction badge on bubble */
    .reaction-badge {
      position: absolute;
      bottom: -10px;
      right: 4px;
      font-size: 0.875rem;
      background: var(--color-surface-container-high);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-full);
      padding: 0.05rem 0.25rem;
      line-height: 1.4;
      z-index: 1;
    }

    /* Bubbles */
    .bubble {
      position: relative;
      width: fit-content;
      min-width: 80px;
      max-width: 70%;
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
      position: relative;
      background: var(--color-surface-container-lowest);
      border-top: 1px solid var(--color-outline-variant);
      padding: 0.75rem 1rem 0.5rem;
    }
    .composer-inner {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
    }

    /* Attachment preview row */
    .attachment-preview {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--color-surface-container-low);
      border-radius: var(--radius-lg);
      margin-bottom: 0.5rem;
      animation: fadeSlideUp 150ms ease-out;
    }
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .attachment-thumb {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: cover;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    }
    .attachment-icon {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-container);
      border-radius: var(--radius-sm);
      color: var(--color-on-surface-variant);
      flex-shrink: 0;
    }
    .attachment-name {
      flex: 1;
      font-size: 0.8125rem;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .attachment-remove {
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      color: var(--color-on-surface-variant);
      cursor: pointer;
      flex-shrink: 0;
      min-height: 0;
      transition: background var(--duration-fast) var(--ease-default);
    }
    .attachment-remove:hover {
      background: var(--color-surface-container);
      color: var(--color-error);
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
      cursor: pointer;
      opacity: 0.65;
      min-height: 0;
      transition: opacity var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
    }
    .composer-attach:hover { opacity: 1; }
    .composer-attach--active { color: var(--color-primary); opacity: 1; }

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

    /* ── Emoji picker ────────────────────────────────────────────── */
    .composer-emoji-btn {
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
      cursor: pointer;
      opacity: 0.65;
      transition: opacity var(--duration-fast) var(--ease-default),
                  color var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .composer-emoji-btn:hover { opacity: 1; }
    .composer-emoji-btn--active { color: var(--color-primary); opacity: 1; }

    .emoji-overlay-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
    }

    .emoji-picker {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      z-index: 101;
      width: 320px;
      max-height: 280px;
      overflow-y: auto;
      background: var(--color-surface-container-high);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-xl);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      padding: 0.75rem;
      scrollbar-width: thin;
      scrollbar-color: var(--color-outline-variant) transparent;
    }

    .emoji-group { margin-bottom: 0.75rem; }
    .emoji-group:last-child { margin-bottom: 0; }
    .emoji-group-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-on-surface-variant);
      margin-bottom: 0.375rem;
    }
    .emoji-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.125rem;
    }
    .emoji-btn {
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 1.1rem;
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .emoji-btn:hover {
      background: var(--color-surface-container);
    }

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
      .bubble { width: fit-content; min-width: 80px; max-width: 85%; }
    }

    /* ── Media bubble content ────────────────────────────────────── */
    .bubble-media {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .bubble-image {
      max-height: 240px;
      max-width: 100%;
      border-radius: var(--radius-lg);
      object-fit: cover;
      display: block;
    }
    .bubble-video {
      max-height: 240px;
      max-width: 100%;
      border-radius: var(--radius-lg);
      display: block;
    }
    .bubble-audio {
      width: 100%;
      min-width: 180px;
    }
    .bubble-caption {
      font-size: 0.875rem;
      color: var(--color-on-surface);
      margin: 0;
      line-height: 1.4;
    }

    /* Document link */
    .bubble-document {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--color-primary);
      padding: 0.25rem 0;
    }
    .bubble-document:hover { text-decoration: underline; }
    .bubble-doc-icon { flex-shrink: 0; color: var(--color-on-surface-variant); }
    .bubble-doc-name {
      font-size: 0.875rem;
      word-break: break-all;
    }

    /* Interactive card */
    .bubble-interactive { display: flex; flex-direction: column; gap: 0.5rem; }
    .bubble-interactive-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .bubble-interactive-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.625rem;
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
    }

    /* Unsupported / reaction body */
    .bubble-body--unsupported { color: var(--color-on-surface-variant); font-style: italic; }
    .bubble-unsupported {
      color: var(--color-on-surface-variant, #888);
      font-size: 0.875em;
    }
    .bubble-media-placeholder {
      color: var(--color-on-surface-variant, #888);
      font-style: italic;
    }
    .bubble-body--reaction { font-size: 1.5rem; line-height: 1; }

    /* ── Lightbox ─────────────────────────────────────────────────── */
    .lightbox-backdrop {
      position: fixed;
      inset: 0;
      z-index: 500;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 150ms ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .lightbox-img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: var(--radius-lg);
      box-shadow: 0 24px 48px rgba(0,0,0,0.4);
    }
    .lightbox-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.15);
      border: none;
      border-radius: var(--radius-full);
      color: white;
      cursor: pointer;
      min-height: 0;
      transition: background var(--duration-fast) var(--ease-default);
    }
    .lightbox-close:hover { background: rgba(255,255,255,0.25); }

    /* ── Interactive builder button in composer ──────────────────── */
    .composer-interactive-btn {
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
      cursor: pointer;
      opacity: 0.65;
      transition: opacity var(--duration-fast) var(--ease-default),
                  color var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .composer-interactive-btn:hover { opacity: 1; color: var(--color-primary); }

    /* ── Interactive dialog backdrop ─────────────────────────────── */
    .interactive-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 400;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 150ms ease-out;
    }

    /* Dialog panel */
    .interactive-dialog {
      background: var(--color-surface-container-lowest);
      border-radius: var(--radius-2xl);
      box-shadow: 0 24px 48px rgba(0,0,0,0.25);
      width: min(480px, 95vw);
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      scrollbar-width: thin;
      scrollbar-color: var(--color-outline-variant) transparent;
    }

    /* Dialog header */
    .idialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .idialog-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-on-surface);
      margin: 0;
    }
    .idialog-close {
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      color: var(--color-on-surface-variant);
      cursor: pointer;
      min-height: 0;
      transition: background var(--duration-fast) var(--ease-default);
    }
    .idialog-close:hover { background: var(--color-surface-container-low); }

    /* Type tabs */
    .idialog-tabs {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--color-outline-variant);
      padding-bottom: 0.75rem;
    }
    .idialog-tab {
      padding: 0.25rem 0.75rem;
      border: none;
      border-radius: var(--radius-full);
      font-size: 0.8125rem;
      font-family: var(--font-sans);
      font-weight: 500;
      cursor: pointer;
      background: transparent;
      color: var(--color-on-surface-variant);
      transition: background var(--duration-fast) var(--ease-default),
                  color var(--duration-fast) var(--ease-default);
      min-height: 0;
    }
    .idialog-tab:hover { background: var(--color-surface-container-low); color: var(--color-on-surface); }
    .idialog-tab--active { background: var(--color-primary); color: var(--color-on-primary); }

    /* Fields */
    .idialog-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .idialog-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-on-surface);
    }
    .idialog-required { color: var(--color-error); }
    .idialog-optional { font-weight: 400; color: var(--color-on-surface-variant); }

    .idialog-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--color-on-surface);
      outline: none;
      box-sizing: border-box;
      transition: border-color var(--duration-fast) var(--ease-default);
    }
    .idialog-input:focus { border-color: var(--color-primary); }
    .idialog-input--small { font-size: 0.8125rem; }

    .idialog-textarea {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--color-on-surface);
      outline: none;
      resize: vertical;
      box-sizing: border-box;
      transition: border-color var(--duration-fast) var(--ease-default);
    }
    .idialog-textarea:focus { border-color: var(--color-primary); }

    .idialog-error {
      font-size: 0.75rem;
      color: var(--color-error);
    }

    /* Section with add/remove rows */
    .idialog-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .idialog-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .idialog-add-btn {
      font-size: 0.75rem;
      font-family: var(--font-sans);
      color: var(--color-primary);
      background: transparent;
      border: none;
      cursor: pointer;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      min-height: 0;
    }
    .idialog-add-btn:hover { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }

    .idialog-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .idialog-remove-btn {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      color: var(--color-on-surface-variant);
      cursor: pointer;
      font-size: 1.25rem;
      flex-shrink: 0;
      min-height: 0;
      transition: color var(--duration-fast) var(--ease-default);
    }
    .idialog-remove-btn:hover { color: var(--color-error); }

    .idialog-list-row {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
    }
    .idialog-list-row-fields {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    /* Footer actions */
    .idialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--color-outline-variant);
    }
    .idialog-cancel {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-lg);
      background: transparent;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      min-height: 0;
      transition: background var(--duration-fast) var(--ease-default);
    }
    .idialog-cancel:hover { background: var(--color-surface-container-low); }

    .idialog-send {
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: var(--radius-lg);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: opacity var(--duration-fast) var(--ease-default);
    }
    .idialog-send:hover:not(:disabled) { opacity: 0.85; }
    .idialog-send:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class InstanceChatsComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(TuiAlertService);

  @ViewChild('composerTextarea') composerTextareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

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

  readonly chats = signal<ChatItem[]>([]);

  private readonly chatsSyncEffect = effect(() => {
    const incoming = this.chatsRes.value().chats;
    this.chats.set(
      incoming
        .map((chat) => ({
          ...chat,
          timestamp: this.toEpochSeconds(chat.timestamp),
        }))
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    );
  });

  // ── Selection state ────────────────────────────────────────────────────────

  /** ID of the currently-selected chat, or null when nothing is selected. */
  readonly selectedId = signal<string | null>(null);

  readonly selectedChat = computed<ChatItem | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.chats().find((c) => c.id === id) ?? null;
  });

  selectChat(chat: ChatItem): void {
    this.selectedId.set(chat.id);
    this.composerText.set('');
    this.localMessages.set([]);
    this.clearAttachment();
    this.closeEmojiPicker();
    this.closeInteractiveDialog();
    this.closeReactionPicker();
    this.localReactions.set(new Map());

    // Clear unread locally for instant feedback
    if ((chat.unreadCount ?? 0) > 0) {
      this.upsertChatLocally({
        ...chat,
        unreadCount: 0,
      });
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
    { id: 'direct', label: 'Diretas' },
    { id: 'groups', label: 'Grupos' },
  ];

  readonly activeFilter = signal<FilterTab>('all');

  readonly searchQuery = signal('');

  readonly filteredChats = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const tab = this.activeFilter();
    const all = this.chats();

    const byTab = all.filter((c) => {
      switch (tab) {
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
    const byId = new Map<string, MessageItem>();
    for (const msg of this.messagesRes.value().messages) {
      byId.set(msg.id, {
        ...msg,
        timestamp: this.toEpochSeconds(msg.timestamp),
      });
    }
    for (const msg of this.localMessages()) {
      const existing = byId.get(msg.id);
      if (existing) {
        // Server version lacks display fields set only on the local optimistic
        // message (type, mediaUrl, interactiveButtons). Merge them in so a
        // refresh of messagesRes doesn't visually degrade button/media bubbles.
        byId.set(msg.id, {
          ...existing,
          type: msg.type ?? existing.type,
          mediaUrl: msg.mediaUrl ?? existing.mediaUrl,
          caption: msg.caption ?? existing.caption,
          interactiveButtons: msg.interactiveButtons ?? existing.interactiveButtons,
        });
      } else {
        byId.set(msg.id, {
          ...msg,
          timestamp: this.toEpochSeconds(msg.timestamp),
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
  });

  private streamAbortController: AbortController | null = null;

  private readonly streamEffect = effect((onCleanup) => {
    const instanceName = this.name();
    if (!instanceName) {
      this.stopRealtimeStream();
      return;
    }
    this.startRealtimeStream(instanceName);
    onCleanup(() => this.stopRealtimeStream());
  });

  private readonly refreshPoller = timer(
    FALLBACK_REFRESH_INTERVAL_MS,
    FALLBACK_REFRESH_INTERVAL_MS,
  )
    .pipe(takeUntilDestroyed())
    .subscribe(() => {
      if (!this.name()) return;
      this.queueReload(!!this.selectedId());
    });

  private reloadCoalesceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChatsReload = false;
  private pendingMessagesReload = false;

  // ── Reactions ──────────────────────────────────────────────────────────────

  readonly reactionPickerForId = signal<string | null>(null);
  readonly localReactions = signal<Map<string, string>>(new Map());
  readonly REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

  toggleReactionPicker(msgId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.reactionPickerForId.update((current) =>
      current === msgId ? null : msgId,
    );
  }

  closeReactionPicker(): void {
    this.reactionPickerForId.set(null);
  }

  async sendReaction(msg: MessageItem, emoji: string): Promise<void> {
    const instanceName = this.name();
    const chatId = this.selectedId();
    if (!instanceName || !chatId) return;

    this.reactionPickerForId.set(null);

    this.localReactions.update((map) => {
      const next = new Map(map);
      next.set(msg.id, emoji);
      return next;
    });

    const to = chatId.split('@')[0];

    try {
      await firstValueFrom(
        this.http.post(
          `/api/instances/${encodeURIComponent(instanceName)}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'reaction',
            reaction: { message_id: msg.id, emoji },
          },
        ),
      );
    } catch {
      this.localReactions.update((map) => {
        const next = new Map(map);
        next.delete(msg.id);
        return next;
      });
    }
  }

  // ── Composer ───────────────────────────────────────────────────────────────

  readonly composerText = signal('');
  readonly sending = signal(false);

  // ── Emoji picker ───────────────────────────────────────────────────────────

  readonly showEmojiPicker = signal(false);

  readonly emojiGroups: Array<{ label: string; emojis: string[] }> = [
    { label: 'Smileys', emojis: ['😀','😂','😊','😍','🤔','😎','🥺','😭','🤣','😅','😁','🙂','😉','😋','😜','🤗','😢','😤','😡','🥰','🤩','😴','🤯','😱','🤫'] },
    { label: 'Gestos', emojis: ['👍','👎','👋','🤝','👏','🙏','🤞','✌️','👌','🤌','💪','🫶','❤️','🔥','✨','🎉','💯','🚀','💬','📎'] },
    { label: 'Natureza', emojis: ['🐶','🐱','🐸','🦊','🐼','🐨','🦁','🐯','🐮','🐷','🐙','🦋','🌸','🌺','🌻','🌈','⭐','🌙','☀️','❄️'] },
  ];

  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((v) => !v);
  }

  closeEmojiPicker(): void {
    this.showEmojiPicker.set(false);
  }

  insertEmoji(emoji: string): void {
    const ta = this.composerTextareaRef?.nativeElement;
    if (!ta) {
      this.composerText.update((t) => t + emoji);
      this.showEmojiPicker.set(false);
      return;
    }

    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.substring(0, start);
    const after = ta.value.substring(end);
    const newValue = before + emoji + after;

    this.composerText.set(newValue);
    ta.value = newValue;

    // Restore cursor position after the inserted emoji
    const cursorPos = start + emoji.length;
    setTimeout(() => {
      ta.setSelectionRange(cursorPos, cursorPos);
      ta.focus();
    }, 0);

    this.showEmojiPicker.set(false);
  }
  readonly maxBody = MAX_BODY;

  readonly pendingAttachment = signal<File | null>(null);
  readonly attachmentPreviewUrl = signal<string | null>(null);

  // ── Interactive message builder ────────────────────────────────────────────

  readonly showInteractiveDialog = signal(false);
  readonly interactiveType = signal<InteractiveType>('button');
  readonly interactiveBody = signal('');
  readonly interactiveFooter = signal('');
  readonly interactiveButtons = signal<ButtonRow[]>([{ label: '' }, { label: '' }]);
  readonly interactiveListButtonLabel = signal('');
  readonly interactiveListRows = signal<ListRow[]>([{ title: '', description: '' }, { title: '', description: '' }]);
  readonly interactiveCtaText = signal('');
  readonly interactiveCtaUrl = signal('');
  readonly interactiveCopyCode = signal('');
  readonly interactiveErrors = signal<Record<string, string>>({});
  readonly interactiveSending = signal(false);

  readonly interactiveTypeTabs: Array<{ value: InteractiveType; label: string }> = [
    { value: 'button',   label: 'Botões' },
    { value: 'list',     label: 'Lista' },
    { value: 'cta_url',  label: 'Link URL' },
    { value: 'cta_copy', label: 'Copiar Código' },
  ];

  openInteractiveDialog(): void {
    this.interactiveType.set('button');
    this.interactiveBody.set('');
    this.interactiveFooter.set('');
    this.interactiveButtons.set([{ label: '' }, { label: '' }]);
    this.interactiveListButtonLabel.set('');
    this.interactiveListRows.set([{ title: '', description: '' }, { title: '', description: '' }]);
    this.interactiveCtaText.set('');
    this.interactiveCtaUrl.set('');
    this.interactiveCopyCode.set('');
    this.interactiveErrors.set({});
    this.showInteractiveDialog.set(true);
  }

  closeInteractiveDialog(): void {
    this.showInteractiveDialog.set(false);
  }

  addInteractiveButton(): void {
    if (this.interactiveButtons().length >= 3) return;
    this.interactiveButtons.update((btns) => [...btns, { label: '' }]);
  }

  removeInteractiveButton(index: number): void {
    if (this.interactiveButtons().length <= 1) return;
    this.interactiveButtons.update((btns) => btns.filter((_, i) => i !== index));
  }

  updateInteractiveButton(index: number, label: string): void {
    this.interactiveButtons.update((btns) =>
      btns.map((b, i) => i === index ? { label } : b),
    );
  }

  addListRow(): void {
    if (this.interactiveListRows().length >= 10) return;
    this.interactiveListRows.update((rows) => [...rows, { title: '', description: '' }]);
  }

  removeListRow(index: number): void {
    if (this.interactiveListRows().length <= 1) return;
    this.interactiveListRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateListRowTitle(index: number, title: string): void {
    this.interactiveListRows.update((rows) =>
      rows.map((r, i) => i === index ? { ...r, title } : r),
    );
  }

  updateListRowDescription(index: number, description: string): void {
    this.interactiveListRows.update((rows) =>
      rows.map((r, i) => i === index ? { ...r, description } : r),
    );
  }

  private validateInteractive(): boolean {
    const errors: Record<string, string> = {};
    const body = this.interactiveBody().trim();
    if (!body) errors['body'] = 'Texto do corpo é obrigatório';

    const type = this.interactiveType();
    if (type === 'button') {
      const btns = this.interactiveButtons();
      if (btns.every((b) => !b.label.trim())) {
        errors['buttons'] = 'Adicione pelo menos um botão com texto';
      }
    } else if (type === 'list') {
      const rows = this.interactiveListRows();
      if (rows.every((r) => !r.title.trim())) {
        errors['rows'] = 'Adicione pelo menos uma opção com título';
      }
      if (!this.interactiveListButtonLabel().trim()) {
        errors['listButton'] = 'Texto do botão da lista é obrigatório';
      }
    } else if (type === 'cta_url') {
      if (!this.interactiveCtaText().trim()) {
        errors['ctaText'] = 'Texto do botão é obrigatório';
      }
      const url = this.interactiveCtaUrl().trim();
      if (!url) {
        errors['ctaUrl'] = 'URL é obrigatória';
      } else {
        try { new URL(url); } catch { errors['ctaUrl'] = 'Digite uma URL válida'; }
      }
    } else if (type === 'cta_copy') {
      if (!this.interactiveCopyCode().trim()) {
        errors['copyCode'] = 'Código é obrigatório';
      }
    }

    this.interactiveErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  async sendInteractiveMessage(): Promise<void> {
    if (!this.validateInteractive()) return;

    const instanceName = this.name();
    const chatId = this.selectedId();
    if (!instanceName || !chatId || this.interactiveSending()) return;

    this.interactiveSending.set(true);
    const to = chatId.split('@')[0];
    const body = this.interactiveBody().trim();
    const type = this.interactiveType();

    let action: unknown;
    let optimisticButtons: string[] = [];

    if (type === 'button') {
      const buttons = this.interactiveButtons()
        .filter((b) => b.label.trim())
        .map((b, i) => ({ type: 'reply', reply: { id: `btn-${i}`, title: b.label.trim() } }));
      action = { buttons };
      optimisticButtons = buttons.map((b: any) => b.reply.title);
    } else if (type === 'list') {
      const rows = this.interactiveListRows()
        .filter((r) => r.title.trim())
        .map((r, i) => ({ id: `row-${i}`, title: r.title.trim(), description: r.description.trim() || undefined }));
      action = {
        button: this.interactiveListButtonLabel().trim(),
        sections: [{ rows }],
      };
      optimisticButtons = rows.map((r: any) => r.title);
    } else if (type === 'cta_url') {
      action = {
        name: 'cta_url',
        parameters: { display_text: this.interactiveCtaText().trim(), url: this.interactiveCtaUrl().trim() },
      };
      optimisticButtons = [this.interactiveCtaText().trim()];
    } else if (type === 'cta_copy') {
      action = {
        name: 'cta_copy',
        parameters: { display_text: 'Copiar', copy_code: this.interactiveCopyCode().trim() },
      };
      optimisticButtons = ['Copiar código'];
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type,
        body: { text: body },
        footer: this.interactiveFooter().trim() ? { text: this.interactiveFooter().trim() } : undefined,
        action,
      },
    };

    const sentAt = Math.floor(Date.now() / 1000);
    const optimisticMsg: MessageItem = {
      id: `local-${Date.now()}`,
      body,
      fromMe: true,
      timestamp: sentAt,
      type: 'interactive',
      interactiveButtons: optimisticButtons,
    };
    this.localMessages.update((msgs) => [...msgs, optimisticMsg]);
    this.closeInteractiveDialog();
    setTimeout(() => this.scrollToBottom(), 30);

    try {
      const result = await firstValueFrom(
        this.http.post<SendMessageResponse>(
          `/api/instances/${encodeURIComponent(instanceName)}/messages`,
          payload,
        ),
      );
      const sentId = result.messages?.[0]?.id;
      if (sentId) {
        this.localMessages.update((msgs) =>
          msgs.map((m) => m.id === optimisticMsg.id ? { ...m, id: sentId } : m),
        );
      } else {
        this.localMessages.update((msgs) =>
          msgs.filter((m) => m.id !== optimisticMsg.id),
        );
      }
    } catch {
      this.localMessages.update((msgs) =>
        msgs.filter((m) => m.id !== optimisticMsg.id),
      );
    } finally {
      this.interactiveSending.set(false);
    }
  }

  // ── Lightbox ───────────────────────────────────────────────────────────────

  readonly lightboxUrl = signal<string | null>(null);

  openLightbox(url: string): void {
    if (url) this.lightboxUrl.set(url);
  }

  closeLightbox(): void {
    this.lightboxUrl.set(null);
  }

  openFilePicker(): void {
    this.fileInputRef?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const MAX_SIZE = 16 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac'];

    if (file.size > MAX_SIZE) {
      void firstValueFrom(this.alerts.open('O arquivo excede o limite de 16 MB', { appearance: 'negative', label: 'Erro' }));
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      void firstValueFrom(this.alerts.open('Tipo de arquivo não permitido', { appearance: 'negative', label: 'Erro' }));
      return;
    }

    const prev = this.attachmentPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);

    this.pendingAttachment.set(file);

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      this.attachmentPreviewUrl.set(URL.createObjectURL(file));
    } else {
      this.attachmentPreviewUrl.set(null);
    }
  }

  clearAttachment(): void {
    const url = this.attachmentPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.pendingAttachment.set(null);
    this.attachmentPreviewUrl.set(null);
  }

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
    const instanceName = this.name();
    const chatId = this.selectedId();
    if (!instanceName || !chatId || this.sending()) return;

    const body = this.composerText().trim();
    const attachment = this.pendingAttachment();

    // Must have text OR attachment
    if (!body && !attachment) return;

    this.sending.set(true);
    const to = chatId.split('@')[0]; // strip @s.whatsapp.net
    const sentAt = Math.floor(Date.now() / 1000);

    // ── Media path ────────────────────────────────────────────────
    if (attachment) {
      // Step 1: Convert file to base64
      const ab = await attachment.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);

      // Step 2: Build payload based on MIME type
      const mime = attachment.type;
      let payload: Record<string, unknown>;
      let optimisticBody: string;

      if (mime.startsWith('audio/')) {
        payload = {
          messaging_product: 'whatsapp',
          to,
          type: 'audio',
          audio: { data: b64, mimetype: attachment.type, ptt: false },
        };
        optimisticBody = `[Áudio: ${attachment.name}]`;
      } else if (mime === 'video/mp4') {
        payload = {
          messaging_product: 'whatsapp',
          to,
          type: 'video',
          video: { data: b64, mimetype: attachment.type, caption: body || undefined },
        };
        optimisticBody = body ? body : `[Vídeo: ${attachment.name}]`;
      } else {
        // image/* (jpeg, png, webp, gif)
        payload = {
          messaging_product: 'whatsapp',
          to,
          type: 'image',
          image: { data: b64, mimetype: attachment.type, caption: body || undefined },
        };
        optimisticBody = body ? body : `[Imagem: ${attachment.name}]`;
      }

      // Step 3: Optimistic message
      const optimisticMsg: MessageItem = {
        id: `local-${Date.now()}`,
        body: optimisticBody,
        fromMe: true,
        timestamp: sentAt,
        type: payload['type'] as string,
        mediaUrl: `data:${attachment.type};base64,${b64}`,
      };
      this.localMessages.update((msgs) => [...msgs, optimisticMsg]);

      const selectedChat = this.selectedChat();
      if (selectedChat) {
        this.upsertChatLocally({
          ...selectedChat,
          lastMessage: optimisticBody,
          timestamp: sentAt,
          unreadCount: 0,
        });
      }

      // Clear composer and attachment immediately after optimistic append
      this.composerText.set('');
      if (this.composerTextareaRef) {
        this.composerTextareaRef.nativeElement.value = '';
        this.composerTextareaRef.nativeElement.style.height = 'auto';
      }
      this.clearAttachment();
      setTimeout(() => this.scrollToBottom(), 30);

      // Step 4: Send message
      try {
        const sendResult = await firstValueFrom(
          this.http.post<SendMessageResponse>(
            `/api/instances/${encodeURIComponent(instanceName)}/messages`,
            payload,
          ),
        );
        const sentId = sendResult.messages?.[0]?.id;
        if (sentId) {
          this.localMessages.update((msgs) =>
            msgs.map((m) => m.id === optimisticMsg.id ? { ...m, id: sentId } : m),
          );
        } else {
          this.localMessages.update((msgs) =>
            msgs.filter((m) => m.id !== optimisticMsg.id),
          );
        }
      } catch {
        // Interceptor shows error toast. Roll back optimistic message.
        this.localMessages.update((msgs) =>
          msgs.filter((m) => m.id !== optimisticMsg.id),
        );
      } finally {
        this.sending.set(false);
      }
      return;
    }

    // ── Text-only path ────────────────────────────────────────────
    // Optimistic append
    const optimisticMsg: MessageItem = {
      id: `local-${Date.now()}`,
      body,
      fromMe: true,
      timestamp: sentAt,
    };
    this.localMessages.update((msgs) => [...msgs, optimisticMsg]);

    const selectedChat = this.selectedChat();
    if (selectedChat) {
      this.upsertChatLocally({
        ...selectedChat,
        lastMessage: body,
        timestamp: sentAt,
        unreadCount: 0,
      });
    }

    this.composerText.set('');

    // Reset textarea height
    if (this.composerTextareaRef) {
      this.composerTextareaRef.nativeElement.value = '';
      this.composerTextareaRef.nativeElement.style.height = 'auto';
    }

    setTimeout(() => this.scrollToBottom(), 30);

    try {
      const sendResult = await firstValueFrom(
        this.http.post<SendMessageResponse>(
          `/api/instances/${encodeURIComponent(instanceName)}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body },
          },
        ),
      );

      const sentId = sendResult.messages?.[0]?.id;
      if (sentId) {
        this.localMessages.update((msgs) =>
          msgs.map((m) =>
            m.id === optimisticMsg.id ? { ...m, id: sentId } : m,
          ),
        );
      } else {
        this.localMessages.update((msgs) =>
          msgs.filter((m) => m.id !== optimisticMsg.id),
        );
      }
    } catch {
      // Interceptor shows error toast. Roll back optimistic message.
      this.localMessages.update((msgs) =>
        msgs.filter((m) => m.id !== optimisticMsg.id),
      );
    } finally {
      this.sending.set(false);
    }
  }

  private startRealtimeStream(instanceName: string): void {
    this.stopRealtimeStream();

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const controller = new AbortController();
    this.streamAbortController = controller;

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
        onopen: async (response) => {
          if (response.ok) return;
          if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized realtime stream');
          }
          throw new Error(`Failed to open realtime stream (${response.status})`);
        },
        onmessage: (event) => {
          this.handleRealtimeEvent(event.data);
        },
        onclose: () => {
          if (controller.signal.aborted) return;
          throw new Error('Realtime stream closed unexpectedly');
        },
        onerror: (error) => {
          if (controller.signal.aborted) return;
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('Unauthorized realtime stream')) {
            this.stopRealtimeStream();
            return;
          }
          return STREAM_RETRY_DELAY_MS;
        },
      },
    ).catch(() => undefined);
  }

  private stopRealtimeStream(): void {
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }
  }

  private handleRealtimeEvent(rawData: string): void {
    if (!rawData) return;

    let parsed: ChatRealtimeEvent | null = null;
    try {
      parsed = JSON.parse(rawData) as ChatRealtimeEvent;
    } catch {
      return;
    }

    if (!parsed || parsed.type === 'heartbeat') return;

    if (parsed.chat) {
      this.upsertChatLocally({
        id: parsed.chat.id,
        name: parsed.chat.name ?? undefined,
        isGroup: parsed.chat.isGroup,
        lastMessage: parsed.chat.lastMessage ?? undefined,
        timestamp: parsed.chat.lastMessageAt,
        unreadCount: parsed.chat.unreadCount,
      });
    }

    const selected = this.selectedId();

    if (parsed.message && selected && parsed.message.chatId === selected) {
      const message: MessageItem = {
        id: parsed.message.id,
        body: parsed.message.body ?? '',
        fromMe: parsed.message.fromMe,
        senderName: parsed.message.sender ?? undefined,
        timestamp: this.toEpochSeconds(parsed.message.timestamp),
        type: parsed.message.type ?? undefined,
        interactiveButtons: parsed.message.interactiveButtons ?? undefined,
      };

      this.localMessages.update((messages: MessageItem[]) => {
        if (messages.some((m: MessageItem) => m.id === message.id)) {
          return messages;
        }
        if (this.messagesRes.value().messages.some((m: MessageItem) => m.id === message.id)) {
          return messages;
        }
        return [...messages, message].sort((a, b) => a.timestamp - b.timestamp);
      });

      setTimeout(() => this.scrollToBottom(), 30);
    }

    const hasPatchPayload = !!parsed.chat || !!parsed.message;
    if (hasPatchPayload && parsed.type !== 'history_synced') {
      return;
    }

    const shouldReloadMessages =
      !!selected &&
      (!parsed.chatId ||
        parsed.chatId === selected ||
        parsed.type === 'history_synced');

    this.queueReload(shouldReloadMessages);
  }

  private upsertChatLocally(chat: ChatItem): void {
    const normalisedChat: ChatItem = {
      ...chat,
      timestamp: this.toEpochSeconds(chat.timestamp),
    };

    this.chats.update((current) => {
      const next = [...current];
      const idx = next.findIndex((c) => c.id === normalisedChat.id);
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...normalisedChat };
      } else {
        next.push(normalisedChat);
      }
      return next.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    });
  }

  private toEpochSeconds(timestamp?: number): number {
    if (!timestamp) return 0;
    return timestamp > MS_EPOCH_THRESHOLD
      ? Math.floor(timestamp / 1000)
      : timestamp;
  }

  private queueReload(reloadMessages: boolean): void {
    this.pendingChatsReload = true;
    this.pendingMessagesReload = this.pendingMessagesReload || reloadMessages;

    if (this.reloadCoalesceTimer) return;

    this.reloadCoalesceTimer = setTimeout(() => {
      this.reloadCoalesceTimer = null;

      if (this.pendingChatsReload) {
        this.chatsRes.reload();
      }

      if (this.pendingMessagesReload && this.selectedId()) {
        // API data becomes source of truth after each successful live refresh.
        this.localMessages.set([]);
        this.messagesRes.reload();
      }

      this.pendingChatsReload = false;
      this.pendingMessagesReload = false;
    }, RELOAD_COALESCE_MS);
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
