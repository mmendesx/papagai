import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmsController } from './llms.controller.js';
import { LlmsDocumentService } from './llms.document.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [LlmsController],
  providers: [LlmsDocumentService],
})
export class LlmsModule {}
