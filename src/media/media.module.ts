import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaUrlService } from './media-url.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaUrlService],
  exports: [MediaUrlService],
})
export class MediaModule {}
