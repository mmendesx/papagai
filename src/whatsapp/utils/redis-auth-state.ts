import { Redis } from 'ioredis';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

export async function useRedisAuthState(
  redis: Redis,
  userId: string,
  instanceName: string,
) {
  const prefix = `papagai:${userId}:${instanceName}`;

  const readData = async (key: string): Promise<any> => {
    const data = await redis.get(key);
    return data ? JSON.parse(data, BufferJSON.reviver) : null;
  };

  const writeData = async (key: string, data: unknown): Promise<void> => {
    await redis.set(key, JSON.stringify(data, BufferJSON.replacer));
  };

  const creds = (await readData(`${prefix}:creds`)) ?? initAuthCreds();

  const keys = {
    async get(type: string, ids: string[]): Promise<Record<string, any>> {
      const result: Record<string, any> = {};
      await Promise.all(
        ids.filter(Boolean).map(async (id) => {
          const value = await readData(`${prefix}:keys:${type}:${id}`);
          if (value != null) result[id] = value;
        }),
      );
      return result;
    },

    async set(data: Record<string, Record<string, unknown>>): Promise<void> {
      await Promise.all(
        Object.entries(data).flatMap(([type, entries]) =>
          Object.entries(entries).map(([id, value]) =>
            value != null
              ? writeData(`${prefix}:keys:${type}:${id}`, value)
              : redis.del(`${prefix}:keys:${type}:${id}`),
          ),
        ),
      );
    },
  };

  const saveCreds = async (): Promise<void> => {
    await writeData(`${prefix}:creds`, creds);
  };

  return { state: { creds, keys }, saveCreds };
}
