import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { InstancesModule } from './instances/instances.module.js';
import { WebhookModule } from './webhook/webhook.module.js';
import { MediaModule } from './media/media.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import configuration from './config/configuration.js';
import { InstanceConfig } from './instances/entities/instance-config.entity.js';
import { User } from './auth/entities/user.entity.js';
import { ApiKey } from './auth/entities/api-key.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('db.host'),
        port: config.get<number>('db.port'),
        username: config.get('db.user'),
        password: config.get('db.pass'),
        database: config.get('db.name'),
        entities: [InstanceConfig, User, ApiKey],
        synchronize: config.get<string>('nodeEnv') === 'development',
        migrationsRun: false,
        migrations: [join(__dirname, 'migrations', '*.js')],
      }),
    }),
    ScheduleModule.forRoot(),
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
