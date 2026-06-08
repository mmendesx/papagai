import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LlmsDocumentService } from './llms.document.service.js';

@Controller()
export class LlmsController {
  constructor(private readonly llmsDocumentService: LlmsDocumentService) {}

  @Get('llms.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  getLlmsTxt(@Res({ passthrough: true }) _res: Response): string {
    return this.llmsDocumentService.getDocument();
  }
}
