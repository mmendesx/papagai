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

describe('Webhook config (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let carolToken: string;
  let daveToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    ({ token: carolToken } = await registerAndLogin(app, {
      email: 'carol_webhook@e2e.test',
      password: 'password123',
      name: 'Carol',
    }));

    ({ token: daveToken } = await registerAndLogin(app, {
      email: 'dave_webhook@e2e.test',
      password: 'password123',
      name: 'Dave',
    }));

    // Create instance "hookbot" for carol
    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ name: 'hookbot' });
  });

  afterAll(async () => {
    await truncateTables(prisma);
    await app.close();
  });

  it('owner PATCH succeeds with 200', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/instances/hookbot/webhook')
      .set('Authorization', `Bearer ${carolToken}`)
      .send({
        webhookUrl: 'http://example.com/hook',
        enabled: true,
        events: ['message'],
      });
    expect(res.status).toBe(200);
    expect(res.body.webhook.url).toBe('http://example.com/hook');
    expect(res.body.webhook.enabled).toBe(true);
  });

  it('non-owner PATCH returns 404', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/instances/hookbot/webhook')
      .set('Authorization', `Bearer ${daveToken}`)
      .send({ webhookUrl: 'http://example.com/hook' });
    expect(res.status).toBe(404);
  });

  it('invalid webhook URL returns 400', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/instances/hookbot/webhook')
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ webhookUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });
});
