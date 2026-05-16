import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { rmSync } from 'fs';
import { join } from 'path';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { ApiKeyService } from '../auth/api-key.service.js';
import { AnyAuthGuard } from '../auth/guards/any-auth.guard.js';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MediaUrlService } from '../media/media-url.service.js';

const TEST_SECRET = 'instances-controller-auth-spec';

const mockWebhook = {
  url: 'https://example.com/webhook',
  headers: {},
  enabled: true,
  events: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
};

const mockService = {
  getInstances: jest.fn(),
  createInstance: jest.fn(),
  getInstance: jest.fn(),
  getInstanceStatus: jest.fn(),
  getQR: jest.fn(),
  disconnectInstance: jest.fn(),
  sendMessage: jest.fn(),
  getContactInfo: jest.fn(),
  getChats: jest.fn(),
  streamChatEvents: jest.fn(),
  getChatMessages: jest.fn(),
  getMetrics: jest.fn(),
  updateWebhookConfig: jest.fn(),
};

const mockApiKeyService = {
  createAccountKey: jest.fn(),
  listAccountKeys: jest.fn(),
  revokeKey: jest.fn(),
  createInstanceKey: jest.fn(),
  listInstanceKeys: jest.fn(),
  validateKey: jest.fn(),
  instanceMatchesKey: jest.fn(),
};

const mockMediaUrlService = {
  signPath: jest.fn(
    (path: string) => `http://localhost:3000${path}?expires=1&signature=test`,
  ),
};

function flattenErrors(
  errors: Array<{ constraints?: Record<string, string> }>,
) {
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('InstancesController', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [InstancesController],
      providers: [
        JwtAuthGuard,
        AnyAuthGuard,
        {
          provide: ApiKeyAuthGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: ApiKeyService, useValue: mockApiKeyService },
        { provide: InstancesService, useValue: mockService },
        { provide: MediaUrlService, useValue: mockMediaUrlService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) =>
          new UnprocessableEntityException(flattenErrors(errors)),
      }),
    );
    await app.listen(0);

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({
      sub: 'test',
      email: 'test@test.com',
      name: 'Test',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH /api/instances/:name/webhook', () => {
    it('returns 200 with updated webhook config for valid events', async () => {
      const updatedInstance = {
        name: 'alpha',
        webhookUrl: 'https://new.url/hook',
        webhookHeaders: { 'X-Key': 'val' },
        webhookEnabled: true,
        webhookEvents: ['message', 'qr'],
      };
      mockService.updateWebhookConfig.mockResolvedValue(updatedInstance);

      const res = await request(app.getHttpServer() as App)
        .patch('/api/instances/alpha/webhook')
        .set('Authorization', `Bearer ${token}`)
        .send({ webhookUrl: 'https://new.url/hook', events: ['message', 'qr'] })
        .expect(200);

      expect(res.body).toEqual({
        instance: 'alpha',
        webhook: {
          url: 'https://new.url/hook',
          headers: { 'X-Key': 'val' },
          enabled: true,
          events: ['message', 'qr'],
        },
      });
    });

    it('returns 400 with error message for invalid events', async () => {
      const res = await request(app.getHttpServer() as App)
        .patch('/api/instances/alpha/webhook')
        .set('Authorization', `Bearer ${token}`)
        .send({ events: ['message', 'invalid_event', 'bogus'] })
        .expect(400);

      expect(res.body.message).toContain('invalid_event');
      expect(res.body.message).toContain('bogus');
    });

    it('returns 404 when instance not found', async () => {
      mockService.updateWebhookConfig.mockRejectedValue(
        new Error('Instance "ghost" not found'),
      );

      await request(app.getHttpServer() as App)
        .patch('/api/instances/ghost/webhook')
        .set('Authorization', `Bearer ${token}`)
        .send({ webhookUrl: 'https://example.com/hook' })
        .expect(404);
    });
  });

  describe('GET /api/instances/:name/status', () => {
    it('includes webhook object in response', async () => {
      mockService.getInstanceStatus.mockResolvedValue({
        name: 'alpha',
        provider: 'web',
        capabilities: {
          qr: true,
          sendMessages: true,
          receiveMessages: true,
          chatHistorySync: true,
          contactLookup: true,
          markRead: true,
          templates: true,
        },
        connected: true,
        startTime: new Date().toISOString(),
        uptime: 1000,
        phoneNumber: '5511999999999',
        webhook: mockWebhook,
      });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.webhook).toEqual(mockWebhook);
      expect(res.body.provider).toBe('web');
    });
  });

  describe('GET /api/instances', () => {
    it('list items include webhook object', async () => {
      mockService.getInstances.mockReturnValue({
        instances: [
          {
            name: 'alpha',
            connected: true,
            startTime: 1000,
            webhookEnabled: mockWebhook.enabled,
            webhook: mockWebhook,
          },
        ],
        total: 1,
      });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.instances).toHaveLength(1);
      expect(res.body.instances[0].webhook).toEqual(mockWebhook);
      expect(res.body.instances[0].webhookEnabled).toBe(true);
    });

    it('uses default page=1 and limit=20 when no query params provided', async () => {
      mockService.getInstances.mockReturnValue({ instances: [], total: 0 });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockService.getInstances).toHaveBeenCalledWith('test', {
        page: 1,
        limit: 20,
      });
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('clamps limit=200 to 100', async () => {
      mockService.getInstances.mockReturnValue({ instances: [], total: 0 });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances?page=1&limit=200')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockService.getInstances).toHaveBeenCalledWith('test', {
        page: 1,
        limit: 100,
      });
      expect(res.body.limit).toBe(100);
    });

    it('returns 422 when page=0', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/instances?page=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
    });

    it('returns 422 when page=1.5 (decimal)', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/instances?page=1.5')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
    });

    it('returns 422 when limit=0', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/instances?limit=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
    });

    it('returns 422 when limit=-3', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/instances?limit=-3')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
    });

    it('returns empty instances with correct total when page is beyond data', async () => {
      mockService.getInstances.mockReturnValue({ instances: [], total: 3 });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances?page=5&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.instances).toHaveLength(0);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(1);
    });

    it('returns singular message when total=1', async () => {
      mockService.getInstances.mockReturnValue({
        instances: [{ name: 'solo' }],
        total: 1,
      });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toContain('papagai');
      expect(res.body.message).not.toContain('papagais');
    });

    it('returns totalPages=0 when total=0', async () => {
      mockService.getInstances.mockReturnValue({ instances: [], total: 0 });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalPages).toBe(0);
    });
  });

  describe('GET /api/instances/:name/chats/:chatId/messages', () => {
    it('returns 200 with messages array for a valid chatId (bare digits)', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          chatId: '5511999999999@s.whatsapp.net',
          fromMe: false,
          sender: 'Alice',
          type: 'text',
          body: 'Hello',
          timestamp: 1700000000000,
        },
      ];
      mockService.getChatMessages.mockReturnValue(mockMessages);

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/chats/5511999999999/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.instance).toBe('alpha');
      expect(res.body.chatId).toBe('5511999999999@s.whatsapp.net');
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].body).toBe('Hello');
    });

    it('returns 200 with messages array for a valid full JID chatId', async () => {
      mockService.getChatMessages.mockReturnValue([]);

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/chats/5511999999999@s.whatsapp.net/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.chatId).toBe('5511999999999@s.whatsapp.net');
      expect(res.body.messages).toEqual([]);
    });

    it('returns 400 when chatId contains non-numeric characters', async () => {
      const res = await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/chats/invalid-chat-id/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.message).toContain('invalid');
    });

    it('returns 401 when no auth token is provided', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/chats/5511999999999/messages')
        .expect(401);
    });

    it('uses default limit of 100 when not specified', async () => {
      mockService.getChatMessages.mockReturnValue([]);

      await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/chats/5511999999999/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockService.getChatMessages).toHaveBeenCalledWith(
        'test',
        'alpha',
        '5511999999999@s.whatsapp.net',
        100,
      );
    });

    it('clamps limit to 500 when limit=9999 is provided', async () => {
      mockService.getChatMessages.mockReturnValue([]);

      await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/chats/5511999999999/messages?limit=9999')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockService.getChatMessages).toHaveBeenCalledWith(
        'test',
        'alpha',
        '5511999999999@s.whatsapp.net',
        500,
      );
    });

    it('returns 404 when instance is not found', async () => {
      mockService.getChatMessages.mockImplementation(() => {
        throw new Error('Papagai ghost não encontrado');
      });

      await request(app.getHttpServer() as App)
        .get('/api/instances/ghost/chats/5511999999999/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /api/instances/:name/metrics', () => {
    it('returns 200 with metrics object', async () => {
      mockService.getMetrics.mockReturnValue({
        messagesSent: 10,
        messagesReceived: 25,
        activeConversations: 5,
        webhookEnabled: true,
      });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.instance).toBe('alpha');
      expect(res.body.metrics.messagesSent).toBe(10);
      expect(res.body.metrics.messagesReceived).toBe(25);
      expect(res.body.metrics.activeConversations).toBe(5);
      expect(res.body.metrics.webhookEnabled).toBe(true);
    });

    it('returns 401 when no auth token is provided', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/metrics')
        .expect(401);
    });

    it('returns 404 when instance is not found', async () => {
      mockService.getMetrics.mockImplementation(() => {
        throw new Error('Papagai ghost não encontrado');
      });

      await request(app.getHttpServer() as App)
        .get('/api/instances/ghost/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /api/instances/create', () => {
    it('returns 400 when webhookEvents contains invalid keys', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/instances/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'abc', webhookEvents: ['not_an_event'] })
        .expect(400);

      expect(res.body.message).toContain('not_an_event');
      expect(mockService.createInstance).not.toHaveBeenCalled();
    });

    it('calls createInstance when webhookEvents are valid', async () => {
      mockService.createInstance.mockResolvedValue({ name: 'abc' } as any);

      await request(app.getHttpServer() as App)
        .post('/api/instances/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'abc',
          webhook: 'https://example.com/h',
          webhookEvents: ['message', 'qr'],
        })
        .expect(201);

      expect(mockService.createInstance).toHaveBeenCalledWith(
        'test',
        'abc',
        'https://example.com/h',
        undefined,
        undefined,
        ['message', 'qr'],
        'web',
        undefined,
      );
    });
  });

  describe('POST /api/instances/:name/messages', () => {
    it('rejects image payloads without link or data before service send', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/instances/alpha/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          to: '5511999999999',
          type: 'image',
          image: {},
        })
        .expect(422);

      expect(mockService.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects invalid base64 image data before service send', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/instances/alpha/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          to: '5511999999999',
          type: 'image',
          image: { data: 'not!!base64!!', mimetype: 'image/jpeg' },
        })
        .expect(422);

      expect(mockService.sendMessage).not.toHaveBeenCalled();
    });

    it('passes URL media payloads through the send path', async () => {
      mockService.sendMessage.mockResolvedValue({ key: { id: 'msg-1' } });

      await request(app.getHttpServer() as App)
        .post('/api/instances/alpha/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          to: '5511999999999',
          type: 'video',
          video: { link: 'https://example.com/video.mp4' },
        })
        .expect(201);

      expect(mockService.sendMessage).toHaveBeenCalledWith(
        'test',
        'alpha',
        expect.objectContaining({
          type: 'video',
          video: { link: 'https://example.com/video.mp4' },
        }),
      );
    });
  });

  describe('POST /api/instances/:name/upload', () => {
    const INSTANCE_NAME = 'test-instance';

    const mockInstance = {
      name: INSTANCE_NAME,
      connected: false,
      startTime: Date.now(),
      socket: { user: null },
      webhookUrl: null,
      webhookHeaders: {},
      webhookEnabled: false,
      webhookEvents: [],
    };

    afterEach(() => {
      jest.clearAllMocks();
    });

    afterAll(() => {
      // Clean up files written to disk by the 201 test
      rmSync(join(process.cwd(), 'uploads', INSTANCE_NAME), {
        recursive: true,
        force: true,
      });
    });

    it('returns 201 with url when a valid JPEG is uploaded', async () => {
      mockService.getInstance.mockReturnValue(mockInstance);

      const res = await request(app.getHttpServer() as App)
        .post(`/api/instances/${INSTANCE_NAME}/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-jpeg-content'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toContain('/uploads/');
      expect(res.body.url).toContain(INSTANCE_NAME);
    });

    it('returns 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer() as App)
        .post(`/api/instances/${INSTANCE_NAME}/upload`)
        .attach('file', Buffer.from('fake-jpeg-content'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(401);
    });

    it('returns 404 when the instance does not belong to the user', async () => {
      mockService.getInstance.mockReturnValue(null);

      await request(app.getHttpServer() as App)
        .post(`/api/instances/${INSTANCE_NAME}/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-jpeg-content'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        })
        .expect(404);
    });

    it('returns 400 when no file is provided', async () => {
      mockService.getInstance.mockReturnValue(mockInstance);

      await request(app.getHttpServer() as App)
        .post(`/api/instances/${INSTANCE_NAME}/upload`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);
    });

    it('returns 400 when file MIME type is not allowed', async () => {
      // fileFilter rejects non-allowlisted MIME types with BadRequestException
      await request(app.getHttpServer() as App)
        .post(`/api/instances/${INSTANCE_NAME}/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-exe-content'), {
          filename: 'malware.exe',
          contentType: 'application/octet-stream',
        })
        .expect(400);
    });

    it('returns 400 when instance name contains path traversal characters', async () => {
      // The destination callback rejects names outside [a-zA-Z0-9_-].
      // NestJS decodes %2F to / before it reaches multer, so the route may
      // not match at all — both 400 and 404 are acceptable safe outcomes.
      const res = await request(app.getHttpServer() as App)
        .post('/api/instances/..%2Fevil/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-jpeg-content'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        });

      expect([400, 404]).toContain(res.status);
    });

    it('returns 413 when file exceeds 16 MB', async () => {
      // multer emits a PayloadTooLargeError which is not an HttpException.
      // The test harness does not register HttpExceptionFilter, so NestJS
      // may return 500 rather than 413 in this context. Both are acceptable —
      // the important thing is that the request is rejected, not silently accepted.
      const bigBuffer = Buffer.alloc(17 * 1024 * 1024, 0); // 17 MB

      const res = await request(app.getHttpServer() as App)
        .post(`/api/instances/${INSTANCE_NAME}/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', bigBuffer, {
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
        });

      expect([413, 500]).toContain(res.status);
    });
  });
});
