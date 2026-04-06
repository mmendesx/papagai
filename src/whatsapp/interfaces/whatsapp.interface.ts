import { WASocket } from '@whiskeysockets/baileys';

export interface Instance {
  socket: WASocket;
  webhookUrl: string | null;
  webhookHeaders: Record<string, string>;
  webhookEnabled: boolean;
  webhookEvents: string[];
  name: string;
  connected: boolean;
  qr: string | null;
  saveCreds: () => Promise<void>;
  startTime: number;
  lastConnectedAt: number | null;
  retryCount: number;
}

export interface Button {
  id: string;
  text: string;
}

export interface InteractiveButton {
  id: string;
  displayText: string;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface MediaFile {
  path: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  caption?: string | null;
  duration?: number;
}

export interface WebhookData {
  event: string;
  instance: string;
  from?: string;
  pushName?: string;
  messageId?: string;
  messageType?: string;
  text?: string;
  timestamp?: number;
  isGroup?: boolean;
  groupId?: string | null;
  image?: MediaFile;
  audio?: MediaFile;
  voice?: MediaFile;
  video?: MediaFile;
  document?: MediaFile;
  sticker?: MediaFile;
  location?: {
    degreesLatitude: number;
    degreesLongitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    displayName: string;
    vcard: string;
    numbers: string[];
  };
  buttonId?: string;
  selectedRowId?: string;
  reaction?: string;
  parentMessageId?: string;
  caption?: string | null;
  duration?: number;
  filename?: string;
  qr?: string;
  phoneNumber?: string;
  reason?: string;
  willReconnect?: boolean;
  updates?: any;
}

export interface ChatInfo {
  phoneNumber: string;
  pushName: string;
  unreadCount: number;
  lastMessage?: string;
  timestamp: number;
  isGroup: boolean;
}

export interface ContactInfo {
  phoneNumber: string;
  pushName: string | null;
  verifiedName?: string;
  isBusiness?: boolean;
  profilePicture?: string | null;
  status?: string | null;
}
