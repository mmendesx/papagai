import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { InstancesService } from './instances.service.js';
import { InstancesController } from './instances.controller.js';
import { UploadCleanupService } from './upload-cleanup.service.js';

@Module({
  imports: [
    WhatsappModule,
    AuthModule,
  ],
  controllers: [InstancesController],
  providers: [InstancesService, UploadCleanupService],
  exports: [InstancesService],
})
export class InstancesModule {}
