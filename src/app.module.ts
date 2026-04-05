import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstancesModule } from './instances/instances.module.js';
import { WebhookModule } from './webhook/webhook.module.js';
import { MediaModule } from './media/media.module.js';
import configuration from './config/configuration.js';
import { InstanceConfig } from './instances/entities/instance-config.entity.js';

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
        entities: [InstanceConfig],
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    InstancesModule,
    WebhookModule,
    MediaModule,
  ],
})
export class AppModule {}
