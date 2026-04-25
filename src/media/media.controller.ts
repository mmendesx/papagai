import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { join } from 'path';
import { MediaUrlService } from './media-url.service.js';

const SAFE_FILE_RE = /^[a-zA-Z0-9_.-]+$/;
const SAFE_INSTANCE_RE = /^[a-zA-Z0-9_-]+$/;

@Controller()
export class MediaController {
  constructor(
    private readonly mediaUrlService: MediaUrlService,
    private readonly configService: ConfigService,
  ) {}

  @Get('media/:filename')
  serveMedia(
    @Param('filename') filename: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ): void {
    this.assertSafeFile(filename);
    this.mediaUrlService.verifyPath(`/media/${filename}`, expires, signature);
    res.sendFile(filename, {
      root: this.configService.get<string>('mediaDir', './media'),
    });
  }

  @Get('uploads/:name/:filename')
  serveUpload(
    @Param('name') name: string,
    @Param('filename') filename: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ): void {
    if (!SAFE_INSTANCE_RE.test(name)) {
      throw new BadRequestException('Invalid instance name');
    }
    this.assertSafeFile(filename);
    this.mediaUrlService.verifyPath(
      `/uploads/${encodeURIComponent(name)}/${filename}`,
      expires,
      signature,
    );
    res.sendFile(filename, { root: join(process.cwd(), 'uploads', name) });
  }

  private assertSafeFile(filename: string): void {
    if (!SAFE_FILE_RE.test(filename)) {
      throw new BadRequestException('Invalid media filename');
    }
  }
}
