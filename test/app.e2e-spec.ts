jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest
    .fn()
    .mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';
import { registerAndLogin } from './helpers/auth-helpers';

describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    ({ app, prisma } = (await createTestApp()) as {
      app: NestExpressApplication;
      prisma: PrismaService;
    });
    const { token } = await registerAndLogin(app, {
      email: 'app_e2e@test.com',
      name: 'App E2E',
    });
    authHeader = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await truncateTables(prisma);
    await app.close();
  });

  it('GET /api/instances returns instance list', () => {
    return request(app.getHttpServer() as App)
      .get('/api/instances')
      .set(authHeader)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(0);
        expect(res.body.instances).toEqual([]);
      });
  });

  it('GET /api/instances without Authorization returns 401', () => {
    return request(app.getHttpServer() as App)
      .get('/api/instances')
      .expect(401);
  });

  it('POST /api/instances/create with invalid name returns 422', () => {
    return request(app.getHttpServer() as App)
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'ab/cd' })
      .expect(422);
  });
});
