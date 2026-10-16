import { ConfigService } from '@nestjs/config';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MediaCleanupService } from './media-cleanup.service';

function createService(
  mediaDir: string,
  retentionDays: number,
): MediaCleanupService {
  const values: Record<string, unknown> = {
    mediaDir,
    mediaRetentionDays: retentionDays,
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService;

  return new MediaCleanupService(configService);
}

describe('MediaCleanupService', () => {
  it('deletes only regular media files older than the configured retention', async () => {
    const mediaDir = mkdtempSync(join(tmpdir(), 'papagai-media-cleanup-'));
    try {
      const oldFile = join(mediaDir, 'old-video.mp4');
      const recentFile = join(mediaDir, 'recent-image.jpg');
      const nestedDirectory = join(mediaDir, 'preserved-directory');
      writeFileSync(oldFile, 'old');
      writeFileSync(recentFile, 'recent');
      mkdirSync(nestedDirectory);

      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      utimesSync(oldFile, oldDate, oldDate);

      await createService(mediaDir, 7).handleCleanup();

      expect(existsSync(oldFile)).toBe(false);
      expect(existsSync(recentFile)).toBe(true);
      expect(existsSync(nestedDirectory)).toBe(true);
    } finally {
      rmSync(mediaDir, { recursive: true, force: true });
    }
  });

  it('preserves media files when retention cleanup is disabled', async () => {
    const mediaDir = mkdtempSync(join(tmpdir(), 'papagai-media-cleanup-'));
    try {
      const oldFile = join(mediaDir, 'old-document.pdf');
      writeFileSync(oldFile, 'old');
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      utimesSync(oldFile, oldDate, oldDate);

      await createService(mediaDir, 0).handleCleanup();

      expect(existsSync(oldFile)).toBe(true);
    } finally {
      rmSync(mediaDir, { recursive: true, force: true });
    }
  });

  it('returns safely when the configured media directory does not exist', async () => {
    const missingDir = join(
      tmpdir(),
      `papagai-missing-media-${Date.now()}-${Math.random()}`,
    );

    await expect(createService(missingDir, 7).handleCleanup()).resolves.toBe(
      undefined,
    );
  });
});
