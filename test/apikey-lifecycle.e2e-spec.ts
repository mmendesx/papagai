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

describe('API key lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtToken: string;
  let accountApiKey: string;
  let instanceApiKey: string;

  const primaryInstanceName = 'keybot';
  const secondaryInstanceName = 'otherbot';

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    ({ token: jwtToken } = await registerAndLogin(app, {
      email: 'apikey_lifecycle@e2e.test',
      password: 'password123',
      name: 'ApiKey User',
    }));
  });

  afterAll(async () => {
    await truncateTables(prisma);
    await app.close();
  });

  it('creates an account-scoped API key using JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/apikeys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ name: 'Primary integration key' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.key).toMatch(/^ppg_acct_/);
    accountApiKey = res.body.key;
  });

  it('authenticates with X-Api-Key only (no JWT)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('X-Api-Key', accountApiKey);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('apikey_lifecycle@e2e.test');
  });

  it('enforces custom permissions for account-scoped API keys', async () => {
    const createRestrictedKeyRes = await request(app.getHttpServer())
      .post('/api/auth/apikeys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Restricted account key',
        permissions: ['instances:list'],
      });

    expect(createRestrictedKeyRes.status).toBe(201);
    expect(createRestrictedKeyRes.body.permissions).toEqual(['instances:list']);

    const restrictedKey = createRestrictedKeyRes.body.key;

    const listInstancesRes = await request(app.getHttpServer())
      .get('/api/instances')
      .set('X-Api-Key', restrictedKey);

    expect(listInstancesRes.status).toBe(200);

    const createInstanceRes = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('X-Api-Key', restrictedKey)
      .send({ name: 'forbiddenbot' });

    expect(createInstanceRes.status).toBe(403);

    const authMeRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('X-Api-Key', restrictedKey);

    expect(authMeRes.status).toBe(403);
  });

  it('creates account-scoped keys from default templates', async () => {
    const templatesRes = await request(app.getHttpServer())
      .get('/api/auth/apikeys/templates')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(templatesRes.status).toBe(200);
    expect(Array.isArray(templatesRes.body.templates)).toBe(true);
    expect(
      templatesRes.body.templates.some(
        (t: { id: string }) => t.id === 'read_only',
      ),
    ).toBe(true);

    const createTemplateKeyRes = await request(app.getHttpServer())
      .post('/api/auth/apikeys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Read-only template key',
        permissionsTemplate: 'read_only',
      });

    expect(createTemplateKeyRes.status).toBe(201);
    expect(Array.isArray(createTemplateKeyRes.body.permissions)).toBe(true);

    const templateKey = createTemplateKeyRes.body.key;

    const allowedListRes = await request(app.getHttpServer())
      .get('/api/instances')
      .set('X-Api-Key', templateKey);

    expect(allowedListRes.status).toBe(200);

    const forbiddenCreateRes = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('X-Api-Key', templateKey)
      .send({ name: 'forbidden-template-bot' });

    expect(forbiddenCreateRes.status).toBe(403);
  });

  it('manages instances using account API key only', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('X-Api-Key', accountApiKey)
      .send({ name: primaryInstanceName });

    expect(createRes.status).toBe(201);
    expect(createRes.body.instance).toBe(primaryInstanceName);

    const listRes = await request(app.getHttpServer())
      .get('/api/instances')
      .set('X-Api-Key', accountApiKey);

    expect(listRes.status).toBe(200);
    expect(listRes.body.instances.some((i: { name: string }) => i.name === primaryInstanceName)).toBe(true);

    const statusRes = await request(app.getHttpServer())
      .get(`/api/instances/${primaryInstanceName}/status`)
      .set('X-Api-Key', accountApiKey);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.name).toBe(primaryInstanceName);
  });

  it('manages chats/messages using account API key only', async () => {
    const sendRes = await request(app.getHttpServer())
      .post(`/api/instances/${primaryInstanceName}/messages`)
      .set('X-Api-Key', accountApiKey)
      .send({
        messaging_product: 'whatsapp',
        to: '5511999999999',
        type: 'text',
        text: { body: 'Hello from API key' },
      });

    expect([200, 201]).toContain(sendRes.status);
    expect(sendRes.body.messaging_product).toBe('whatsapp');
    expect(Array.isArray(sendRes.body.messages)).toBe(true);

    const chatsRes = await request(app.getHttpServer())
      .get(`/api/instances/${primaryInstanceName}/chats?include_messages=false`)
      .set('X-Api-Key', accountApiKey);

    expect(chatsRes.status).toBe(200);
    expect(chatsRes.body.instance).toBe(primaryInstanceName);
    expect(Array.isArray(chatsRes.body.chats)).toBe(true);
  });

  it('enforces instance scope for instance-scoped API keys', async () => {
    const createSecondRes = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('X-Api-Key', accountApiKey)
      .send({ name: secondaryInstanceName });

    expect(createSecondRes.status).toBe(201);

    const createScopedKeyRes = await request(app.getHttpServer())
      .post(`/api/instances/${primaryInstanceName}/apikeys`)
      .set('X-Api-Key', accountApiKey)
      .send({ name: 'Primary instance key' });

    expect(createScopedKeyRes.status).toBe(201);
    expect(createScopedKeyRes.body.key).toMatch(/^ppg_inst_/);
    instanceApiKey = createScopedKeyRes.body.key;

    const ownInstanceStatus = await request(app.getHttpServer())
      .get(`/api/instances/${primaryInstanceName}/status`)
      .set('X-Api-Key', instanceApiKey);

    expect(ownInstanceStatus.status).toBe(200);

    const listInstancesWithInstanceKey = await request(app.getHttpServer())
      .get('/api/instances')
      .set('X-Api-Key', instanceApiKey);

    expect(listInstancesWithInstanceKey.status).toBe(403);

    const createAccountKeyWithInstanceKey = await request(app.getHttpServer())
      .post('/api/auth/apikeys')
      .set('X-Api-Key', instanceApiKey)
      .send({ name: 'Escalation attempt key' });

    expect(createAccountKeyWithInstanceKey.status).toBe(403);

    const otherInstanceStatus = await request(app.getHttpServer())
      .get(`/api/instances/${secondaryInstanceName}/status`)
      .set('X-Api-Key', instanceApiKey);

    expect(otherInstanceStatus.status).toBe(403);
    expect(otherInstanceStatus.body.message).toContain(
      'API key is not authorized for this instance',
    );
  });
});
