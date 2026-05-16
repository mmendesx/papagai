import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WhatsappService } from '../src/whatsapp/whatsapp.service';
import { FakeWhatsappService } from './helpers/fake-whatsapp.service';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';
import { registerAndLogin } from './helpers/auth-helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('getBase64FromMediaMessage (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let accountApiKey: string;
  let scopedApiKey: string;
  let mediaDir: string;
  const instanceName = 'media-web';
  const otherInstanceName = 'media-other';

  beforeAll(async () => {
    mediaDir = mkdtempSync(join(tmpdir(), 'papagai-media-e2e-'));
    process.env.MEDIA_DIR = mediaDir;
    ({ app, prisma } = await createTestApp());

    const auth = await registerAndLogin(app, {
      email: 'get_base64@e2e.test',
      password: 'password123',
      name: 'Get Base64 User',
    });
    token = auth.token;
    userId = auth.userId;

    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: instanceName })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: otherInstanceName })
      .expect(201);

    const apiKeyRes = await request(app.getHttpServer())
      .post('/api/auth/apikeys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Compatibility key',
        permissions: ['instances:chats:read'],
      })
      .expect(201);
    accountApiKey = apiKeyRes.body.key;

    const scopedKeyRes = await request(app.getHttpServer())
      .post(`/api/instances/${instanceName}/apikeys`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Scoped compatibility key' })
      .expect(201);
    scopedApiKey = scopedKeyRes.body.key;
  });

  afterAll(async () => {
    rmSync(mediaDir, { recursive: true, force: true });
    await truncateTables(prisma);
    await app.close();
  });

  beforeEach(() => {
    const fake = app.get<FakeWhatsappService>(WhatsappService);
    const imagePath = join(mediaDir, 'image.bin');
    writeFileSync(imagePath, Buffer.from('image-media-content'));
    fake.seedStoredMessage(userId, instanceName, {
      id: 'MSG-IMAGE-1',
      chatId: '5511999999999@s.whatsapp.net',
      fromMe: false,
      sender: 'Alice',
      type: 'image',
      body: 'photo',
      timestamp: Date.now(),
      mediaPath: imagePath,
      filename: 'image.bin',
      mimetype: 'image/jpeg',
      size: 19,
      caption: 'caption',
    });
    fake.seedStoredMessage(userId, instanceName, {
      id: 'MSG-TEXT-1',
      chatId: '5511999999999@s.whatsapp.net',
      fromMe: false,
      sender: 'Alice',
      type: 'text',
      body: 'hello',
      timestamp: Date.now(),
    });
    fake.seedStoredMessage(userId, instanceName, {
      id: 'MSG-MISSING-FILE-1',
      chatId: '5511999999999@s.whatsapp.net',
      fromMe: false,
      sender: 'Alice',
      type: 'audio',
      body: null,
      timestamp: Date.now(),
      mediaPath: join(mediaDir, 'missing.ogg'),
      filename: 'missing.ogg',
      mimetype: 'audio/ogg',
      size: 5,
    });
  });

  it('returns 422 when message.key.id is missing', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: {} } })
      .expect(422);
  });

  it('returns base64 with JWT auth', async () => {
    const res = await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: { id: 'MSG-IMAGE-1' } }, convertToMp4: false })
      .expect(200);

    expect(res.body.mediaType).toBe('imageMessage');
    expect(res.body.fileName).toBe('image.bin');
    expect(res.body.mimetype).toBe('image/jpeg');
    expect(res.body.size.fileLength).toBe(19);
    expect(res.body.base64).toBe(
      Buffer.from('image-media-content').toString('base64'),
    );
  });

  it('accepts X-Api-Key', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('X-Api-Key', accountApiKey)
      .send({ message: { key: { id: 'MSG-IMAGE-1' } } })
      .expect(200);
  });

  it('accepts apikey alias header', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('apikey', accountApiKey)
      .send({ message: { key: { id: 'MSG-IMAGE-1' } } })
      .expect(200);
  });

  it('forbids instance-scoped key on another instance', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${otherInstanceName}`)
      .set('X-Api-Key', scopedApiKey)
      .send({ message: { key: { id: 'MSG-IMAGE-1' } } })
      .expect(403);
  });

  it('returns clear non-media and not-found errors', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: { id: 'MSG-TEXT-1' } } })
      .expect(400);

    const missing = await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: { id: 'MISSING' } } })
      .expect(400);
    expect(missing.body.message).toContain('Message not found');
  });

  it('returns 400 when file is unavailable', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: { id: 'MSG-MISSING-FILE-1' } } })
      .expect(400);
  });

  it('returns 400 when convertToMp4 is true', async () => {
    await request(app.getHttpServer())
      .get(`/chat/getBase64FromMediaMessage/${instanceName}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: { id: 'MSG-IMAGE-1' } }, convertToMp4: true })
      .expect(400);
  });

  it('returns 400 for WBA instance', async () => {
    await request(app.getHttpServer())
      .post('/api/instances/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'sales-wba',
        provider: 'wba',
        wba: {
          businessAccountId: '12345',
          phoneNumberId: '67890',
          displayPhoneNumber: '+5511999999999',
          accessToken: 'EAAG-token',
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/chat/getBase64FromMediaMessage/sales-wba')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: { key: { id: 'WBA-MSG-1' } } })
      .expect(400);
  });
});
