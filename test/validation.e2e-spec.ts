jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest
    .fn()
    .mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
}));

import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';
import { registerAndLogin } from './helpers/auth-helpers';

describe('Validation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    ({ app, prisma } = (await createTestApp()) as {
      app: NestExpressApplication;
      prisma: PrismaService;
    });
    const { token } = await registerAndLogin(app, {
      email: 'validation_app_e2e@test.com',
      name: 'Validation E2E',
    });
    authHeader = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await truncateTables(prisma);
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/instances/create with invalid name returns 422 with structured body', () => {
    return request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'ab/cd' })
      .expect(422)
      .expect((res) => {
        expect(res.body.statusCode).toBe(422);
        expect(res.body.path).toBe('/api/instances/create');
        expect(res.body.timestamp).toBeDefined();
        expect(() => new Date(res.body.timestamp)).not.toThrow();
        expect(new Date(res.body.timestamp).toString()).not.toBe(
          'Invalid Date',
        );
        expect(res.body.message).toBeDefined();
      });
  });

  it('POST /api/instances/create with valid name succeeds (delegates to mocked service)', () => {
    return request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'validBot' })
      .expect(201);
  });
});
