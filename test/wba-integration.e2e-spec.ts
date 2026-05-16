import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';
import { registerAndLogin } from './helpers/auth-helpers';

function signBody(body: unknown, secret: string): string {
  const raw = JSON.stringify(body);
  const digest = createHmac('sha256', secret).update(raw).digest('hex');
  return `sha256=${digest}`;
}

describe('WBA integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const { token } = await registerAndLogin(app, {
      email: 'wba_e2e@test.com',
      name: 'WBA E2E',
    });
    authHeader = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await truncateTables(prisma);
    await app.close();
  });

  it('creates default web provider when provider is omitted', async () => {
    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'default-web' })
      .expect(201);

    const status = await request(app.getHttpServer())
      .get('/api/instances/default-web/status')
      .set(authHeader)
      .expect(200);

    expect(status.body.provider).toBe('web');
    expect(status.body.capabilities.qr).toBe(true);
  });

  it('rejects missing wba block when provider is wba', async () => {
    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'wba-missing', provider: 'wba' })
      .expect(422);
  });

  it('rejects wba block when provider is web', async () => {
    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({
        name: 'web-with-wba',
        provider: 'web',
        wba: {
          businessAccountId: '12345',
          phoneNumberId: '67890',
          displayPhoneNumber: '+55 11 99999-9999',
          accessToken: 'EAAG-token',
        },
      })
      .expect(422);
  });

  it('creates wba provider and hides secrets from response', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({
        name: 'sales-wba',
        provider: 'wba',
        wba: {
          businessAccountId: '2233445566',
          phoneNumberId: '12345',
          displayPhoneNumber: '+55 11 99999-9999',
          accessToken: 'EAAG-secret-token',
          appSecret: 'app-secret-value',
          webhookVerifyToken: 'verify-token-1',
        },
      })
      .expect(201);

    expect(JSON.stringify(create.body)).not.toContain('EAAG-secret-token');
    expect(create.body.provider).toBe('wba');
    expect(create.body.capabilities.qr).toBe(false);
  });

  it('returns wba capabilities and gates unsupported endpoints', async () => {
    const status = await request(app.getHttpServer())
      .get('/api/instances/sales-wba/status')
      .set(authHeader)
      .expect(200);

    expect(status.body.provider).toBe('wba');
    expect(status.body.capabilities.qr).toBe(false);
    expect(status.body.capabilities.sendMessages).toBe(true);

    await request(app.getHttpServer())
      .get('/api/instances/sales-wba/qr')
      .set(authHeader)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/instances/sales-wba/contact/5511999999999')
      .set(authHeader)
      .expect(400);
  });

  it('sends text and template messages through the shared send endpoint', async () => {
    const textSend = await request(app.getHttpServer())
      .post('/api/instances/sales-wba/messages')
      .set(authHeader)
      .send({
        to: '5511999999999',
        type: 'text',
        text: { body: 'hello from wba' },
      })
      .expect(201);
    expect(textSend.body.messages[0].id).toBe('wamid.fake');

    await request(app.getHttpServer())
      .post('/api/instances/sales-wba/messages')
      .set(authHeader)
      .send({
        to: '5511999999999',
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'pt_BR' },
        },
      })
      .expect(201);
  });

  it('rejects provider-incompatible interactive payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/instances/sales-wba/messages')
      .set(authHeader)
      .send({
        to: '5511999999999',
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: 'Open link' },
          action: { parameters: { display_text: 'Open', url: 'https://x.y' } },
        },
      })
      .expect(400);
  });

  it('verifies webhook challenge token and rejects bad token', async () => {
    await request(app.getHttpServer())
      .get('/api/wba/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'verify-token-1',
        'hub.challenge': 'challenge-ok',
      })
      .expect(200)
      .expect('challenge-ok');

    await request(app.getHttpServer())
      .get('/api/wba/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'bad-token',
        'hub.challenge': 'challenge-fail',
      })
      .expect(403);
  });

  it('rejects invalid webhook signatures and ingests valid incoming/status updates idempotently', async () => {
    const incomingPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '12345' },
                contacts: [{ profile: { name: 'Inbound Contact' } }],
                messages: [
                  {
                    id: 'wamid.in.dup-1',
                    from: '5511888888888',
                    timestamp: '1710001000',
                    type: 'text',
                    text: { body: 'Inbound hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/api/wba/webhook')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .send(incomingPayload)
      .expect(403);

    const validSignature = signBody(incomingPayload, 'app-secret-value');
    await request(app.getHttpServer())
      .post('/api/wba/webhook')
      .set('x-hub-signature-256', validSignature)
      .send(incomingPayload)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/wba/webhook')
      .set('x-hub-signature-256', validSignature)
      .send(incomingPayload)
      .expect(200);

    const chats = await request(app.getHttpServer())
      .get('/api/instances/sales-wba/chats')
      .set(authHeader)
      .expect(200);
    expect(chats.body.total).toBeGreaterThan(0);

    const messages = await request(app.getHttpServer())
      .get('/api/instances/sales-wba/chats/5511888888888/messages')
      .set(authHeader)
      .expect(200);
    expect(messages.body.messages).toHaveLength(1);

    const statusPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '12345' },
                statuses: [{ id: 'wamid.fake', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    };
    await request(app.getHttpServer())
      .post('/api/wba/webhook')
      .set('x-hub-signature-256', signBody(statusPayload, 'app-secret-value'))
      .send(statusPayload)
      .expect(200);
  });

  it('ignores unowned phone number ids without mutating state', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '99999' },
                messages: [
                  {
                    id: 'wamid.unknown',
                    from: '5511777777777',
                    timestamp: '1710002000',
                    type: 'text',
                    text: { body: 'Should be ignored' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/api/wba/webhook')
      .send(payload)
      .expect(200);
  });
});
