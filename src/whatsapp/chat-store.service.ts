import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Observable, Subject } from 'rxjs';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export interface ChatSummary {
  id: string;
  phoneNumber: string;
  name: string | null;
  isGroup: boolean;
  lastMessage: string | null;
  lastMessageAt: number;
  unreadCount: number;
}

export interface StoredMessage {
  id: string;
  chatId: string;
  fromMe: boolean;
  sender: string | null;
  type:
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'sticker'
    | 'location'
    | 'contact'
    | 'unknown';
  body: string | null;
  timestamp: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface ChatRealtimeEvent {
  type: 'chat_updated' | 'chat_read' | 'history_synced';
  chatId?: string;
  timestamp: number;
  source?: 'incoming' | 'outgoing' | 'read' | 'sync';
  chat?: ChatSummary;
  message?: StoredMessage;
}

interface InstanceStore {
  chats: Map<string, ChatSummary>;
  messages: Map<string, StoredMessage[]>;
  seenIds: Set<string>;
  counters: { sent: number; received: number };
}

const MAX_MESSAGES_PER_CHAT = 200;

const REDIS_KEY_PREFIX = 'papagai';

function instanceKey(userId: string, instanceName: string): string {
  return `${userId}:${instanceName}`;
}

function redisChatsKey(userId: string, instanceName: string): string {
  return `${REDIS_KEY_PREFIX}:${userId}:${instanceName}:chats`;
}

function redisMessagesKey(
  userId: string,
  instanceName: string,
  chatId: string,
): string {
  return `${REDIS_KEY_PREFIX}:${userId}:${instanceName}:messages:${chatId}`;
}

function redisCountersKey(userId: string, instanceName: string): string {
  return `${REDIS_KEY_PREFIX}:${userId}:${instanceName}:counters`;
}

/** JID suffixes we never want in the chat store */
const IGNORED_JID_SUFFIXES = ['@newsletter', '@broadcast', '@lid'];

function isIgnoredJid(jid: string): boolean {
  if (!jid) return true;
  if (jid === 'status@broadcast') return true;
  return IGNORED_JID_SUFFIXES.some((s) => jid.endsWith(s));
}

/**
 * Extract a human-readable preview and type from a raw Baileys message object.
 * Mirrors the type detection in WebhookEnricher but is self-contained to avoid
 * a circular dependency.
 */
export function extractPreview(msg: any): {
  type: StoredMessage['type'];
  body: string | null;
} {
  const m = msg?.message;
  if (!m) return { type: 'unknown', body: null };

  if (m.conversation) return { type: 'text', body: m.conversation };
  if (m.extendedTextMessage?.text)
    return { type: 'text', body: m.extendedTextMessage.text };
  if (m.imageMessage)
    return { type: 'image', body: m.imageMessage.caption ?? null };
  if (m.videoMessage)
    return { type: 'video', body: m.videoMessage.caption ?? null };
  if (m.audioMessage) return { type: 'audio', body: null };
  if (m.documentMessage)
    return {
      type: 'document',
      body: m.documentMessage.caption ?? m.documentMessage.fileName ?? null,
    };
  if (m.stickerMessage) return { type: 'sticker', body: null };
  if (m.locationMessage)
    return {
      type: 'location',
      body: m.locationMessage.name ?? m.locationMessage.address ?? null,
    };
  if (m.contactMessage)
    return { type: 'contact', body: m.contactMessage.displayName ?? null };

  return { type: 'unknown', body: null };
}

@Injectable()
export class ChatStoreService {
  private readonly logger = new Logger(ChatStoreService.name);
  private readonly stores: Map<string, InstanceStore> = new Map();
  private readonly eventsByInstance: Map<string, Subject<ChatRealtimeEvent>> =
    new Map();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Hydration ─────────────────────────────────────────────────────────────

  async hydrate(userId: string, instanceName: string): Promise<void> {
    const key = instanceKey(userId, instanceName);
    const store = this.getOrCreate(key);

    try {
      // Hydrate counters
      const countersRaw = await this.redis.hgetall(
        redisCountersKey(userId, instanceName),
      );
      if (countersRaw && Object.keys(countersRaw).length > 0) {
        store.counters.sent = parseInt(countersRaw['sent'] ?? '0', 10);
        store.counters.received = parseInt(countersRaw['received'] ?? '0', 10);
      }

      // Hydrate chats
      const chatsRaw = await this.redis.hgetall(
        redisChatsKey(userId, instanceName),
      );
      if (chatsRaw) {
        for (const [chatId, json] of Object.entries(chatsRaw)) {
          try {
            const chat: ChatSummary = JSON.parse(json);
            store.chats.set(chatId, chat);
          } catch {
            this.logger.warn(
              `Failed to parse chat summary for "${key}:${chatId}" from Redis`,
            );
          }
        }
      }

      // Hydrate messages for each known chat
      for (const chatId of store.chats.keys()) {
        const messagesRaw = await this.redis.lrange(
          redisMessagesKey(userId, instanceName, chatId),
          0,
          -1,
        );
        const parsed: StoredMessage[] = [];
        for (const raw of messagesRaw) {
          try {
            const m: StoredMessage = JSON.parse(raw);
            parsed.push(m);
            store.seenIds.add(m.id);
          } catch {
            // skip malformed entries
          }
        }
        // Redis list is stored newest-first (LPUSH), so reverse for chronological
        store.messages.set(chatId, parsed.reverse());
      }

      this.logger.log(
        `Hydrated store for "${key}": ${store.chats.size} chats, counters sent=${store.counters.sent} received=${store.counters.received}`,
      );
    } catch (err) {
      this.logger.warn(
        `Redis hydration failed for "${key}" — starting with empty store: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  observeEvents(userId: string, instanceName: string): Observable<ChatRealtimeEvent> {
    return this.getEventsSubject(instanceKey(userId, instanceName)).asObservable();
  }

  recordIncoming(userId: string, instanceName: string, msg: any): void {
    const key = instanceKey(userId, instanceName);
    const store = this.getOrCreate(key);

    const msgId: string = msg?.key?.id ?? '';
    if (msgId && store.seenIds.has(msgId)) return;
    if (msgId) store.seenIds.add(msgId);

    const chatId: string = msg?.key?.remoteJid ?? '';
    if (!chatId || isIgnoredJid(chatId)) return;

    const { type, body } = extractPreview(msg);
    const timestamp: number =
      (typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp * 1000
        : Number(msg.messageTimestamp) * 1000) || Date.now();

    const storedMsg: StoredMessage = {
      id: msgId,
      chatId,
      fromMe: false,
      sender: msg.key?.participant ?? msg.pushName ?? null,
      type,
      body,
      timestamp,
      status: 'delivered',
    };

    this.pushMessage(store, chatId, storedMsg);

    const isGroup = chatId.includes('@g.us');
    const existing = store.chats.get(chatId);
    const chat: ChatSummary = {
      id: chatId,
      phoneNumber: chatId.split('@')[0],
      name: msg.pushName ?? existing?.name ?? null,
      isGroup,
      lastMessage: body,
      lastMessageAt: timestamp,
      unreadCount: (existing?.unreadCount ?? 0) + 1,
    };
    store.chats.set(chatId, chat);
    store.counters.received += 1;

    this.emitEvent(userId, instanceName, {
      type: 'chat_updated',
      chatId,
      timestamp,
      source: 'incoming',
      chat: { ...chat },
      message: { ...storedMsg },
    });

    this.persistAsync(userId, instanceName, store, chatId, storedMsg);
  }

  recordOutgoing(
    userId: string,
    instanceName: string,
    to: string,
    body: string | null,
    baileysResult: any,
  ): void {
    const key = instanceKey(userId, instanceName);
    const store = this.getOrCreate(key);

    const msgId: string = baileysResult?.key?.id ?? '';
    if (msgId && store.seenIds.has(msgId)) return;
    if (msgId) store.seenIds.add(msgId);

    // Normalize chatId — may be raw digits or already a JID
    const chatId = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    if (isIgnoredJid(chatId)) return;

    const timestamp = Date.now();
    const storedMsg: StoredMessage = {
      id: msgId,
      chatId,
      fromMe: true,
      sender: null,
      type: 'text',
      body,
      timestamp,
      status: 'sent',
    };

    this.pushMessage(store, chatId, storedMsg);

    const isGroup = chatId.includes('@g.us');
    const existing = store.chats.get(chatId);
    const chat: ChatSummary = {
      id: chatId,
      phoneNumber: chatId.split('@')[0],
      name: existing?.name ?? null,
      isGroup,
      lastMessage: body,
      lastMessageAt: timestamp,
      unreadCount: existing?.unreadCount ?? 0,
    };
    store.chats.set(chatId, chat);
    store.counters.sent += 1;

    this.emitEvent(userId, instanceName, {
      type: 'chat_updated',
      chatId,
      timestamp,
      source: 'outgoing',
      chat: { ...chat },
      message: { ...storedMsg },
    });

    this.persistAsync(userId, instanceName, store, chatId, storedMsg);
  }

  getChats(userId: string, instanceName: string): ChatSummary[] {
    const store = this.stores.get(instanceKey(userId, instanceName));
    if (!store) return [];
    return [...store.chats.values()].sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt,
    );
  }

  getMessages(
    userId: string,
    instanceName: string,
    chatId: string,
    limit = 100,
  ): StoredMessage[] {
    const store = this.stores.get(instanceKey(userId, instanceName));
    if (!store) return [];
    const all = store.messages.get(chatId) ?? [];
    // Return last `limit` messages in chronological order (oldest first)
    return all.slice(-limit);
  }

  getCounters(
    userId: string,
    instanceName: string,
  ): { sent: number; received: number; activeConversations: number } {
    const store = this.stores.get(instanceKey(userId, instanceName));
    if (!store)
      return { sent: 0, received: 0, activeConversations: 0 };
    return {
      sent: store.counters.sent,
      received: store.counters.received,
      activeConversations: store.chats.size,
    };
  }

  /**
   * Ingest a bulk history sync from Baileys (chats + messages).
   * Does NOT increment sent/received counters (these are historical).
   * Messages older than what we already have are merged; dedup by msg id.
   */
  recordHistorySync(
    userId: string,
    instanceName: string,
    chats: any[],
    messages: any[],
  ): void {
    const key = instanceKey(userId, instanceName);
    const store = this.getOrCreate(key);

    let chatCount = 0;
    let msgCount = 0;

    // Upsert chat summaries from history
    for (const chat of chats) {
      const chatId: string = chat.id ?? '';
      if (!chatId || isIgnoredJid(chatId)) continue;
      const existing = store.chats.get(chatId);
      // Only seed if we have no existing data or the history has a newer timestamp
      const historyTs: number = chat.conversationTimestamp
        ? Number(chat.conversationTimestamp) * 1000
        : 0;
      if (!existing || (historyTs && historyTs > existing.lastMessageAt)) {
        const summary: ChatSummary = {
          id: chatId,
          phoneNumber: chatId.split('@')[0],
          name: chat.name ?? chat.notify ?? existing?.name ?? null,
          isGroup: chatId.includes('@g.us'),
          lastMessage:
            chat.lastMessage?.message?.conversation ??
            chat.lastMessage?.message?.extendedTextMessage?.text ??
            existing?.lastMessage ??
            null,
          lastMessageAt: historyTs || existing?.lastMessageAt || Date.now(),
          unreadCount: chat.unreadCount ?? existing?.unreadCount ?? 0,
        };
        store.chats.set(chatId, summary);
        chatCount++;
      }
    }

    // Ingest historical messages
    for (const msg of messages) {
      const msgId: string = msg?.key?.id ?? '';
      if (!msgId || store.seenIds.has(msgId)) continue;
      store.seenIds.add(msgId);

      const chatId: string = msg?.key?.remoteJid ?? '';
      if (!chatId || isIgnoredJid(chatId)) continue;

      const { type, body } = extractPreview(msg);
      const timestamp: number =
        (typeof msg.messageTimestamp === 'number'
          ? msg.messageTimestamp * 1000
          : Number(msg.messageTimestamp) * 1000) || Date.now();

      const storedMsg: StoredMessage = {
        id: msgId,
        chatId,
        fromMe: !!msg.key?.fromMe,
        sender: msg.key?.participant ?? msg.pushName ?? null,
        type,
        body,
        timestamp,
        status: msg.key?.fromMe ? 'sent' : 'delivered',
      };

      this.pushMessage(store, chatId, storedMsg);
      msgCount++;
    }

    // Sort messages within each chat chronologically after bulk insert
    for (const [, msgList] of store.messages) {
      msgList.sort((a, b) => a.timestamp - b.timestamp);
    }

    if (chatCount > 0 || msgCount > 0) {
      this.logger.log(
        `History sync for "${key}": ${chatCount} chats, ${msgCount} messages ingested`,
      );
      this.emitEvent(userId, instanceName, {
        type: 'history_synced',
        timestamp: Date.now(),
        source: 'sync',
      });
      // Persist all chats + messages to Redis in background
      this.persistBulkAsync(userId, instanceName, store);
    }
  }

  markRead(userId: string, instanceName: string, chatId: string): void {
    const store = this.stores.get(instanceKey(userId, instanceName));
    if (!store) return;
    const chat = store.chats.get(chatId);
    if (!chat) return;
    chat.unreadCount = 0;
    this.emitEvent(userId, instanceName, {
      type: 'chat_read',
      chatId,
      timestamp: Date.now(),
      source: 'read',
      chat: { ...chat },
    });
    this.persistChatAsync(userId, instanceName, chatId, chat);
  }

  clearInstance(userId: string, instanceName: string): void {
    const key = instanceKey(userId, instanceName);
    this.stores.delete(key);
    const events = this.eventsByInstance.get(key);
    if (events) {
      events.complete();
      this.eventsByInstance.delete(key);
    }
    this.logger.log(`Cleared in-memory store for "${key}"`);
    // Redis keys for this instance are cleared by WhatsappService.purgeInstance / disconnectInstance
    // which already calls redis.del on `papagai:${userId}:${instanceName}:*`
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getOrCreate(key: string): InstanceStore {
    let store = this.stores.get(key);
    if (!store) {
      store = {
        chats: new Map(),
        messages: new Map(),
        seenIds: new Set(),
        counters: { sent: 0, received: 0 },
      };
      this.stores.set(key, store);
    }
    return store;
  }

  private getEventsSubject(key: string): Subject<ChatRealtimeEvent> {
    let subject = this.eventsByInstance.get(key);
    if (!subject) {
      subject = new Subject<ChatRealtimeEvent>();
      this.eventsByInstance.set(key, subject);
    }
    return subject;
  }

  private emitEvent(
    userId: string,
    instanceName: string,
    event: ChatRealtimeEvent,
  ): void {
    this.getEventsSubject(instanceKey(userId, instanceName)).next(event);
  }

  private pushMessage(
    store: InstanceStore,
    chatId: string,
    msg: StoredMessage,
  ): void {
    const list = store.messages.get(chatId) ?? [];
    list.push(msg);
    if (list.length > MAX_MESSAGES_PER_CHAT) {
      list.splice(0, list.length - MAX_MESSAGES_PER_CHAT);
    }
    store.messages.set(chatId, list);
  }

  private persistAsync(
    userId: string,
    instanceName: string,
    store: InstanceStore,
    chatId: string,
    msg: StoredMessage,
  ): void {
    // Fire-and-forget; log warnings on failure, never let Redis errors surface to callers
    Promise.all([
      this.persistMessageAsync(userId, instanceName, chatId, msg),
      this.persistChatAsync(
        userId,
        instanceName,
        chatId,
        store.chats.get(chatId)!,
      ),
      this.persistCountersAsync(userId, instanceName, store.counters),
    ]).catch((err) => {
      this.logger.warn(
        `Redis write-through failed for "${instanceKey(userId, instanceName)}": ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private async persistMessageAsync(
    userId: string,
    instanceName: string,
    chatId: string,
    msg: StoredMessage,
  ): Promise<void> {
    const rKey = redisMessagesKey(userId, instanceName, chatId);
    // LPUSH stores newest first; we reverse on read
    await this.redis.lpush(rKey, JSON.stringify(msg));
    await this.redis.ltrim(rKey, 0, MAX_MESSAGES_PER_CHAT - 1);
  }

  private async persistChatAsync(
    userId: string,
    instanceName: string,
    chatId: string,
    chat: ChatSummary,
  ): Promise<void> {
    await this.redis.hset(
      redisChatsKey(userId, instanceName),
      chatId,
      JSON.stringify(chat),
    );
  }

  private async persistCountersAsync(
    userId: string,
    instanceName: string,
    counters: { sent: number; received: number },
  ): Promise<void> {
    await this.redis.hset(
      redisCountersKey(userId, instanceName),
      'sent',
      String(counters.sent),
      'received',
      String(counters.received),
    );
  }

  private persistBulkAsync(
    userId: string,
    instanceName: string,
    store: InstanceStore,
  ): void {
    const pipeline = this.redis.pipeline();
    const chatsKey = redisChatsKey(userId, instanceName);

    for (const [chatId, chat] of store.chats) {
      pipeline.hset(chatsKey, chatId, JSON.stringify(chat));
    }

    for (const [chatId, msgs] of store.messages) {
      const rKey = redisMessagesKey(userId, instanceName, chatId);
      pipeline.del(rKey);
      if (msgs.length > 0) {
        // Store newest-first (LPUSH order) — we reverse on read
        const reversed = [...msgs].reverse().map((m) => JSON.stringify(m));
        pipeline.lpush(rKey, ...reversed);
        pipeline.ltrim(rKey, 0, MAX_MESSAGES_PER_CHAT - 1);
      }
    }

    pipeline.exec().catch((err) => {
      this.logger.warn(
        `Redis bulk persist failed for "${instanceKey(userId, instanceName)}": ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}
