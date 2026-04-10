jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    ev: { on: jest.fn() },
    end: jest.fn(),
    user: null,
  })),
  useMultiFileAuthState: jest
    .fn()
    .mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
  fetchLatestWaWebVersion: jest
    .fn()
    .mockResolvedValue({ version: [2, 3000, 1] }),
  fetchLatestBaileysVersion: jest
    .fn()
    .mockResolvedValue({ version: [2, 3000, 1] }),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';
import { registerAndLogin } from './helpers/auth-helpers';

describe('Cross-user isolation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());

    ({ token: tokenA } = await registerAndLogin(app, {
      email: 'userA_isolation@e2e.test',
      password: 'password123',
      name: 'User A',
    }));

    ({ token: tokenB } = await registerAndLogin(app, {
      email: 'userB_isolation@e2e.test',
      password: 'password123',
      name: 'User B',
    }));

    // Create instance "alpha" for user A
    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'alpha' });
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it("user B cannot get status of user A's instance (404)", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/instances/alpha/status')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("user B cannot delete user A's instance (404)", async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/instances/alpha')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("user B cannot patch user A's instance webhook (404)", async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/instances/alpha/webhook')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ webhookUrl: 'http://example.com/hook' });
    expect(res.status).toBe(404);
  });

  it("user A's list does not contain user B's instances", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/instances')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.instances[0].name).toBe('alpha');
  });
});
