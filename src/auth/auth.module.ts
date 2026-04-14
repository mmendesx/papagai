import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';
import { ApiKeyService } from './api-key.service.js';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard.js';
import { AnyAuthGuard } from './guards/any-auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwtSecret'),
        signOptions: {
          expiresIn: (config.get<string>('jwtExpiresIn') ??
            '24h') as StringValue,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const throttlers = [
          {
            ttl: config.getOrThrow<number>('authThrottleTtl') * 1000,
            limit: config.getOrThrow<number>('authThrottleLimit'),
          },
        ];

        if (config.get<string>('nodeEnv') === 'test') {
          return { throttlers };
        }

        return {
          throttlers,
          storage: new ThrottlerStorageRedisService(
            config.getOrThrow<string>('redisUrl'),
          ),
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    AuthThrottlerGuard,
    ApiKeyService,
    ApiKeyAuthGuard,
    AnyAuthGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtModule,
    ApiKeyService,
    ApiKeyAuthGuard,
    AnyAuthGuard,
  ],
})
export class AuthModule {}
