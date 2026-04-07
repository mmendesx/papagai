import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { getAvatarColor } from '../../shared/avatar-colors';

interface ChatsResponse {
  instance: string;
  total: number;
  chats: any[];
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .chat-list { display: flex; flex-direction: column; gap: 0.25rem; }

    .chat-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-lg);
      transition: background var(--duration-fast) var(--ease-default);
      cursor: pointer;
    }
    .chat-row:hover { background: var(--color-surface-container-low); }

    .chat-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 300;
      flex-shrink: 0;
    }

    .chat-content { flex: 1; overflow: hidden; }
    .chat-name { font-size: 0.875rem; font-weight: 300; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chat-preview { font-size: 0.75rem; font-weight: 200; color: var(--tui-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.125rem; }
    .chat-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; flex-shrink: 0; }
    .chat-time { font-size: 0.6875rem; font-weight: 200; color: var(--tui-text-secondary); }
    .unread-badge { background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--radius-full); padding: 0.1rem 0.4rem; font-size: 0.6875rem; font-weight: 300; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 1rem;
      text-align: center;
      color: var(--tui-text-secondary);
    }
    .empty-icon { margin-bottom: 1rem; opacity: 0.4; }
    .empty-title { font-size: 1rem; font-weight: 300; margin-bottom: 0.5rem; }
    .empty-subtitle { font-size: 0.875rem; font-weight: 200; }
  `],
  template: `
    @if (chatsRes.isLoading()) {
      <div style="padding: 2rem; text-align: center; color: var(--tui-text-secondary); font-weight: 200;">
        Carregando conversas…
      </div>
    } @else if (chatsRes.error()) {
      <div style="padding: 2rem; text-align: center; color: var(--tui-text-secondary); font-weight: 200;">
        Falha ao carregar conversas
      </div>
    } @else if (!chatsRes.value().chats.length) {
      <div class="empty-state">
        <svg class="empty-icon" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
        </svg>
        <div class="empty-title">Nenhuma conversa ainda</div>
        <div class="empty-subtitle">As conversas aparecerão aqui assim que sua instância receber mensagens</div>
      </div>
    } @else {
      <div class="chat-list">
        @for (chat of chatsRes.value()!.chats; track chat.id ?? $index) {
          <div class="chat-row">
            <div class="chat-avatar"
                 [style.background]="avatarStyle(chatInitials(chat)).bg"
                 [style.color]="avatarStyle(chatInitials(chat)).text">{{ chatInitials(chat) }}</div>
            <div class="chat-content">
              <div class="chat-name">{{ chat.name || formatChatId(chat.id) }}</div>
              @if (chat.lastMessage) {
                <div class="chat-preview">{{ chat.lastMessage }}</div>
              }
            </div>
            <div class="chat-meta">
              @if (chat.timestamp) {
                <span class="chat-time">{{ chat.timestamp * 1000 | date:'shortTime' }}</span>
              }
              @if (chat.unreadCount) {
                <span class="unread-badge">{{ chat.unreadCount }}</span>
              }
            </div>
          </div>
        }
      </div>
    }
  `
})
export class ChatsComponent {
  readonly instanceName = input.required<string>();

  readonly chatsRes = httpResource<ChatsResponse>(() => {
    const n = this.instanceName();
    return n ? `/api/instances/${encodeURIComponent(n)}/chats?include_messages=false` : undefined;
  }, { defaultValue: { instance: '', total: 0, chats: [] } });

  chatInitials(chat: any): string {
    const name = chat.name || chat.id || '';
    return name.split(/[@\s]/).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  formatChatId(id: string): string {
    // "5511999998888@s.whatsapp.net" → "5511999998888"
    return id?.split('@')[0] ?? id;
  }

  avatarStyle(initials: string): { bg: string; text: string } {
    return getAvatarColor(initials);
  }
}
