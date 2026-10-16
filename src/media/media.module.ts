import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaUrlService } from './media-url.service.js';
import { MediaCleanupService } from './media-cleanup.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaUrlService, MediaCleanupService],
  exports: [MediaUrlService],
})
export class MediaModule {}
