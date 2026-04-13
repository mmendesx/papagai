import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstancesService } from './instances.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

jest.mock('../webhook/webhook-url-validator.js', () => ({
  validateOrThrow: jest.fn(),
  WebhookUrlInvalidError: class WebhookUrlInvalidError extends Error {},
}));

import {
  validateOrThrow,
  WebhookUrlInvalidError,
} from '../webhook/webhook-url-validator.js';

describe('InstancesService', () => {
  let service: InstancesService;
  let mockWhatsappService: {
    createInstance: jest.Mock;
    getInstance: jest.Mock;
    updateWebhookConfig: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockWhatsappService = {
      createInstance: jest.fn().mockResolvedValue({ name: 'test-instance' }),
      getInstance: jest.fn(),
      updateWebhookConfig: jest.fn().mockResolvedValue({}),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstancesService,
        { provide: WhatsappService, useValue: mockWhatsappService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(InstancesService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createInstance', () => {
    it('delegates to WhatsappService and skips URL validation when no webhook URL is provided', async () => {
      await service.createInstance('user-1', 'my-papagai');

      expect(mockWhatsappService.createInstance).toHaveBeenCalledWith(
        'user-1',
        'my-papagai',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(validateOrThrow).not.toHaveBeenCalled();
    });

    it('validates the webhook URL before delegating when a URL is provided', async () => {
      (validateOrThrow as jest.Mock).mockResolvedValue(undefined);

      await service.createInstance(
        'user-1',
        'my-papagai',
        'https://example.com/hook',
      );

      expect(validateOrThrow).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.anything(),
      );
      expect(mockWhatsappService.createInstance).toHaveBeenCalled();
    });

    it('throws BadRequestException and never calls WhatsappService when the webhook URL is invalid', async () => {
      (validateOrThrow as jest.Mock).mockRejectedValue(
        new WebhookUrlInvalidError('URL is not reachable'),
      );

      await expect(
        service.createInstance(
          'user-1',
          'my-papagai',
          'https://bad.internal/hook',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockWhatsappService.createInstance).not.toHaveBeenCalled();
    });
  });

  describe('updateWebhookConfig', () => {
    it('validates the webhook URL when a URL is present in the config', async () => {
      (validateOrThrow as jest.Mock).mockResolvedValue(undefined);

      await service.updateWebhookConfig('user-1', 'my-papagai', {
        webhookUrl: 'https://example.com/hook',
      });

      expect(validateOrThrow).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.anything(),
      );
    });

    it('skips URL validation when no webhookUrl is present in the config', async () => {
      await service.updateWebhookConfig('user-1', 'my-papagai', {
        webhookEnabled: true,
      });

      expect(validateOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('getInstance', () => {
    it('delegates to WhatsappService and returns its result', () => {
      const fakeInstance = { name: 'my-papagai', status: 'connected' } as any;
      mockWhatsappService.getInstance.mockReturnValue(fakeInstance);

      const result = service.getInstance('user-1', 'my-papagai');

      expect(mockWhatsappService.getInstance).toHaveBeenCalledWith(
        'user-1',
        'my-papagai',
      );
      expect(result).toBe(fakeInstance);
    });
  });
});
