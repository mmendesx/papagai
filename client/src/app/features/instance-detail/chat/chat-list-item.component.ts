import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChatAvatarComponent } from './chat-avatar.component';
import {
  ChatListItemModel,
  resolvePrimaryLabel,
  resolveSecondaryLabel,
} from './chat-identity.utils';

@Component({
  selector: 'app-chat-list-item',
  standalone: true,
  imports: [ChatAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="chat-row"
      [class.chat-row--selected]="selected()"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="'Abrir conversa com ' + primaryLabel()"
      (click)="select.emit()"
    >
      <app-chat-avatar [chat]="chat()" />

      <span class="chat-content">
        <span class="chat-name">{{ primaryLabel() }}</span>
        @if (secondaryLabel(); as secondary) {
          <span class="chat-phone">{{ secondary }}</span>
        } @else if (chat().lastMessage) {
          <span class="chat-preview">{{ chat().lastMessage }}</span>
        }
      </span>

      <span class="chat-meta">
        <ng-content />
      </span>
    </button>
  `,
  styles: [`
    :host {
      display: block;
    }

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

    .chat-phone,
    .chat-preview {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    .chat-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
      flex-shrink: 0;
    }
  `],
})
export class ChatListItemComponent {
  readonly chat = input.required<ChatListItemModel>();
  readonly selected = input(false);
  readonly select = output<void>();

  primaryLabel(): string {
    return resolvePrimaryLabel(this.chat());
  }

  secondaryLabel(): string | null {
    return resolveSecondaryLabel(this.chat());
  }
}
