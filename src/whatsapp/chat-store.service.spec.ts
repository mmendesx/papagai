import { ChatStoreService, extractPreview } from './chat-store.service';

// ── Redis mock ─────────────────────────────────────────────────────────────

function makeMockRedis(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    hgetall: jest.fn().mockResolvedValue({}),
    hset: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    ...overrides,
  } as any;
}

// ── Baileys message factory ────────────────────────────────────────────────

function makeMsg(
  overrides: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
    pushName?: string;
    text?: string;
    messageTimestamp?: number;
  } = {},
) {
  const {
    id = 'msg-1',
    remoteJid = '5511999999999@s.whatsapp.net',
    fromMe = false,
    pushName = 'Alice',
    text = 'Hello',
    messageTimestamp = Math.floor(Date.now() / 1000),
  } = overrides;

  return {
    key: { id, remoteJid, fromMe },
    pushName,
    messageTimestamp,
    message: { conversation: text },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ChatStoreService', () => {
  const USER = 'user-1';
  const INSTANCE = 'inst-1';

  describe('extractPreview', () => {
    it('extracts text from conversation', () => {
      const msg = { message: { conversation: 'hi' } };
      expect(extractPreview(msg)).toEqual({ type: 'text', body: 'hi' });
    });

    it('extracts text from extendedTextMessage', () => {
      const msg = { message: { extendedTextMessage: { text: 'extended' } } };
      expect(extractPreview(msg)).toEqual({ type: 'text', body: 'extended' });
    });

    it('extracts image caption', () => {
      const msg = { message: { imageMessage: { caption: 'a photo' } } };
      expect(extractPreview(msg)).toEqual({ type: 'image', body: 'a photo' });
    });

    it('returns unknown for unrecognised message', () => {
      const msg = { message: { somenewType: {} } };
      expect(extractPreview(msg)).toEqual({ type: 'unknown', body: null });
    });

    it('returns unknown when message is null', () => {
      expect(extractPreview(null)).toEqual({ type: 'unknown', body: null });
    });

    // Wrapper / newer Baileys types
    it('unwraps ephemeralMessage to its inner type', () => {
      const msg = {
        message: {
          ephemeralMessage: {
            message: { conversation: 'hello' },
          },
        },
      };
      expect(extractPreview(msg)).toEqual({ type: 'text', body: 'hello' });
    });

    it('extracts documentWithCaptionMessage with caption', () => {
      const msg = {
        message: {
          documentWithCaptionMessage: {
            message: {
              documentMessage: {
                caption: 'caption text',
                fileName: 'file.pdf',
              },
            },
          },
        },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'document',
        body: 'caption text',
      });
    });

    it('extracts documentWithCaptionMessage falling back to fileName when no caption', () => {
      const msg = {
        message: {
          documentWithCaptionMessage: {
            message: {
              documentMessage: { fileName: 'file.pdf' },
            },
          },
        },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'document',
        body: 'file.pdf',
      });
    });

    it('unwraps viewOnceMessage to its inner image type', () => {
      const msg = {
        message: {
          viewOnceMessage: {
            message: { imageMessage: {} },
          },
        },
      };
      expect(extractPreview(msg)).toEqual({ type: 'image', body: null });
    });

    it('unwraps viewOnceMessageV2 to its inner image type', () => {
      const msg = {
        message: {
          viewOnceMessageV2: {
            message: {
              viewOnceMessage: {
                message: { imageMessage: {} },
              },
            },
          },
        },
      };
      expect(extractPreview(msg)).toEqual({ type: 'image', body: null });
    });

    it('extracts pollCreationMessage name as body', () => {
      const msg = {
        message: {
          pollCreationMessage: { name: 'Poll question' },
        },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'unknown',
        body: 'Poll question',
      });
    });

    // Regression: all 10 original types still resolve correctly
    it('extracts video caption', () => {
      const msg = { message: { videoMessage: { caption: 'a video' } } };
      expect(extractPreview(msg)).toEqual({ type: 'video', body: 'a video' });
    });

    it('extracts audio as type audio with null body', () => {
      const msg = { message: { audioMessage: {} } };
      expect(extractPreview(msg)).toEqual({ type: 'audio', body: null });
    });

    it('extracts documentMessage with caption', () => {
      const msg = {
        message: {
          documentMessage: { caption: 'doc caption', fileName: 'doc.pdf' },
        },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'document',
        body: 'doc caption',
      });
    });

    it('extracts documentMessage falling back to fileName', () => {
      const msg = { message: { documentMessage: { fileName: 'doc.pdf' } } };
      expect(extractPreview(msg)).toEqual({
        type: 'document',
        body: 'doc.pdf',
      });
    });

    it('extracts sticker as type sticker with null body', () => {
      const msg = { message: { stickerMessage: {} } };
      expect(extractPreview(msg)).toEqual({ type: 'sticker', body: null });
    });

    it('extracts locationMessage name', () => {
      const msg = { message: { locationMessage: { name: 'Home' } } };
      expect(extractPreview(msg)).toEqual({ type: 'location', body: 'Home' });
    });

    it('extracts locationMessage address when no name', () => {
      const msg = { message: { locationMessage: { address: '123 Main St' } } };
      expect(extractPreview(msg)).toEqual({
        type: 'location',
        body: '123 Main St',
      });
    });

    it('extracts contactMessage displayName', () => {
      const msg = { message: { contactMessage: { displayName: 'Bob' } } };
      expect(extractPreview(msg)).toEqual({ type: 'contact', body: 'Bob' });
    });

    it('extracts reactionMessage text', () => {
      const msg = { message: { reactionMessage: { text: '👍' } } };
      expect(extractPreview(msg)).toEqual({ type: 'reaction', body: '👍' });
    });

    it('extracts buttonsMessage contentText as interactive body', () => {
      const msg = {
        message: { buttonsMessage: { contentText: 'button body' } },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'interactive',
        body: 'button body',
      });
    });

    it('extracts buttonsMessage text as interactive body when contentText is absent', () => {
      const msg = { message: { buttonsMessage: { text: 'button body' } } };
      expect(extractPreview(msg)).toEqual({
        type: 'interactive',
        body: 'button body',
      });
    });

    it('extracts interactiveMessage body.text as interactive body', () => {
      const msg = {
        message: { interactiveMessage: { body: { text: 'interactive body' } } },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'interactive',
        body: 'interactive body',
      });
    });

    it('extracts templateMessage hydratedContentText as interactive body', () => {
      const msg = {
        message: {
          templateMessage: {
            hydratedTemplate: { hydratedContentText: 'template body' },
          },
        },
      };
      expect(extractPreview(msg)).toEqual({
        type: 'interactive',
        body: 'template body',
      });
    });
  });

  describe('recordIncoming', () => {
    it('creates a chat and stores the message', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, INSTANCE, makeMsg());

      const chats = svc.getChats(USER, INSTANCE);
      expect(chats).toHaveLength(1);
      expect(chats[0].id).toBe('5511999999999@s.whatsapp.net');
      expect(chats[0].unreadCount).toBe(1);
      expect(chats[0].lastMessage).toBe('Hello');

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].fromMe).toBe(false);
      expect(messages[0].body).toBe('Hello');
    });

    it('increments received counter', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, INSTANCE, makeMsg({ id: 'a' }));
      svc.recordIncoming(USER, INSTANCE, makeMsg({ id: 'b' }));

      const counters = svc.getCounters(USER, INSTANCE);
      expect(counters.received).toBe(2);
      expect(counters.sent).toBe(0);
    });

    it('increments unreadCount per message', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, INSTANCE, makeMsg({ id: 'a' }));
      svc.recordIncoming(USER, INSTANCE, makeMsg({ id: 'b' }));

      const chats = svc.getChats(USER, INSTANCE);
      expect(chats[0].unreadCount).toBe(2);
    });

    it('writes through to Redis asynchronously', async () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, INSTANCE, makeMsg());

      // Allow the microtask queue to flush
      await Promise.resolve();
      await Promise.resolve();

      expect(redis.lpush).toHaveBeenCalled();
      expect(redis.hset).toHaveBeenCalled();
    });
  });

  describe('realtime events', () => {
    it('emits chat_updated when a message is recorded', (done) => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      const sub = svc.observeEvents(USER, INSTANCE).subscribe((event) => {
        try {
          expect(event.type).toBe('chat_updated');
          expect(event.chatId).toBe('5511999999999@s.whatsapp.net');
          expect(event.source).toBe('incoming');
          sub.unsubscribe();
          done();
        } catch (error) {
          sub.unsubscribe();
          done(error);
        }
      });

      svc.recordIncoming(USER, INSTANCE, makeMsg());
    });

    it('emits chat_read when a chat is marked as read', (done) => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, INSTANCE, makeMsg());

      const sub = svc.observeEvents(USER, INSTANCE).subscribe((event) => {
        try {
          expect(event.type).toBe('chat_read');
          expect(event.chatId).toBe('5511999999999@s.whatsapp.net');
          expect(event.source).toBe('read');
          sub.unsubscribe();
          done();
        } catch (error) {
          sub.unsubscribe();
          done(error);
        }
      });

      svc.markRead(USER, INSTANCE, '5511999999999@s.whatsapp.net');
    });
  });

  describe('deduplication', () => {
    it('recording the same msg.key.id twice stores only once', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      const msg = makeMsg({ id: 'dup-id' });
      svc.recordIncoming(USER, INSTANCE, msg);
      svc.recordIncoming(USER, INSTANCE, msg);

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);

      const counters = svc.getCounters(USER, INSTANCE);
      expect(counters.received).toBe(1);
    });

    it('deduplication works across recordIncoming and recordOutgoing', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      // Baileys fires messages.upsert for sent messages too
      const outResult = { key: { id: 'shared-id' } };
      svc.recordOutgoing(USER, INSTANCE, '5511999999999', 'hi', outResult);

      // Simulate messages.upsert echo for the same message
      const msg = makeMsg({ id: 'shared-id', fromMe: true });
      svc.recordIncoming(USER, INSTANCE, msg);

      const counters = svc.getCounters(USER, INSTANCE);
      expect(counters.sent).toBe(1);
      expect(counters.received).toBe(0);
    });
  });

  describe('recordOutgoing', () => {
    it('creates a chat entry and stores a fromMe message', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordOutgoing(USER, INSTANCE, '5511999999999', 'Hey!', {
        key: { id: 'out-1' },
      });

      const chats = svc.getChats(USER, INSTANCE);
      expect(chats).toHaveLength(1);
      expect(chats[0].lastMessage).toBe('Hey!');

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].fromMe).toBe(true);
    });

    it('increments sent counter', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordOutgoing(USER, INSTANCE, '5511999999999', 'a', {
        key: { id: '1' },
      });
      svc.recordOutgoing(USER, INSTANCE, '5511999999999', 'b', {
        key: { id: '2' },
      });

      expect(svc.getCounters(USER, INSTANCE).sent).toBe(2);
    });

    it('accepts a JID with @s.whatsapp.net directly', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordOutgoing(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
        'jid test',
        { key: { id: 'x1' } },
      );

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
    });

    it('detects image type from Baileys result with imageMessage', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      const baileysResult = {
        key: { id: 'img-out-1' },
        message: { imageMessage: { caption: 'photo caption' } },
      };

      svc.recordOutgoing(
        USER,
        INSTANCE,
        '5511999999999',
        'photo caption',
        baileysResult,
      );

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('image');
    });

    it('stores interactiveButtons when provided', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      const baileysResult = {
        key: { id: 'btn-out-1' },
        message: { conversation: 'Escolha' },
      };

      svc.recordOutgoing(
        USER,
        INSTANCE,
        '5511999999999',
        'Escolha',
        baileysResult,
        ['Sim', 'Não'],
      );

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].interactiveButtons).toEqual(['Sim', 'Não']);
    });

    it('does not set interactiveButtons for a plain text outgoing message', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      const baileysResult = {
        key: { id: 'text-out-1' },
        message: { conversation: 'plain text' },
      };

      svc.recordOutgoing(
        USER,
        INSTANCE,
        '5511999999999',
        'plain text',
        baileysResult,
      );

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('text');
      expect(messages[0].interactiveButtons).toBeUndefined();
    });
  });

  describe('getChats', () => {
    it('sorts by lastMessageAt descending', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      const earlier = makeMsg({
        id: 'e',
        remoteJid: 'aaa@s.whatsapp.net',
        messageTimestamp: 1000,
      });
      const later = makeMsg({
        id: 'l',
        remoteJid: 'bbb@s.whatsapp.net',
        messageTimestamp: 2000,
      });

      svc.recordIncoming(USER, INSTANCE, earlier);
      svc.recordIncoming(USER, INSTANCE, later);

      const chats = svc.getChats(USER, INSTANCE);
      expect(chats[0].id).toBe('bbb@s.whatsapp.net');
      expect(chats[1].id).toBe('aaa@s.whatsapp.net');
    });

    it('returns empty array when no store exists', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);
      expect(svc.getChats('nobody', 'ghost')).toEqual([]);
    });
  });

  describe('getMessages', () => {
    it('returns messages in chronological order (oldest first)', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(
        USER,
        INSTANCE,
        makeMsg({ id: 'a', messageTimestamp: 1000 }),
      );
      svc.recordIncoming(
        USER,
        INSTANCE,
        makeMsg({ id: 'b', messageTimestamp: 2000 }),
      );
      svc.recordIncoming(
        USER,
        INSTANCE,
        makeMsg({ id: 'c', messageTimestamp: 3000 }),
      );

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages[0].id).toBe('a');
      expect(messages[1].id).toBe('b');
      expect(messages[2].id).toBe('c');
    });

    it('respects the limit parameter', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      for (let i = 0; i < 10; i++) {
        svc.recordIncoming(
          USER,
          INSTANCE,
          makeMsg({ id: `m${i}`, messageTimestamp: i }),
        );
      }

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
        3,
      );
      expect(messages).toHaveLength(3);
      // Last 3 in chronological order
      expect(messages[0].id).toBe('m7');
      expect(messages[1].id).toBe('m8');
      expect(messages[2].id).toBe('m9');
    });

    it('returns empty array for unknown chatId', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);
      svc.recordIncoming(USER, INSTANCE, makeMsg());
      expect(svc.getMessages(USER, INSTANCE, 'nope@s.whatsapp.net')).toEqual(
        [],
      );
    });
  });

  describe('clearInstance', () => {
    it('removes all data for the instance', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, INSTANCE, makeMsg());
      svc.clearInstance(USER, INSTANCE);

      expect(svc.getChats(USER, INSTANCE)).toEqual([]);
      expect(svc.getCounters(USER, INSTANCE)).toEqual({
        sent: 0,
        received: 0,
        activeConversations: 0,
      });
    });

    it('does not affect other instances', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(USER, 'inst-A', makeMsg({ id: 'x' }));
      svc.recordIncoming(USER, 'inst-B', makeMsg({ id: 'y' }));

      svc.clearInstance(USER, 'inst-A');

      expect(svc.getChats(USER, 'inst-A')).toEqual([]);
      expect(svc.getChats(USER, 'inst-B')).toHaveLength(1);
    });
  });

  describe('Redis failure resilience', () => {
    it('does not throw when Redis write fails', async () => {
      const redis = makeMockRedis({
        lpush: jest.fn().mockRejectedValue(new Error('Connection refused')),
        hset: jest.fn().mockRejectedValue(new Error('Connection refused')),
      });
      const svc = new ChatStoreService(redis);

      // Should not throw
      expect(() => svc.recordIncoming(USER, INSTANCE, makeMsg())).not.toThrow();

      // Allow microtask queue to flush (write-through is async)
      await new Promise((r) => setTimeout(r, 10));

      // In-memory data should still be present
      expect(svc.getChats(USER, INSTANCE)).toHaveLength(1);
    });

    it('continues with empty store when Redis hydration fails', async () => {
      const redis = makeMockRedis({
        hgetall: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });
      const svc = new ChatStoreService(redis);

      // Should not throw
      await expect(svc.hydrate(USER, INSTANCE)).resolves.toBeUndefined();

      expect(svc.getChats(USER, INSTANCE)).toEqual([]);
    });
  });

  describe('hydrate', () => {
    it('restores chats and counters from Redis', async () => {
      const chatSummary = {
        id: '5511999999999@s.whatsapp.net',
        phoneNumber: '5511999999999',
        name: 'Alice',
        isGroup: false,
        lastMessage: 'Restored',
        lastMessageAt: 1700000000000,
        unreadCount: 3,
      };
      const storedMsg = {
        id: 'msg-hydrated',
        chatId: '5511999999999@s.whatsapp.net',
        fromMe: false,
        sender: 'Alice',
        type: 'text',
        body: 'Restored',
        timestamp: 1700000000000,
      };

      const redis = makeMockRedis({
        hgetall: jest.fn().mockImplementation((key: string) => {
          if (key.endsWith(':chats')) {
            return Promise.resolve({
              '5511999999999@s.whatsapp.net': JSON.stringify(chatSummary),
            });
          }
          if (key.endsWith(':counters')) {
            return Promise.resolve({ sent: '5', received: '10' });
          }
          return Promise.resolve({});
        }),
        lrange: jest.fn().mockResolvedValue([JSON.stringify(storedMsg)]),
      });

      const svc = new ChatStoreService(redis);
      await svc.hydrate(USER, INSTANCE);

      const chats = svc.getChats(USER, INSTANCE);
      expect(chats).toHaveLength(1);
      expect(chats[0].name).toBe('Alice');
      expect(chats[0].unreadCount).toBe(3);

      const counters = svc.getCounters(USER, INSTANCE);
      expect(counters.sent).toBe(5);
      expect(counters.received).toBe(10);

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-hydrated');
    });

    it('deduplicates messages already in seenIds after hydration', async () => {
      const storedMsg = {
        id: 'already-seen',
        chatId: '5511999999999@s.whatsapp.net',
        fromMe: false,
        sender: null,
        type: 'text',
        body: 'old',
        timestamp: 1000,
      };
      const redis = makeMockRedis({
        hgetall: jest.fn().mockImplementation((key: string) => {
          if (key.endsWith(':chats')) {
            return Promise.resolve({
              '5511999999999@s.whatsapp.net': JSON.stringify({
                id: '5511999999999@s.whatsapp.net',
                phoneNumber: '5511999999999',
                name: null,
                isGroup: false,
                lastMessage: 'old',
                lastMessageAt: 1000,
                unreadCount: 0,
              }),
            });
          }
          return Promise.resolve({});
        }),
        lrange: jest.fn().mockResolvedValue([JSON.stringify(storedMsg)]),
      });

      const svc = new ChatStoreService(redis);
      await svc.hydrate(USER, INSTANCE);

      // Attempt to record the same message again
      svc.recordIncoming(USER, INSTANCE, makeMsg({ id: 'already-seen' }));

      const messages = svc.getMessages(
        USER,
        INSTANCE,
        '5511999999999@s.whatsapp.net',
      );
      expect(messages).toHaveLength(1);
    });
  });

  describe('getCounters', () => {
    it('returns activeConversations equal to number of unique chats', () => {
      const redis = makeMockRedis();
      const svc = new ChatStoreService(redis);

      svc.recordIncoming(
        USER,
        INSTANCE,
        makeMsg({ id: 'a', remoteJid: 'aaa@s.whatsapp.net' }),
      );
      svc.recordIncoming(
        USER,
        INSTANCE,
        makeMsg({ id: 'b', remoteJid: 'bbb@s.whatsapp.net' }),
      );
      svc.recordIncoming(
        USER,
        INSTANCE,
        makeMsg({ id: 'c', remoteJid: 'aaa@s.whatsapp.net' }),
      );

      const counters = svc.getCounters(USER, INSTANCE);
      expect(counters.activeConversations).toBe(2);
    });
  });
});
