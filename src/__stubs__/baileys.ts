// CJS-compatible stub for @whiskeysockets/baileys.
// Baileys v7 is ESM-only and cannot be loaded by ts-jest running in CJS mode.
// This stub is mapped via moduleNameMapper so unit tests never load the real
// ESM package.  All symbols that source files import at module-load time are
// exported here with no-op or minimal implementations.
//
// Runtime behaviour is always provided by per-test mocks of the services that
// consume these symbols (e.g. WhatsappService is mocked in all 3 failing suites).
// This file must compile under the main tsconfig.json (no jest types) so no
// jest.fn() calls appear here — keep it to plain values and functions only.

// ---- value symbols -------------------------------------------------------

export function initAuthCreds(): Record<string, unknown> {
  return {
    noiseKey: {},
    signedIdentityKey: {},
    signedPreKey: {},
    registrationId: 0,
    advSecretKey: '',
    nextPreKeyId: 0,
    firstUnuploadedPreKeyId: 0,
    accountSyncCounter: 0,
    accountSettings: {},
    deviceId: '',
    phoneId: '',
    identityId: Buffer.alloc(0),
    registered: false,
    backupToken: Buffer.alloc(0),
    registration: {},
    pairingEphemeralKeyPair: {},
    pairingCode: undefined,
    lastAccountSyncTimestamp: undefined,
    myAppStateKeyId: undefined,
    account: undefined,
    me: undefined,
    routingInfo: undefined,
  };
}

export const BufferJSON = {
  replacer: (_key: string, value: unknown) => value,
  reviver: (_key: string, value: unknown) => value,
};

export const DisconnectReason = {
  connectionClosed: 428,
  connectionLost: 408,
  connectionReplaced: 440,
  timedOut: 408,
  loggedOut: 401,
  badSession: 500,
  restartRequired: 515,
  multideviceMismatch: 411,
};

export function downloadContentFromMessage(
  _message: unknown,
  _type: unknown,
): Promise<never> {
  return Promise.reject(
    new Error(
      'downloadContentFromMessage is not available in unit tests — mock the service that calls it',
    ),
  );
}

export function fetchLatestBaileysVersion(): Promise<{
  version: [number, number, number];
  isLatest: boolean;
}> {
  return Promise.resolve({ version: [2, 3000, 0], isLatest: true });
}

export function fetchLatestWaWebVersion(): Promise<{
  version: [number, number, number];
  isLatest: boolean;
}> {
  return Promise.resolve({ version: [2, 3000, 0], isLatest: true });
}

// Default export — makeWASocket
function makeWASocket(_config: unknown): Record<string, unknown> {
  throw new Error(
    'makeWASocket is not available in unit tests — mock WhatsappService instead',
  );
}

export default makeWASocket;

// ---- type-only exports (erased at runtime by TypeScript) -----------------
// WASocket is used only as a type in whatsapp.interface.ts.
// Exporting an alias of unknown satisfies the import without any runtime cost.
export type WASocket = Record<string, unknown>;
