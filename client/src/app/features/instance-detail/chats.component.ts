import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ResourceStatus } from '@angular/core';

interface ChatsResponse {
  instance: string;
  total: number;
  chats: unknown[];
}

@Component({
  selector: 'app-chats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let chatData = chatsRes.value();
    @if (chatsRes.isLoading() && chatData.chats.length === 0) {
      <p>Loading chats…</p>
    } @else if (chatsRes.status() === ResourceStatus.Error) {
      <p class="err">Could not load chats.</p>
    } @else if (chatData.chats.length === 0) {
      <p class="muted">No chats yet.</p>
    } @else {
      <ul class="list">
        @for (c of chatData.chats; track $index) {
          <li class="row">
            <pre>{{ formatChat(c) }}</pre>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .err {
        color: var(--tui-status-negative);
      }
      .muted {
        color: var(--tui-text-secondary);
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .row {
        padding: 0.75rem 1rem;
        border-radius: var(--tui-radius-m);
        background: var(--tui-background-elevation-1);
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        font: var(--tui-font-text-s);
      }
    `,
  ],
})
export class ChatsComponent {
  readonly instanceName = input.required<string>();

  readonly ResourceStatus = ResourceStatus;

  readonly chatsRes = httpResource<ChatsResponse>(() => {
    const n = this.instanceName();
    return n ? `/api/instances/${encodeURIComponent(n)}/chats?include_messages=false` : undefined;
  }, { defaultValue: { instance: '', total: 0, chats: [] } });

  formatChat(c: unknown): string {
    if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      const id = o['id'] ?? o['jid'] ?? o['remoteJid'] ?? '';
      const name = o['name'] ?? o['subject'] ?? '';
      const last = o['lastMessage'] ?? o['conversationTimestamp'] ?? '';
      return [String(name || id), last ? ` — ${String(last)}` : ''].join('');
    }
    return String(c);
  }
}
