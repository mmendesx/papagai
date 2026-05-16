jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    disconnect: jest.fn(),
  };
  return { Redis: jest.fn(() => mockRedis) };
});

jest.mock('./utils/redis-auth-state', () => ({
  useRedisAuthState: jest.fn().mockResolvedValue({
    state: {},
    saveCreds: jest.fn(),
  }),
}));

jest.mock('./utils/jid-resolver', () => ({
  resolveJid: jest
    .fn()
    .mockImplementation((_socket: any, jid: string) =>
      Promise.resolve(jid.includes('@') ? jid : `${jid}@s.whatsapp.net`),
    ),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Boom } from '@hapi/boom';
import { WhatsappService } from './whatsapp.service';
import { WebhookService } from '../webhook/webhook.service';
import { ChatStoreService } from './chat-store.service';
import { Instance } from './interfaces/whatsapp.interface';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';

const { DisconnectReason } = jest.requireMock('@whiskeysockets/baileys');

const mockSocketEnd = jest.fn();

const mockSocket = {
  ev: {
    on: jest.fn(),
  },
  end: mockSocketEnd,
  user: { id: '5511999999999:1@s.whatsapp.net' },
};

jest.mock('@whiskeysockets/baileys', () => {
  const mock = jest.fn(() => mockSocket);
  (mock as any).__esModule = true;
  return {
    __esModule: true,
    default: mock,
    useMultiFileAuthState: jest.fn().mockResolvedValue({
      state: {},
      saveCreds: jest.fn(),
    }),
    DisconnectReason: { loggedOut: 401 },
    downloadContentFromMessage: jest.fn(),
    fetchLatestWaWebVersion: jest
      .fn()
      .mockResolvedValue({ version: [2, 3000, 1], error: undefined }),
    fetchLatestBaileysVersion: jest
      .fn()
      .mockResolvedValue({ version: [2, 3000, 1] }),
  };
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

const TEST_USER_ID = 'user-abc-123';

function buildMockInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    userId: TEST_USER_ID,
    name: 'testPapagai',
    socket: { end: jest.fn(), ev: { on: jest.fn() } } as any,
    webhookUrl: 'https://example.com/webhook',
    webhookHeaders: {},
    webhookEnabled: true,
    webhookEvents: [
      'message',
      'message_update',
      'qr',
      'connected',
      'disconnected',
    ],
    connected: true,
    qr: null,
    saveCreds: jest.fn(),
    startTime: Date.now(),
    lastConnectedAt: null,
    retryCount: 0,
    ...overrides,
  };
}

describe('WhatsappService', () => {
  let service: WhatsappService;
  let mockWebhookService: { sendWebhook: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockWebhookService = {
      sendWebhook: jest.fn().mockResolvedValue(undefined),
    };

    const mockChatStore: jest.Mocked<Partial<ChatStoreService>> = {
      hydrate: jest.fn().mockResolvedValue(undefined),
      recordIncoming: jest.fn(),
      recordOutgoing: jest.fn(),
      getChats: jest.fn().mockReturnValue([]),
      getMessages: jest.fn().mockReturnValue([]),
      getCounters: jest
        .fn()
        .mockReturnValue({ sent: 0, received: 0, activeConversations: 0 }),
      clearInstance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('./media') },
        },
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
        {
          provide: ChatStoreService,
          useValue: mockChatStore,
        },
        {
          provide: PrismaService,
          useValue: {
            instanceConfig: {
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn().mockResolvedValue(undefined),
              delete: jest.fn().mockResolvedValue(undefined),
              update: jest.fn().mockResolvedValue(undefined),
            },
          },
        },
        {
          provide: MediaUrlService,
          useValue: {
            signPath: jest.fn(
              (path: string) =>
                `http://localhost:3000${path}?expires=1&signature=test`,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  describe('Scenario 2 — createInstance throws on duplicate name', () => {
    it('throws an error containing "já existe" when the instance name is already registered', async () => {
      const existing = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, existing);

      await expect(
        service.createInstance(TEST_USER_ID, 'testPapagai'),
      ).rejects.toThrow('já existe');
    });

    it('does not call makeWASocket when the duplicate guard triggers', async () => {
      const makeWASocket = jest.requireMock('@whiskeysockets/baileys')
        .default as jest.Mock;
      const existing = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, existing);

      await expect(
        service.createInstance(TEST_USER_ID, 'testPapagai'),
      ).rejects.toThrow();

      expect(makeWASocket).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 8 — disconnectInstance removes from registry', () => {
    it('returns true when the instance exists', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);

      const result = await service.disconnectInstance(
        TEST_USER_ID,
        'testPapagai',
      );

      expect(result).toBe(true);
    });

    it('removes the instance from the internal Map', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);

      await service.disconnectInstance(TEST_USER_ID, 'testPapagai');

      expect(
        (service as any).instances.has(`${TEST_USER_ID}:testPapagai`),
      ).toBe(false);
    });

    it('returns null from getQR after disconnect', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);
      (service as any).qrCodes.set(
        `${TEST_USER_ID}:testPapagai`,
        'some-qr-value',
      );

      await service.disconnectInstance(TEST_USER_ID, 'testPapagai');

      expect(service.getQR(TEST_USER_ID, 'testPapagai')).toBeNull();
    });

    it('calls socket.end on the instance socket', async () => {
      const socketEnd = jest.fn();
      const instance = buildMockInstance({
        name: 'testPapagai',
        socket: { end: socketEnd, ev: { on: jest.fn() } } as any,
      });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);

      await service.disconnectInstance(TEST_USER_ID, 'testPapagai');

      expect(socketEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 9 — disconnectInstance for non-existent instance', () => {
    it('returns false when the instance does not exist', async () => {
      const result = await service.disconnectInstance(TEST_USER_ID, 'ghost');

      expect(result).toBe(false);
    });
  });

  describe('getInstances returns correct shape', () => {
    it('returns instances with name, connected, and startTime for each registered instance', () => {
      const startTimeA = Date.now() - 10000;
      const startTimeB = Date.now() - 5000;

      const instanceA = buildMockInstance({
        userId: TEST_USER_ID,
        name: 'alpha',
        connected: true,
        startTime: startTimeA,
      });
      const instanceB = buildMockInstance({
        userId: TEST_USER_ID,
        name: 'beta',
        connected: false,
        startTime: startTimeB,
      });

      (service as any).instances.set(`${TEST_USER_ID}:alpha`, instanceA);
      (service as any).instances.set(`${TEST_USER_ID}:beta`, instanceB);

      const { instances, total } = service.getInstances(TEST_USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(instances).toHaveLength(2);
      expect(total).toBe(2);
      expect(instances).toContainEqual(
        expect.objectContaining({
          name: 'alpha',
          connected: true,
          startTime: startTimeA,
          webhookEnabled: true,
          phoneNumber: null,
          provider: 'web',
          webhook: {
            url: 'https://example.com/webhook',
            headers: {},
            enabled: true,
            events: [
              'message',
              'message_update',
              'qr',
              'connected',
              'disconnected',
            ],
          },
        }),
      );
      expect(instances).toContainEqual(
        expect.objectContaining({
          name: 'beta',
          connected: false,
          startTime: startTimeB,
          webhookEnabled: true,
          phoneNumber: null,
          provider: 'web',
          webhook: {
            url: 'https://example.com/webhook',
            headers: {},
            enabled: true,
            events: [
              'message',
              'message_update',
              'qr',
              'connected',
              'disconnected',
            ],
          },
        }),
      );
    });

    it('returns empty instances and total=0 when no instances are registered', () => {
      const result = service.getInstances(TEST_USER_ID, { page: 1, limit: 20 });

      expect(result.instances).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getInstances paginates and scopes to userId', () => {
    const OTHER_USER_ID = 'other-user-xyz';

    it('returns only instances belonging to the requested userId', () => {
      (service as any).instances.set(
        `${TEST_USER_ID}:mine`,
        buildMockInstance({ userId: TEST_USER_ID, name: 'mine' }),
      );
      (service as any).instances.set(
        `${OTHER_USER_ID}:theirs`,
        buildMockInstance({ userId: OTHER_USER_ID, name: 'theirs' }),
      );

      const { instances, total } = service.getInstances(TEST_USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(total).toBe(1);
      expect(instances).toHaveLength(1);
      expect(instances[0].name).toBe('mine');
    });

    it('total equals the user instance count, not the global count', () => {
      (service as any).instances.set(
        `${TEST_USER_ID}:a`,
        buildMockInstance({ userId: TEST_USER_ID, name: 'a' }),
      );
      (service as any).instances.set(
        `${TEST_USER_ID}:b`,
        buildMockInstance({ userId: TEST_USER_ID, name: 'b' }),
      );
      (service as any).instances.set(
        `${OTHER_USER_ID}:c`,
        buildMockInstance({ userId: OTHER_USER_ID, name: 'c' }),
      );

      const { total } = service.getInstances(TEST_USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(total).toBe(2);
    });

    it('slices correctly: 5 instances, page=2, limit=2 returns items at index 2 and 3', () => {
      for (let i = 1; i <= 5; i++) {
        (service as any).instances.set(
          `${TEST_USER_ID}:inst${i}`,
          buildMockInstance({ userId: TEST_USER_ID, name: `inst${i}` }),
        );
      }

      const { instances, total } = service.getInstances(TEST_USER_ID, {
        page: 2,
        limit: 2,
      });

      expect(total).toBe(5);
      expect(instances).toHaveLength(2);
      expect(instances[0].name).toBe('inst3');
      expect(instances[1].name).toBe('inst4');
    });

    it('returns empty instances with correct total when page is beyond data', () => {
      (service as any).instances.set(
        `${TEST_USER_ID}:only`,
        buildMockInstance({ userId: TEST_USER_ID, name: 'only' }),
      );

      const { instances, total } = service.getInstances(TEST_USER_ID, {
        page: 10,
        limit: 20,
      });

      expect(total).toBe(1);
      expect(instances).toHaveLength(0);
    });

    it('returns empty instances and total=0 when user has no instances', () => {
      const { instances, total } = service.getInstances('no-instances-user', {
        page: 1,
        limit: 20,
      });

      expect(total).toBe(0);
      expect(instances).toHaveLength(0);
    });
  });

  describe('getQR returns null when no QR stored', () => {
    it('returns null for an instance with no QR code', () => {
      const instance = buildMockInstance({ name: 'testPapagai', qr: null });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);

      const result = service.getQR(TEST_USER_ID, 'testPapagai');

      expect(result).toBeNull();
    });

    it('returns null for a name that was never registered', () => {
      const result = service.getQR(TEST_USER_ID, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getInstance returns undefined for missing instance', () => {
    it('returns undefined when the requested instance name does not exist', () => {
      const result = service.getInstance(TEST_USER_ID, 'ghost');

      expect(result).toBeUndefined();
    });
  });

  describe('updateWebhookConfig', () => {
    it('throws when instance does not exist', async () => {
      await expect(
        service.updateWebhookConfig(TEST_USER_ID, 'ghost', {
          webhookUrl: 'https://new.url/hook',
        }),
      ).rejects.toThrow('not found');
    });

    it('updates in-memory instance properties', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);

      await service.updateWebhookConfig(TEST_USER_ID, 'testPapagai', {
        webhookUrl: 'https://new.url/hook',
        webhookHeaders: { 'X-Custom': 'value' },
        webhookEnabled: false,
        webhookEvents: ['message'],
      });

      expect(instance.webhookUrl).toBe('https://new.url/hook');
      expect(instance.webhookHeaders).toEqual({ 'X-Custom': 'value' });
      expect(instance.webhookEnabled).toBe(false);
      expect(instance.webhookEvents).toEqual(['message']);
    });

    it('calls prisma.instanceConfig.update with correct fields', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set(`${TEST_USER_ID}:testPapagai`, instance);

      const mockInstanceConfig = (service as any).prisma.instanceConfig;

      await service.updateWebhookConfig(TEST_USER_ID, 'testPapagai', {
        webhookUrl: 'https://updated.url/hook',
        webhookEnabled: false,
      });

      expect(mockInstanceConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_name: { userId: TEST_USER_ID, name: 'testPapagai' } },
          data: expect.objectContaining({
            webhookUrl: 'https://updated.url/hook',
            webhookEnabled: false,
          }),
        }),
      );
    });
  });

  describe('createInstance webhook enabled when no URL', () => {
    it('sets webhookEnabled false when no URL even if parameter is true', async () => {
      await service.createInstance(
        TEST_USER_ID,
        'noUrlForcedEnabled',
        undefined,
        {},
        true,
      );
      const inst = service.getInstance(TEST_USER_ID, 'noUrlForcedEnabled');
      expect(inst?.webhookEnabled).toBe(false);
      expect(inst?.webhookUrl).toBeNull();
    });

    it('defaults webhookEnabled true when URL is provided and flag omitted', async () => {
      await service.createInstance(
        TEST_USER_ID,
        'withUrlDefault',
        'https://hook.example/x',
      );
      const inst = service.getInstance(TEST_USER_ID, 'withUrlDefault');
      expect(inst?.webhookEnabled).toBe(true);
      expect(inst?.webhookUrl).toBe('https://hook.example/x');
    });
  });

  describe('Scenario 22 — no webhook HTTP call when webhookUrl is null', () => {
    it('calls webhookService.sendWebhook with an instance whose webhookUrl is null when no URL is provided', async () => {
      await service.createInstance(TEST_USER_ID, 'noWebhookInstance');

      // Find and invoke the connection.update handler registered by createInstance
      const connectionCall = mockSocket.ev.on.mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      expect(connectionCall).toBeDefined();
      const connectionHandler = connectionCall[1] as (update: any) => void;

      connectionHandler({ qr: 'test-qr-code' });

      // WhatsappService delegates to WebhookService with the instance
      // WebhookService is responsible for the null URL guard (tested in webhook.service.spec)
      expect(mockWebhookService.sendWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ webhookUrl: null }),
        expect.objectContaining({ event: 'qr' }),
      );
    });
  });

  describe('Scenario 24 — no reconnect on logout disconnect', () => {
    it('removes the instance from the registry on logout', async () => {
      await service.createInstance(TEST_USER_ID, 'logoutInstance');
      expect(service.getInstance(TEST_USER_ID, 'logoutInstance')).toBeDefined();

      const connectionCall = mockSocket.ev.on.mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      const connectionHandler = connectionCall[1] as (update: any) => void;

      const logoutError = new Boom('Logged out', {
        statusCode: DisconnectReason.loggedOut,
      });
      connectionHandler({
        connection: 'close',
        lastDisconnect: { error: logoutError },
      });

      expect(
        service.getInstance(TEST_USER_ID, 'logoutInstance'),
      ).toBeUndefined();
    });

    it('sends a disconnected webhook with willReconnect: false on logout', async () => {
      await service.createInstance(TEST_USER_ID, 'logoutInstance2');

      const connectionCall = mockSocket.ev.on.mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      const connectionHandler = connectionCall[1] as (update: any) => void;

      const logoutError = new Boom('Logged out', {
        statusCode: DisconnectReason.loggedOut,
      });
      connectionHandler({
        connection: 'close',
        lastDisconnect: { error: logoutError },
      });

      expect(mockWebhookService.sendWebhook).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          event: 'disconnected',
          willReconnect: false,
        }),
      );
    });

    it('does not schedule a reconnect on logout', async () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await service.createInstance(TEST_USER_ID, 'logoutInstance3');

      const connectionCall = mockSocket.ev.on.mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      const connectionHandler = connectionCall[1] as (update: any) => void;

      const logoutError = new Boom('Logged out', {
        statusCode: DisconnectReason.loggedOut,
      });
      connectionHandler({
        connection: 'close',
        lastDisconnect: { error: logoutError },
      });

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('chat summary mapping', () => {
    it('prefers display name and keeps compatibility fields', () => {
      const instance = buildMockInstance({ name: 'chatInstance' });
      (service as any).instances.set(`${TEST_USER_ID}:chatInstance`, instance);
      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;
      (mockChatStore.getChats as jest.Mock).mockReturnValue([
        {
          id: '5511999999999@s.whatsapp.net',
          jid: '5511999999999@s.whatsapp.net',
          phoneNumber: '5511999999999',
          displayName: 'Maria Silva',
          name: 'Maria Silva',
          profilePictureUrl: 'https://cdn.example/avatar.jpg',
          isGroup: false,
          lastMessage: 'Oi',
          lastMessageAt: 1710000000000,
          unreadCount: 2,
        },
      ]);

      const result = service.getChats(TEST_USER_ID, 'chatInstance', false);

      expect(result[0]).toMatchObject({
        id: '5511999999999@s.whatsapp.net',
        jid: '5511999999999@s.whatsapp.net',
        phoneNumber: '5511999999999',
        displayName: 'Maria Silva',
        name: 'Maria Silva',
        pushName: 'Maria Silva',
        profilePictureUrl: 'https://cdn.example/avatar.jpg',
      });
    });

    it('falls back to phone number when display name is missing', () => {
      const instance = buildMockInstance({ name: 'chatInstance2' });
      (service as any).instances.set(`${TEST_USER_ID}:chatInstance2`, instance);
      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;
      (mockChatStore.getChats as jest.Mock).mockReturnValue([
        {
          id: '5511888888888@s.whatsapp.net',
          jid: '5511888888888@s.whatsapp.net',
          phoneNumber: '5511888888888',
          displayName: null,
          name: null,
          profilePictureUrl: null,
          isGroup: false,
          lastMessage: 'Hello',
          lastMessageAt: 1710000001000,
          unreadCount: 0,
        },
      ]);

      const result = service.getChats(TEST_USER_ID, 'chatInstance2', false);
      expect(result[0].name).toBe('5511888888888');
      expect(result[0].pushName).toBe('5511888888888');
      expect(result[0].profilePictureUrl).toBeNull();
    });
  });

  describe('ICT-1 — cross-device outgoing body extraction via messages.upsert', () => {
    async function getMessagesUpsertHandler(): Promise<(payload: any) => void> {
      await service.createInstance(TEST_USER_ID, 'upsertInstance');
      const upsertCall = mockSocket.ev.on.mock.calls.find(
        ([event]: [string]) => event === 'messages.upsert',
      );
      expect(upsertCall).toBeDefined();
      return upsertCall[1] as (payload: any) => void;
    }

    it('BDD Scenario 1 — calls recordOutgoing with the extracted body when a fromMe text message arrives via messages.upsert', async () => {
      const handler = await getMessagesUpsertHandler();
      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;

      const msg = {
        key: {
          fromMe: true,
          remoteJid: '5511888888888@s.whatsapp.net',
          id: 'msg-id-001',
        },
        message: { conversation: 'hello from phone' },
      };

      handler({ messages: [msg], type: 'notify' });

      expect(mockChatStore.recordOutgoing).toHaveBeenCalledWith(
        TEST_USER_ID,
        'upsertInstance',
        '5511888888888@s.whatsapp.net',
        'hello from phone',
        msg,
      );
    });

    it('BDD Scenario 2 — recordOutgoing is called (not skipped by the handler) so seenIds dedup inside recordOutgoing can apply', async () => {
      const handler = await getMessagesUpsertHandler();
      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;

      const msg = {
        key: {
          fromMe: true,
          remoteJid: '5511777777777@s.whatsapp.net',
          id: 'msg-id-dup-002',
        },
        message: { conversation: 'sent via API' },
      };

      // Simulate that recordOutgoing tracks calls (dedup is delegated to recordOutgoing itself).
      (mockChatStore.recordOutgoing as jest.Mock).mockImplementation(() => {});

      // First call simulates send() already recording the message
      (mockChatStore.recordOutgoing as jest.Mock)({ id: 'msg-id-dup-002' });

      // Second call via messages.upsert — handler must call recordOutgoing (not skip it),
      // delegating dedup responsibility to recordOutgoing itself
      handler({ messages: [msg], type: 'notify' });

      expect(mockChatStore.recordOutgoing).toHaveBeenLastCalledWith(
        TEST_USER_ID,
        'upsertInstance',
        '5511777777777@s.whatsapp.net',
        'sent via API',
        msg,
      );
    });
  });

  describe('ICT-1 — extractButtonLabels (tested via send())', () => {
    function buildSendInstance(sendMessageResult: any): Instance {
      return buildMockInstance({
        name: 'sendInstance',
        connected: true,
        socket: {
          end: jest.fn(),
          ev: { on: jest.fn() },
          user: { id: '5511999999999:1@s.whatsapp.net' },
          sendMessage: jest.fn().mockResolvedValue(sendMessageResult),
          onWhatsApp: jest
            .fn()
            .mockResolvedValue([
              { jid: '5511888888888@s.whatsapp.net', exists: true },
            ]),
        } as any,
      });
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('extracts labels from content.buttons and passes them as interactiveButtons', async () => {
      const baileysResult = {
        key: { id: 'btn-send-1' },
        message: { conversation: 'Pick' },
      };
      const instance = buildSendInstance(baileysResult);
      (service as any).instances.set(`${TEST_USER_ID}:sendInstance`, instance);

      const content = {
        text: 'Pick',
        buttons: [
          { buttonText: { displayText: 'Yes' } },
          { buttonText: { displayText: 'No' } },
        ],
      };

      await service.send(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        content,
      );

      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;
      expect(mockChatStore.recordOutgoing).toHaveBeenCalledWith(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        'Pick',
        baileysResult,
        ['Yes', 'No'],
      );
    });

    it('extracts titles from listMessage sections and passes them as interactiveButtons', async () => {
      const baileysResult = { key: { id: 'list-send-1' }, message: {} };
      const instance = buildSendInstance(baileysResult);
      (service as any).instances.set(`${TEST_USER_ID}:sendInstance`, instance);

      const content = {
        text: 'Choose',
        listMessage: {
          sections: [
            { rows: [{ title: 'Option A' }, { title: 'Option B' }] },
            { rows: [{ title: 'Option C' }] },
          ],
        },
      };

      await service.send(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        content,
      );

      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;
      expect(mockChatStore.recordOutgoing).toHaveBeenCalledWith(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        'Choose',
        baileysResult,
        ['Option A', 'Option B', 'Option C'],
      );
    });

    it('extracts display_text from nativeFlowMessage buttons and passes them as interactiveButtons', async () => {
      const baileysResult = { key: { id: 'flow-send-1' }, message: {} };
      const instance = buildSendInstance(baileysResult);
      (service as any).instances.set(`${TEST_USER_ID}:sendInstance`, instance);

      const content = {
        text: 'Confirm?',
        interactiveMessage: {
          nativeFlowMessage: {
            buttons: [
              { buttonParamsJson: JSON.stringify({ display_text: 'Confirm' }) },
              { buttonParamsJson: JSON.stringify({ display_text: 'Cancel' }) },
            ],
          },
        },
      };

      await service.send(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        content,
      );

      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;
      expect(mockChatStore.recordOutgoing).toHaveBeenCalledWith(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        'Confirm?',
        baileysResult,
        ['Confirm', 'Cancel'],
      );
    });

    it('passes undefined interactiveButtons for plain text content', async () => {
      const baileysResult = {
        key: { id: 'text-send-1' },
        message: { conversation: 'Hello' },
      };
      const instance = buildSendInstance(baileysResult);
      (service as any).instances.set(`${TEST_USER_ID}:sendInstance`, instance);

      await service.send(TEST_USER_ID, 'sendInstance', '5511888888888', {
        text: 'Hello',
      });

      const mockChatStore = (service as any).chatStore as jest.Mocked<
        Partial<ChatStoreService>
      >;
      expect(mockChatStore.recordOutgoing).toHaveBeenCalledWith(
        TEST_USER_ID,
        'sendInstance',
        '5511888888888',
        'Hello',
        baileysResult,
        undefined,
      );
    });
  });
});
