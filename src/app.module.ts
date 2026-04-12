import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { InstancesModule } from './instances/instances.module.js';
import { WebhookModule } from './webhook/webhook.module.js';
import { MediaModule } from './media/media.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import configuration from './config/configuration.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    InstancesModule,
    WebhookModule,
    MediaModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client', 'dist', 'client', 'browser'),
      exclude: ['/api{/*path}', '/media{/*path}', '/uploads{/*path}'],
    }),
  ],
})
export class AppModule {}
