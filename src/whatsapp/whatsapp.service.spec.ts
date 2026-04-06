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

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Boom } from '@hapi/boom';
import { WhatsappService } from './whatsapp.service';
import { WebhookService } from '../webhook/webhook.service';
import { Instance } from './interfaces/whatsapp.interface';
import { InstanceConfig } from '../instances/entities/instance-config.entity';

const { DisconnectReason } = jest.requireMock('@whiskeysockets/baileys') as {
  DisconnectReason: { loggedOut: number };
};

const mockSocketEnd = jest.fn();

const mockSocket = {
  ev: {
    on: jest.fn(),
  },
  end: mockSocketEnd,
  user: { id: '5511999999999:1@s.whatsapp.net' },
};

const makeWASocketMock = jest.fn(() => mockSocket);

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
    fetchLatestWaWebVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 1], error: undefined }),
    fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 1] }),
  };
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

function buildMockInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    name: 'testPapagai',
    socket: { end: jest.fn(), ev: { on: jest.fn() } } as any,
    webhookUrl: 'https://example.com/webhook',
    webhookHeaders: {},
    webhookEnabled: true,
    webhookEvents: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
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

    mockWebhookService = { sendWebhook: jest.fn().mockResolvedValue(undefined) };

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
          provide: getRepositoryToken(InstanceConfig),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  describe('Scenario 2 — createInstance throws on duplicate name', () => {
    it('throws an error containing "já existe" when the instance name is already registered', async () => {
      const existing = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', existing);

      await expect(service.createInstance('testPapagai')).rejects.toThrow(
        'já existe',
      );
    });

    it('does not call makeWASocket when the duplicate guard triggers', async () => {
      const makeWASocket = jest.requireMock('@whiskeysockets/baileys').default as jest.Mock;
      const existing = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', existing);

      await expect(service.createInstance('testPapagai')).rejects.toThrow();

      expect(makeWASocket).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 8 — disconnectInstance removes from registry', () => {
    it('returns true when the instance exists', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', instance);

      const result = await service.disconnectInstance('testPapagai');

      expect(result).toBe(true);
    });

    it('removes the instance from the internal Map', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', instance);

      await service.disconnectInstance('testPapagai');

      expect((service as any).instances.has('testPapagai')).toBe(false);
    });

    it('returns null from getQR after disconnect', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', instance);
      (service as any).qrCodes.set('testPapagai', 'some-qr-value');

      await service.disconnectInstance('testPapagai');

      expect(service.getQR('testPapagai')).toBeNull();
    });

    it('calls socket.end on the instance socket', async () => {
      const socketEnd = jest.fn();
      const instance = buildMockInstance({
        name: 'testPapagai',
        socket: { end: socketEnd, ev: { on: jest.fn() } } as any,
      });
      (service as any).instances.set('testPapagai', instance);

      await service.disconnectInstance('testPapagai');

      expect(socketEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 9 — disconnectInstance for non-existent instance', () => {
    it('returns false when the instance does not exist', async () => {
      const result = await service.disconnectInstance('ghost');

      expect(result).toBe(false);
    });
  });

  describe('getInstances returns correct shape', () => {
    it('returns an array with name, connected, and startTime for each registered instance', () => {
      const startTimeA = Date.now() - 10000;
      const startTimeB = Date.now() - 5000;

      const instanceA = buildMockInstance({
        name: 'alpha',
        connected: true,
        startTime: startTimeA,
      });
      const instanceB = buildMockInstance({
        name: 'beta',
        connected: false,
        startTime: startTimeB,
      });

      (service as any).instances.set('alpha', instanceA);
      (service as any).instances.set('beta', instanceB);

      const result = service.getInstances();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        name: 'alpha',
        connected: true,
        startTime: startTimeA,
        webhookEnabled: true,
        webhook: {
          url: 'https://example.com/webhook',
          headers: {},
          enabled: true,
          events: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
        },
      });
      expect(result).toContainEqual({
        name: 'beta',
        connected: false,
        startTime: startTimeB,
        webhookEnabled: true,
        webhook: {
          url: 'https://example.com/webhook',
          headers: {},
          enabled: true,
          events: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
        },
      });
    });

    it('returns an empty array when no instances are registered', () => {
      const result = service.getInstances();

      expect(result).toEqual([]);
    });
  });

  describe('getQR returns null when no QR stored', () => {
    it('returns null for an instance with no QR code', () => {
      const instance = buildMockInstance({ name: 'testPapagai', qr: null });
      (service as any).instances.set('testPapagai', instance);

      const result = service.getQR('testPapagai');

      expect(result).toBeNull();
    });

    it('returns null for a name that was never registered', () => {
      const result = service.getQR('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getInstance returns undefined for missing instance', () => {
    it('returns undefined when the requested instance name does not exist', () => {
      const result = service.getInstance('ghost');

      expect(result).toBeUndefined();
    });
  });

  describe('updateWebhookConfig', () => {
    it('throws when instance does not exist', async () => {
      await expect(
        service.updateWebhookConfig('ghost', { webhookUrl: 'https://new.url/hook' }),
      ).rejects.toThrow('Instance "ghost" not found');
    });

    it('updates in-memory instance properties', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', instance);

      await service.updateWebhookConfig('testPapagai', {
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

    it('calls instanceConfigRepo.update with correct fields', async () => {
      const instance = buildMockInstance({ name: 'testPapagai' });
      (service as any).instances.set('testPapagai', instance);

      const mockRepo = (service as any).instanceConfigRepo;

      await service.updateWebhookConfig('testPapagai', {
        webhookUrl: 'https://updated.url/hook',
        webhookEnabled: false,
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        { name: 'testPapagai' },
        { webhookUrl: 'https://updated.url/hook', webhookEnabled: false },
      );
    });
  });

  describe('createInstance webhook enabled when no URL', () => {
    it('sets webhookEnabled false when no URL even if parameter is true', async () => {
      await service.createInstance('noUrlForcedEnabled', undefined, {}, true);
      const inst = service.getInstance('noUrlForcedEnabled');
      expect(inst?.webhookEnabled).toBe(false);
      expect(inst?.webhookUrl).toBeNull();
    });

    it('defaults webhookEnabled true when URL is provided and flag omitted', async () => {
      await service.createInstance('withUrlDefault', 'https://hook.example/x');
      const inst = service.getInstance('withUrlDefault');
      expect(inst?.webhookEnabled).toBe(true);
      expect(inst?.webhookUrl).toBe('https://hook.example/x');
    });
  });

  describe('Scenario 22 — no webhook HTTP call when webhookUrl is null', () => {
    it('calls webhookService.sendWebhook with an instance whose webhookUrl is null when no URL is provided', async () => {
      await service.createInstance('noWebhookInstance');

      // Find and invoke the connection.update handler registered by createInstance
      const connectionCall = (mockSocket.ev.on as jest.Mock).mock.calls.find(
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
      await service.createInstance('logoutInstance');
      expect(service.getInstance('logoutInstance')).toBeDefined();

      const connectionCall = (mockSocket.ev.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      const connectionHandler = connectionCall[1] as (update: any) => void;

      const logoutError = new Boom('Logged out', { statusCode: DisconnectReason.loggedOut });
      connectionHandler({ connection: 'close', lastDisconnect: { error: logoutError } });

      expect(service.getInstance('logoutInstance')).toBeUndefined();
    });

    it('sends a disconnected webhook with willReconnect: false on logout', async () => {
      await service.createInstance('logoutInstance2');

      const connectionCall = (mockSocket.ev.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      const connectionHandler = connectionCall[1] as (update: any) => void;

      const logoutError = new Boom('Logged out', { statusCode: DisconnectReason.loggedOut });
      connectionHandler({ connection: 'close', lastDisconnect: { error: logoutError } });

      expect(mockWebhookService.sendWebhook).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ event: 'disconnected', willReconnect: false }),
      );
    });

    it('does not schedule a reconnect on logout', async () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await service.createInstance('logoutInstance3');

      const connectionCall = (mockSocket.ev.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === 'connection.update',
      );
      const connectionHandler = connectionCall[1] as (update: any) => void;

      const logoutError = new Boom('Logged out', { statusCode: DisconnectReason.loggedOut });
      connectionHandler({ connection: 'close', lastDisconnect: { error: logoutError } });

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
