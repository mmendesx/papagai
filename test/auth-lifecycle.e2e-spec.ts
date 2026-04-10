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

describe('Auth lifecycle (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  const email = 'alice_auth@e2e.test';
  const password = 'password123';
  let userId: string;
  let token: string;

  it('registers successfully and returns user + JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Alice', email, password, appKey: 'ci-app-key' });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.accessToken).toBeTruthy();
    userId = res.body.user.id;
  });

  it('logs in with valid credentials and returns JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.id).toBe(userId);
    token = res.body.accessToken;
  });

  it('accesses /api/auth/me with valid JWT', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('rejects /api/auth/me without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Alice2', email, password, appKey: 'ci-app-key' });
    expect(res.status).toBe(409);
  });
});
