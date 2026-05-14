import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { ChatListItemModel, resolveAvatarInitials, resolveAvatarStyle } from './chat-identity.utils';

@Component({
  selector: 'app-chat-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="chat-avatar"
      [class.chat-avatar--header]="variant() === 'header'"
      [style.background]="avatarStyle().bg"
      [style.color]="avatarStyle().text"
      aria-hidden="true"
    >
      @if (showImage()) {
        <img
          class="chat-avatar-image"
          [src]="chat().profilePictureUrl!"
          alt=""
          loading="lazy"
          decoding="async"
          (error)="imageFailed.set(true)"
        />
      } @else {
        <span class="chat-avatar-fallback">{{ initials() }}</span>
      }
    </span>
  `,
  styles: [`
    .chat-avatar {
      width: 2.625rem;
      height: 2.625rem;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 700;
      flex-shrink: 0;
      overflow: hidden;
      position: relative;
    }

    .chat-avatar--header {
      width: 2.25rem;
      height: 2.25rem;
      font-size: 0.75rem;
    }

    .chat-avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .chat-avatar-fallback {
      font-feature-settings: "tnum";
      line-height: 1;
    }
  `],
})
export class ChatAvatarComponent {
  readonly chat = input.required<ChatListItemModel>();
  readonly variant = input<'list' | 'header'>('list');

  readonly imageFailed = signal(false);
  readonly initials = computed(() => resolveAvatarInitials(this.chat()));
  readonly avatarStyle = computed(() => resolveAvatarStyle(this.chat()));
  readonly showImage = computed(
    () => !!this.chat().profilePictureUrl && !this.imageFailed(),
  );

  private readonly resetImageError = effect(() => {
    this.chat();
    this.imageFailed.set(false);
  });
}
