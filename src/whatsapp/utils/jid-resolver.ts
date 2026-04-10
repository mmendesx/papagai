import { Logger } from '@nestjs/common';
import { phoneNumberToJid } from './jid.js';

export async function resolveJid(
  socket: any,
  to: string,
  logger: Logger,
): Promise<string> {
  const candidateJid = phoneNumberToJid(to);
  try {
    const results = await socket.onWhatsApp(candidateJid);
    const match = results?.[0];
    if (match?.exists && match?.jid) {
      logger.debug(`onWhatsApp resolved ${to} → ${match.jid}`);
      return match.jid;
    }
    // Number not found with 9-digit; try without if it was inserted
    const fallbackJid = phoneNumberToJid(
      to.replace(/^55(\d{2})9(\d{8})$/, '55$1$2'),
    );
    if (fallbackJid !== candidateJid) {
      const fallbackResults = await socket.onWhatsApp(fallbackJid);
      const fallbackMatch = fallbackResults?.[0];
      if (fallbackMatch?.exists && fallbackMatch?.jid) {
        logger.debug(
          `onWhatsApp resolved ${to} via fallback → ${fallbackMatch.jid}`,
        );
        return fallbackMatch.jid;
      }
    }
    logger.warn(`${to} not found on WhatsApp (tried ${candidateJid})`);
  } catch (err) {
    logger.warn(
      `onWhatsApp check failed for ${to}: ${err instanceof Error ? err.message : String(err)} — using constructed JID`,
    );
  }
  return candidateJid;
}
