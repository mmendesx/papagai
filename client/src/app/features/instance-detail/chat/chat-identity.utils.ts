import { getAvatarColor } from '../../../shared/avatar-colors';

export interface ChatListItemModel {
  id: string;
  jid?: string;
  name?: string;
  displayName?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  isGroup?: boolean;
  lastMessage?: string;
  timestamp?: number;
  unreadCount?: number;
}

export function normalizePhoneNumber(input: string | undefined, fallbackJid: string): string {
  const source = (input ?? '').trim();
  const fromJid = stripJidSuffix(fallbackJid).trim();
  const candidate = source || fromJid;
  return candidate.replace(/\D/g, '');
}

export function formatPhoneNumber(input: string | undefined, fallbackJid: string): string {
  const digits = normalizePhoneNumber(input, fallbackJid);
  if (!digits) return stripJidSuffix(fallbackJid) || fallbackJid;

  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const first = digits.slice(4, 9);
    const last = digits.slice(9);
    return `+55 (${ddd}) ${first}-${last}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const first = digits.slice(4, 8);
    const last = digits.slice(8);
    return `+55 (${ddd}) ${first}-${last}`;
  }

  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const first = digits.slice(2, 7);
    const last = digits.slice(7);
    return `(${ddd}) ${first}-${last}`;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const first = digits.slice(2, 6);
    const last = digits.slice(6);
    return `(${ddd}) ${first}-${last}`;
  }

  return `+${digits}`;
}

export function resolvePrimaryLabel(chat: ChatListItemModel): string {
  const display = (chat.displayName ?? chat.name ?? '').trim();
  if (display) return display;
  return formatPhoneNumber(chat.phoneNumber, chat.jid ?? chat.id);
}

export function resolveSecondaryLabel(chat: ChatListItemModel): string | null {
  const display = (chat.displayName ?? chat.name ?? '').trim();
  if (!display) return null;
  return formatPhoneNumber(chat.phoneNumber, chat.jid ?? chat.id);
}

export function resolveAvatarInitials(chat: ChatListItemModel): string {
  const primary = resolvePrimaryLabel(chat);
  const initials = primary
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (initials) return initials;
  return chat.isGroup ? 'GR' : '?';
}

export function resolveAvatarStyle(chat: ChatListItemModel): { bg: string; text: string } {
  return getAvatarColor(resolveAvatarInitials(chat));
}

export function stripJidSuffix(jid: string): string {
  return jid.replace(/@[\w.-]+$/, '');
}
