import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { InstancesService } from './instances.service.js';
import { InstancesController } from './instances.controller.js';
import { InstanceConfig } from './entities/instance-config.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([InstanceConfig]), WhatsappModule, AuthModule],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
