import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockPrismaService: {
    apiKey: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
    instanceConfig: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      apiKey: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      instanceConfig: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(ApiKeyService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createAccountKey', () => {
    it('returns raw key and stores hash not plaintext', async () => {
      const fakeRecord = {
        id: 'key-id-1',
        userId: 'user-1',
        instanceId: null,
        name: 'My Key',
        prefix: 'ppg_acct_7xKq',
        enabled: true,
        expiresAt: null,
        lastUsedAt: null,
        permissions: [],
        createdAt: new Date(),
      };
      mockPrismaService.apiKey.create.mockResolvedValue(fakeRecord);

      const result = await service.createAccountKey('user-1', 'My Key');

      expect(result.key).toBeDefined();
      expect(typeof result.key).toBe('string');

      const createCall = mockPrismaService.apiKey.create.mock.calls[0][0];
      expect(createCall.data).toHaveProperty('keyHash');
      expect(createCall.data.keyHash).not.toBe(result.key);

      expect(createCall.data.prefix).toBe(result.key.slice(0, 12));
    });
  });

  describe('validateKey', () => {
    it('resolves with userId, instanceId, keyId, permissions for a valid enabled non-expired key', async () => {
      mockPrismaService.apiKey.findUnique.mockResolvedValue({
        id: 'key-id-1',
        userId: 'user-1',
        instanceId: null,
        enabled: true,
        expiresAt: null,
        permissions: [],
      });

      const result = await service.validateKey('ppg_acct_somerawkey');

      expect(result).toEqual({
        userId: 'user-1',
        instanceId: null,
        keyId: 'key-id-1',
        permissions: [],
      });
    });

    it('throws UnauthorizedException for a disabled key', async () => {
      mockPrismaService.apiKey.findUnique.mockResolvedValue({
        id: 'key-id-1',
        userId: 'user-1',
        instanceId: null,
        enabled: false,
        expiresAt: null,
        permissions: [],
      });

      await expect(service.validateKey('ppg_acct_somerawkey')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException with "expired" message and fires async disable for an expired key', async () => {
      mockPrismaService.apiKey.findUnique.mockResolvedValue({
        id: 'key-id-1',
        userId: 'user-1',
        instanceId: null,
        enabled: true,
        expiresAt: new Date(Date.now() - 1000),
        permissions: [],
      });

      await expect(service.validateKey('ppg_acct_somerawkey')).rejects.toThrow(
        'API key has expired',
      );

      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-id-1' },
          data: { enabled: false },
        }),
      );
    });

    it('throws UnauthorizedException for an unknown key', async () => {
      mockPrismaService.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.validateKey('ppg_acct_unknownkey')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('fires a lastUsedAt update after validating a valid key', async () => {
      mockPrismaService.apiKey.findUnique.mockResolvedValue({
        id: 'key-id-1',
        userId: 'user-1',
        instanceId: null,
        enabled: true,
        expiresAt: null,
        permissions: [],
      });

      await service.validateKey('ppg_acct_somerawkey');

      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-id-1' },
          data: { lastUsedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('revokeKey', () => {
    it('resolves without throwing when the key is found and deleted', async () => {
      mockPrismaService.apiKey.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.revokeKey('user-1', 'key-id-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when no key is deleted (count=0)', async () => {
      mockPrismaService.apiKey.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeKey('user-1', 'key-id-missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createInstanceKey', () => {
    it('throws NotFoundException containing the instance name when instance does not exist', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.createInstanceKey('user-1', 'my-instance', 'My Key'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createInstanceKey('user-1', 'my-instance', 'My Key'),
      ).rejects.toThrow('my-instance');
    });
  });
});
