import { Logger } from '@nestjs/common';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

export const MAX_RECONNECT_RETRIES = 5;

export interface ReconnectionContext {
  maxRetries: number;
  logger: Logger;
  webhookService: { sendWebhook(instance: any, data: any): Promise<void> };
  /**
   * Called when the instance should be removed from all in-memory maps (instances + qrCodes).
   * Invoked on conflict, loggedOut, and max-retries-exceeded paths.
   */
  onRemoveFromMaps: (key: string) => void;
  /**
   * Called when we want to reconnect the instance after a delay.
   * The reconnection-manager already wraps this in a setTimeout.
   */
  onReconnect: (key: string, retryCount: number) => void;
  /**
   * Called to purge Redis + DB storage for a cleanly logged-out instance.
   * Not called on sync-failure logout (retry without purge).
   */
  onPurge: (userId: string, instanceName: string) => Promise<void>;
}

export function handleConnectionClose(
  instance: any,
  lastDisconnect: any,
  context: ReconnectionContext,
): void {
  const {
    maxRetries,
    logger,
    webhookService,
    onRemoveFromMaps,
    onReconnect,
    onPurge,
  } = context;

  const statusCode =
    lastDisconnect?.error instanceof Boom
      ? lastDisconnect.error.output?.statusCode
      : null;
  const isLoggedOut = statusCode === DisconnectReason.loggedOut;
  const isConflict = statusCode === 440;

  const retryCount = instance.retryCount + 1;
  const willReconnect = !isLoggedOut && !isConflict && retryCount <= maxRetries;

  const key = `${instance.userId}:${instance.name}`;

  logger.warn(
    `Instance "${instance.name}" disconnected — statusCode=${statusCode}, attempt=${retryCount}/${maxRetries}, willReconnect=${willReconnect}`,
  );

  const data = {
    event: 'disconnected',
    instance: instance.name,
    reason: lastDisconnect?.error?.message || 'Unknown',
    willReconnect,
    timestamp: Date.now(),
  };
  webhookService.sendWebhook(instance, data).catch(() => undefined);

  if (isConflict) {
    instance.connected = false;
    onRemoveFromMaps(key);
    logger.warn(
      `Instance "${key}" replaced by another session (conflict) — not reconnecting`,
    );
    return;
  }

  if (isLoggedOut) {
    instance.connected = false;
    onRemoveFromMaps(key);

    const connectedDurationMs = instance.lastConnectedAt
      ? Date.now() - instance.lastConnectedAt
      : null;
    const isSyncFailure =
      connectedDurationMs !== null && connectedDurationMs < 10_000;

    if (isSyncFailure) {
      // Baileys self-logout due to app state sync race condition on fresh connection.
      // Keys saved during the brief session may be needed — retry without purging.
      logger.warn(
        `Instance "${key}" hit app state sync failure (connected for ${connectedDurationMs}ms) — retrying without purge`,
      );
      setTimeout(() => onReconnect(key, 0), 3000);
    } else {
      onPurge(instance.userId, instance.name).catch((err: unknown) =>
        logger.error(
          `Failed to purge logged-out instance "${key}": ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
    return;
  }

  instance.connected = false;
  instance.retryCount = retryCount;

  if (retryCount > maxRetries) {
    logger.error(
      `Instance "${key}" gave up reconnecting after ${maxRetries} attempts`,
    );
    instance.connected = false;
    onRemoveFromMaps(key);
    return;
  }

  setTimeout(() => onReconnect(key, retryCount), 5000);
}
