jest.mock('ioredis', () => {
  const mockRedis = {
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn(),
  };
  return { Redis: jest.fn(() => mockRedis) };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function getMockRedis() {
  const { Redis: RedisMock } = jest.requireMock<{ Redis: jest.Mock }>(
    'ioredis',
  );
  return RedisMock.mock.results[RedisMock.mock.results.length - 1]
    .value as jest.Mocked<{
    ping: jest.Mock;
    disconnect: jest.Mock;
  }>;
}

describe('HealthService', () => {
  let service: HealthService;
  let mockPrisma: { $queryRaw: jest.Mock };
  let mockRedis: { ping: jest.Mock; disconnect: jest.Mock };

  beforeEach(async () => {
    jest.useRealTimers();

    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    mockRedis = getMockRedis();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('returns ok for both db and redis when both succeed', async () => {
      const result = await service.checkHealth();

      expect(result.db).toBe('ok');
      expect(result.redis).toBe('ok');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns db error and logs warn when db query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.checkHealth();

      expect(result.db).toBe('error');
      expect(result.redis).toBe('ok');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DB health check failed'),
      );
    });

    it('returns redis error and logs warn when redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('redis unavailable'));
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.checkHealth();

      expect(result.db).toBe('ok');
      expect(result.redis).toBe('error');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Redis health check failed'),
      );
    });

    it('returns error for both when both fail', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'));
      mockRedis.ping.mockRejectedValue(new Error('redis down'));

      const result = await service.checkHealth();

      expect(result.db).toBe('error');
      expect(result.redis).toBe('error');
    });

    it('returns db error when db query times out after 1500ms', async () => {
      jest.useFakeTimers();

      mockPrisma.$queryRaw.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([{ '?column?': 1 }]), 5000),
          ),
      );
      // Redis resolves instantly (no timers involved)
      mockRedis.ping.mockResolvedValue('PONG');

      const healthPromise = service.checkHealth();
      await jest.advanceTimersByTimeAsync(1600);

      const result = await healthPromise;

      expect(result.db).toBe('error');
      expect(result.redis).toBe('ok');
    });

    it('returns redis error when redis ping times out after 1500ms', async () => {
      jest.useFakeTimers();

      mockRedis.ping.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 5000)),
      );
      // DB resolves instantly (no timers involved)
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const healthPromise = service.checkHealth();
      await jest.advanceTimersByTimeAsync(1600);

      const result = await healthPromise;

      expect(result.db).toBe('ok');
      expect(result.redis).toBe('error');
    });
  });

  describe('onModuleDestroy', () => {
    it('calls redis.disconnect when module is destroyed', () => {
      service.onModuleDestroy();

      expect(mockRedis.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
