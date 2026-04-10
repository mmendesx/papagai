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

describe('Instance lifecycle (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    ({ token } = await registerAndLogin(app, {
      email: 'lifecycle@e2e.test',
      password: 'password123',
      name: 'Lifecycle User',
    }));
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it('creates an instance and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'mybot' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.instance).toBe('mybot');
  });

  it('returns status 200 with connected: false for existing instance', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/instances/mybot/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('mybot');
    expect(res.body.connected).toBe(false);
  });

  it('lists instances and returns total: 1', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/instances')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.instances).toHaveLength(1);
    expect(res.body.instances[0].name).toBe('mybot');
  });

  it('deletes the instance and returns 200', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/instances/mybot')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.instance).toBe('mybot');
  });

  it('returns 404 for status after deletion', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/instances/mybot/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
