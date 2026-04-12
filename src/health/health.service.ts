import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.redis = new Redis(configService.get<string>('redisUrl') ?? 'redis://localhost:6379');
  }

  async checkHealth(): Promise<{ db: string; redis: string; uptime: number }> {
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const handle = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(
          (v) => { clearTimeout(handle); resolve(v); },
          (e) => { clearTimeout(handle); reject(e); },
        );
      });

    const [dbResult, redisResult] = await Promise.allSettled([
      withTimeout(this.prisma.$queryRaw`SELECT 1`, 1500),
      withTimeout(this.redis.ping(), 1500),
    ]);

    const db = dbResult.status === 'fulfilled' ? 'ok' : 'error';
    const redis = redisResult.status === 'fulfilled' ? 'ok' : 'error';

    if (dbResult.status === 'rejected') {
      this.logger.warn(`DB health check failed: ${dbResult.reason?.message}`);
    }
    if (redisResult.status === 'rejected') {
      this.logger.warn(
        `Redis health check failed: ${redisResult.reason?.message}`,
      );
    }

    return { db, redis, uptime: process.uptime() };
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
