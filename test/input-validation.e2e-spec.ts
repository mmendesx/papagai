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
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';
import { registerAndLogin } from './helpers/auth-helpers';

describe('Input validation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token } = await registerAndLogin(app, {
      email: 'validation_user@e2e.test',
      password: 'password123',
      name: 'Validation User',
    }));
  });

  afterAll(async () => {
    await truncateTables(prisma);
    await app.close();
  });

  it('name with disallowed chars returns 422 with structured body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ab/cd' });
    // createTestApp uses exceptionFactory → UnprocessableEntityException (422)
    expect(res.status).toBe(422);
    expect(res.body.statusCode).toBe(422);
    expect(res.body.message).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.path).toBeDefined();
  });

  it('name too long (65 chars) returns 422', async () => {
    const longName = 'a'.repeat(65);
    const res = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: longName });
    expect(res.status).toBe(422);
    expect(res.body.statusCode).toBe(422);
  });

  it('wrong password returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'validation_user@e2e.test', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('unknown email returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@e2e.test', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('missing required field (name) on register returns 422', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'missing@e2e.test',
        password: 'password123',
        appKey: 'ci-app-key',
      });
    expect(res.status).toBe(422);
    expect(res.body.statusCode).toBe(422);
  });

  it('wrong appKey returns 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Bad Key User',
        email: 'badkey@e2e.test',
        password: 'password123',
        appKey: 'wrong-key',
      });
    expect(res.status).toBe(403);
  });
});
