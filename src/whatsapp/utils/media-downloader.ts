import { Logger } from '@nestjs/common';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import { MediaFile } from '../interfaces/whatsapp.interface.js';

export const MEDIA_EXTENSION_FALLBACK: Record<string, string> = {
  image: 'jpg',
  audio: 'ogg',
  video: 'mp4',
  document: 'bin',
  sticker: 'webp',
};

export async function downloadMedia(
  msg: any,
  mediaType: string,
  mediaDir: string,
  logger: Logger,
): Promise<MediaFile | null> {
  try {
    const messageKey = `${mediaType}Message`;
    const mediaMessage: any = msg.message?.[messageKey] ?? null;
    if (!mediaMessage) return null;

    const stream = await downloadContentFromMessage(
      mediaMessage,
      mediaType as any,
    );

    const mimeType: string = mediaMessage.mimetype || '';
    const extensionFromMime = mimeType.split('/')[1];
    const extension =
      extensionFromMime || MEDIA_EXTENSION_FALLBACK[mediaType] || 'bin';

    const fileName = `${Date.now()}_${mediaType}.${extension}`;
    const filePath = path.join(mediaDir, fileName);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, buffer);

    return {
      path: filePath,
      url: `/media/${fileName}`,
      filename: fileName,
      mimetype: mimeType,
      size: mediaMessage.fileLength ?? buffer.length,
      caption: mediaMessage.caption || null,
      duration: mediaMessage.seconds ?? undefined,
    };
  } catch (error) {
    logger.error(
      `Failed to download ${mediaType} media for message ${msg.key?.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

export function parseVCard(vcard: string): string[] {
  const numbers: string[] = [];
  const regex = /TEL[^:]*:([^\r\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(vcard)) !== null) {
    const number = match[1].trim();
    if (number) numbers.push(number);
  }
  return numbers;
}
