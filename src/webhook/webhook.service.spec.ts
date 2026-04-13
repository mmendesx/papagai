jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '203.0.113.1', family: 4 }]),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { of, throwError } from 'rxjs';
import { WebhookService } from './webhook.service';
import { WEBHOOK_DELIVERY_QUEUE } from './webhook-queue.module';
import {
  Instance,
  WebhookData,
} from '../whatsapp/interfaces/whatsapp.interface';

function buildInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    userId: 'user-test-123',
    name: 'test-instance',
    webhookUrl: 'https://example.com/webhook',
    webhookHeaders: {},
    webhookEnabled: true,
    webhookEvents: [
      'message',
      'message_update',
      'qr',
      'connected',
      'disconnected',
    ],
    connected: true,
    qr: null,
    socket: {} as any,
    saveCreds: jest.fn(),
    startTime: Date.now(),
    lastConnectedAt: null,
    retryCount: 0,
    ...overrides,
  };
}

const minimalWebhookData: WebhookData = {
  event: 'message',
  instance: 'test',
};

describe('WebhookService', () => {
  let service: WebhookService;
  let httpPost: jest.Mock;

  beforeEach(async () => {
    httpPost = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: HttpService,
          useValue: { post: httpPost },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(false) },
        },
        {
          provide: getQueueToken(WEBHOOK_DELIVERY_QUEUE),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  describe('Scenario 17 — Webhook sent on text message receipt', () => {
    it('makes a POST request to the instance webhookUrl', async () => {
      const instance = buildInstance();
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      await service.sendWebhook(instance, minimalWebhookData);

      expect(httpPost).toHaveBeenCalledTimes(1);
      const [url] = httpPost.mock.calls[0];
      expect(url).toBe(instance.webhookUrl);
    });

    it('includes X-Papagai-Instance header set to the instance name', async () => {
      const instance = buildInstance({ name: 'my-instance' });
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      await service.sendWebhook(instance, minimalWebhookData);

      const [, , options] = httpPost.mock.calls[0];
      expect(options.headers['X-Papagai-Instance']).toBe('my-instance');
    });

    it('includes X-Papagai-Event header set to the event name', async () => {
      const instance = buildInstance({ webhookEvents: ['message.received'] });
      const data: WebhookData = {
        ...minimalWebhookData,
        event: 'message.received',
      };
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      await service.sendWebhook(instance, data);

      const [, , options] = httpPost.mock.calls[0];
      expect(options.headers['X-Papagai-Event']).toBe('message.received');
    });

    it('merges custom webhookHeaders from the instance into the request headers', async () => {
      const instance = buildInstance({
        webhookHeaders: {
          Authorization: 'Bearer secret-token',
          'X-Custom-Header': 'custom-value',
        },
      });
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      await service.sendWebhook(instance, minimalWebhookData);

      const [, , options] = httpPost.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer secret-token');
      expect(options.headers['X-Custom-Header']).toBe('custom-value');
    });
  });

  describe('Scenario 21 — Webhook failure is silent', () => {
    it('does not re-throw when the HTTP call fails with an Error', async () => {
      const instance = buildInstance();
      httpPost.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      await expect(
        service.sendWebhook(instance, minimalWebhookData),
      ).resolves.toBeUndefined();
    });

    it('does not re-throw when the HTTP call throws synchronously', async () => {
      const instance = buildInstance();
      httpPost.mockImplementation(() => {
        throw new Error('Unexpected sync error');
      });

      await expect(
        service.sendWebhook(instance, minimalWebhookData),
      ).resolves.toBeUndefined();
    });
  });

  describe('Scenario — No webhook if webhookEnabled is false', () => {
    it('makes no HTTP request when webhookEnabled is false', async () => {
      const instance = buildInstance({ webhookEnabled: false });

      await service.sendWebhook(instance, minimalWebhookData);

      expect(httpPost).not.toHaveBeenCalled();
    });

    it('resolves without throwing when webhookEnabled is false', async () => {
      const instance = buildInstance({ webhookEnabled: false });

      await expect(
        service.sendWebhook(instance, minimalWebhookData),
      ).resolves.toBeUndefined();
    });
  });

  describe('Scenario — No webhook if event is not in webhookEvents', () => {
    it('makes no HTTP request when event is not in the allowed list', async () => {
      const instance = buildInstance({ webhookEvents: ['qr', 'connected'] });
      const data: WebhookData = { event: 'message', instance: 'test' };

      await service.sendWebhook(instance, data);

      expect(httpPost).not.toHaveBeenCalled();
    });

    it('resolves without throwing when event is filtered out', async () => {
      const instance = buildInstance({ webhookEvents: [] });

      await expect(
        service.sendWebhook(instance, minimalWebhookData),
      ).resolves.toBeUndefined();
    });
  });

  describe('Scenario 22 — No webhook if webhookUrl is null', () => {
    it('makes no HTTP request when webhookUrl is null', async () => {
      const instance = buildInstance({ webhookUrl: null });

      await service.sendWebhook(instance, minimalWebhookData);

      expect(httpPost).not.toHaveBeenCalled();
    });

    it('resolves without throwing when webhookUrl is null', async () => {
      const instance = buildInstance({ webhookUrl: null });

      await expect(
        service.sendWebhook(instance, minimalWebhookData),
      ).resolves.toBeUndefined();
    });
  });
});
