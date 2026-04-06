import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

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
  getQR: jest.fn(),
  disconnectInstance: jest.fn(),
  sendMessage: jest.fn(),
  getContactInfo: jest.fn(),
  getChats: jest.fn(),
  updateWebhookConfig: jest.fn(),
};

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
        { provide: InstancesService, useValue: mockService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({ sub: 'test', email: 'test@test.com', name: 'Test', role: 'admin' });
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
      mockService.getInstance.mockReturnValue({
        name: 'alpha',
        connected: true,
        startTime: Date.now(),
        socket: { user: { id: '5511999999999:1@s.whatsapp.net' } },
        webhookUrl: mockWebhook.url,
        webhookHeaders: mockWebhook.headers,
        webhookEnabled: mockWebhook.enabled,
        webhookEvents: mockWebhook.events,
      });

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances/alpha/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.webhook).toEqual(mockWebhook);
    });
  });

  describe('GET /api/instances', () => {
    it('list items include webhook object', async () => {
      mockService.getInstances.mockReturnValue([
        {
          name: 'alpha',
          connected: true,
          startTime: 1000,
          webhookEnabled: mockWebhook.enabled,
          webhook: mockWebhook,
        },
      ]);

      const res = await request(app.getHttpServer() as App)
        .get('/api/instances')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.instances).toHaveLength(1);
      expect(res.body.instances[0].webhook).toEqual(mockWebhook);
      expect(res.body.instances[0].webhookEnabled).toBe(true);
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
        'abc',
        'https://example.com/h',
        undefined,
        undefined,
        ['message', 'qr'],
      );
    });
  });
});
