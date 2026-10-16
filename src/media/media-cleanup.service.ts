import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Dirent } from 'fs';
import { lstat, readdir, unlink } from 'fs/promises';
import { join, resolve } from 'path';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(private readonly configService: ConfigService) {}

  @Cron('0 * * * *')
  async handleCleanup(): Promise<void> {
    const retentionDays = this.configService.get<number>(
      'mediaRetentionDays',
      0,
    );
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

    const mediaDir = resolve(
      this.configService.get<string>('mediaDir', './media'),
    );
    const cutoffMs = Date.now() - retentionDays * MILLISECONDS_PER_DAY;

    let entries: Dirent[];
    try {
      entries = await readdir(mediaDir, { withFileTypes: true });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(
          `Media cleanup could not scan the configured directory: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return;
    }

    let deleted = 0;
    let deletedBytes = 0;
    let failed = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filePath = join(mediaDir, entry.name);
      try {
        const fileStat = await lstat(filePath);
        if (!fileStat.isFile() || fileStat.mtimeMs >= cutoffMs) continue;

        await unlink(filePath);
        deleted++;
        deletedBytes += fileStat.size;
      } catch {
        failed++;
      }
    }

    if (deleted > 0) {
      const deletedMiB = (deletedBytes / 1024 / 1024).toFixed(2);
      this.logger.log(
        `Media cleanup: deleted ${deleted} file(s) (${deletedMiB} MiB) older than ${retentionDays} day(s)`,
      );
    }
    if (failed > 0) {
      this.logger.warn(`Media cleanup: failed to process ${failed} file(s)`);
    }
  }
}
