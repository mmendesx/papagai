import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadCleanupService {
  private readonly logger = new Logger(UploadCleanupService.name);

  @Cron('0 * * * *') // Run at the top of every hour
  handleCleanup(): void {
    const ttlHours = parseInt(process.env.UPLOAD_TTL_HOURS ?? '24', 10);
    const cutoffMs = Date.now() - ttlHours * 3_600_000;
    const uploadsDir = join(process.cwd(), 'uploads');

    if (!existsSync(uploadsDir)) return;

    let deleted = 0;

    for (const entry of readdirSync(uploadsDir)) {
      const instancePath = join(uploadsDir, entry);

      let instanceStat: ReturnType<typeof statSync>;
      try {
        instanceStat = statSync(instancePath);
      } catch {
        continue;
      }
      if (!instanceStat.isDirectory()) continue;

      for (const file of readdirSync(instancePath)) {
        const filePath = join(instancePath, file);
        try {
          const { mtimeMs } = statSync(filePath);
          if (mtimeMs < cutoffMs) {
            unlinkSync(filePath);
            deleted++;
          }
        } catch {
          // Skip files that can't be stat'd or deleted (locked, missing race)
        }
      }
    }

    if (deleted > 0) {
      this.logger.log(`Upload cleanup: deleted ${deleted} file(s) older than ${ttlHours}h`);
    }
  }
}
