jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '203.0.113.1', family: 4 }]),
}));

jest.mock('./webhook-url-validator.js', () => ({
  validateOrThrow: jest.fn().mockResolvedValue(undefined),
  WebhookUrlInvalidError: class WebhookUrlInvalidError extends Error {
    readonly reason: string;
    constructor(reason: string, message: string) {
      super(message);
      this.name = 'WebhookUrlInvalidError';
      this.reason = reason;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { of, throwError } from 'rxjs';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { WebhookJobData } from './webhook-queue.module';
import {
  validateOrThrow,
  WebhookUrlInvalidError,
} from './webhook-url-validator';

function buildJob(
  overrides: Partial<Job<WebhookJobData>> = {},
): Job<WebhookJobData> {
  return {
    data: {
      instanceName: 'test',
      webhookUrl: 'https://example.com',
      webhookHeaders: {},
      webhookEnabled: true,
      webhookEvents: ['message'],
      event: 'message',
      payload: {},
    },
    attemptsMade: 0,
    opts: { attempts: 4 },
    token: 'token',
    moveToFailed: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Job<WebhookJobData>;
}

describe('WebhookDeliveryProcessor', () => {
  let processor: WebhookDeliveryProcessor;
  let httpPost: jest.Mock;
  let mockValidateOrThrow: jest.MockedFunction<typeof validateOrThrow>;

  beforeEach(async () => {
    httpPost = jest.fn();
    mockValidateOrThrow = validateOrThrow as jest.MockedFunction<
      typeof validateOrThrow
    >;
    mockValidateOrThrow.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryProcessor,
        {
          provide: HttpService,
          useValue: { post: httpPost },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(false) },
        },
      ],
    }).compile();

    processor = module.get<WebhookDeliveryProcessor>(WebhookDeliveryProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Successful dispatch on first attempt', () => {
    it('resolves without error when HTTP post succeeds', async () => {
      const job = buildJob();
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      await expect(processor.process(job)).resolves.toBeUndefined();
    });

    it('makes the HTTP POST to the webhookUrl in the job data', async () => {
      const job = buildJob();
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      await processor.process(job);

      expect(httpPost).toHaveBeenCalledTimes(1);
      const [url] = httpPost.mock.calls[0];
      expect(url).toBe('https://example.com');
    });
  });

  describe('Scenario: Successful retry logs at info level', () => {
    it('calls logger.log with instance, event, and attempt when attemptsMade > 0', async () => {
      // Build a job that looks like a retry (attemptsMade = 1)
      const job = buildJob({ attemptsMade: 1 });
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      const logSpy = jest
        .spyOn(processor['logger'], 'log')
        .mockImplementation(() => undefined);

      await processor.process(job);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('instance=test'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('event=message'),
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('attempt=2'));
    });

    it('does NOT call logger.log on first-attempt success (attemptsMade === 0)', async () => {
      const job = buildJob({ attemptsMade: 0 });
      httpPost.mockReturnValue(of({ data: 'ok', status: 200 }));

      const logSpy = jest
        .spyOn(processor['logger'], 'log')
        .mockImplementation(() => undefined);

      await processor.process(job);

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: SSRF-blocked URL moves job to failed immediately', () => {
    it('calls job.moveToFailed and does not make any HTTP request', async () => {
      const job = buildJob();
      mockValidateOrThrow.mockRejectedValueOnce(
        new WebhookUrlInvalidError('private_address', 'blocked'),
      );

      await processor.process(job);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(job.moveToFailed).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(job.moveToFailed).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'SSRF-blocked address' }),
        'token',
      );
      expect(httpPost).not.toHaveBeenCalled();
    });

    it('returns without throwing after moving to failed', async () => {
      const job = buildJob();
      mockValidateOrThrow.mockRejectedValueOnce(
        new WebhookUrlInvalidError('private_address', 'blocked'),
      );

      await expect(processor.process(job)).resolves.toBeUndefined();
    });
  });

  describe('Scenario: HTTP failure re-throws for BullMQ retry', () => {
    it('re-throws the error so BullMQ can schedule a retry', async () => {
      const job = buildJob();
      const networkError = new Error('Connection refused');
      httpPost.mockReturnValue(throwError(() => networkError));

      await expect(processor.process(job)).rejects.toThrow(
        'Connection refused',
      );
    });
  });

  describe('Scenario: Final attempt logs warn before re-throwing', () => {
    it('calls logger.warn when all attempts are exhausted', async () => {
      const job = buildJob({ attemptsMade: 3, opts: { attempts: 4 } });
      const networkError = new Error('Network failure');
      httpPost.mockReturnValue(throwError(() => networkError));

      const warnSpy = jest
        .spyOn(processor['logger'], 'warn')
        .mockImplementation(() => undefined);

      await expect(processor.process(job)).rejects.toThrow('Network failure');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook delivery exhausted'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('instance=test'),
      );
    });
  });
});
