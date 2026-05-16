import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { InstancesService } from './instances.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { MediaUrlService } from '../media/media-url.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WbaInstanceService } from '../wba/wba-instance.service.js';

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
    send: jest.Mock;
    getContactInfo: jest.Mock;
    getChats: jest.Mock;
    getChatMessages: jest.Mock;
    streamChatEvents: jest.Mock;
    markChatRead: jest.Mock;
    getMetrics: jest.Mock;
    getInstances: jest.Mock;
    disconnectInstance: jest.Mock;
    getQR: jest.Mock;
    findMessageById: jest.Mock;
  };
  let mockWbaService: {
    createInstance: jest.Mock;
    sendMessage: jest.Mock;
    getStatus: jest.Mock;
    getContactInfo: jest.Mock;
    getChats: jest.Mock;
    getChatMessages: jest.Mock;
    streamChatEvents: jest.Mock;
    markChatRead: jest.Mock;
    getMetrics: jest.Mock;
    updateWebhookConfig: jest.Mock;
    getListItems: jest.Mock;
    disconnectInstance: jest.Mock;
  };
  let mockPrismaService: {
    instanceConfig: {
      findUnique: jest.Mock;
    };
  };
  let mockConfigService: { get: jest.Mock };
  let mockMediaUrlService: { isSignedMediaUrl: jest.Mock };

  beforeEach(async () => {
    mockWhatsappService = {
      createInstance: jest.fn().mockResolvedValue({ name: 'test-instance' }),
      getInstance: jest.fn(),
      updateWebhookConfig: jest.fn().mockResolvedValue({}),
      send: jest.fn().mockResolvedValue({ key: { id: 'msg-1' } }),
      getContactInfo: jest.fn().mockResolvedValue({}),
      getChats: jest.fn().mockReturnValue([]),
      getChatMessages: jest.fn().mockReturnValue([]),
      streamChatEvents: jest.fn(),
      markChatRead: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        messagesSent: 1,
        messagesReceived: 2,
        activeConversations: 1,
        webhookEnabled: true,
      }),
      getInstances: jest.fn().mockReturnValue({ instances: [], total: 0 }),
      disconnectInstance: jest.fn().mockResolvedValue(true),
      getQR: jest.fn().mockReturnValue('qr-code'),
      findMessageById: jest.fn(),
    };

    mockWbaService = {
      createInstance: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest
        .fn()
        .mockResolvedValue({ messages: [{ id: 'wamid.1' }] }),
      getStatus: jest
        .fn()
        .mockResolvedValue({ name: 'wba-one', provider: 'wba' }),
      getContactInfo: jest.fn(),
      getChats: jest.fn().mockResolvedValue([]),
      getChatMessages: jest.fn().mockResolvedValue([]),
      streamChatEvents: jest.fn(),
      markChatRead: jest.fn(),
      getMetrics: jest.fn().mockResolvedValue({
        messagesSent: 0,
        messagesReceived: 0,
        activeConversations: 0,
        webhookEnabled: false,
      }),
      updateWebhookConfig: jest.fn(),
      getListItems: jest.fn().mockResolvedValue({ instances: [], total: 0 }),
      disconnectInstance: jest.fn().mockResolvedValue(true),
    };

    mockPrismaService = {
      instanceConfig: {
        findUnique: jest.fn(),
      },
    };

    mockConfigService = { get: jest.fn().mockReturnValue(false) };

    mockMediaUrlService = {
      isSignedMediaUrl: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstancesService,
        { provide: WhatsappService, useValue: mockWhatsappService },
        { provide: WbaInstanceService, useValue: mockWbaService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MediaUrlService, useValue: mockMediaUrlService },
      ],
    }).compile();

    service = module.get(InstancesService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createInstance', () => {
    it('creates web instances through WhatsappService by default', async () => {
      await service.createInstance('user-1', 'my-papagai');

      expect(mockWhatsappService.createInstance).toHaveBeenCalledWith(
        'user-1',
        'my-papagai',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(mockWbaService.createInstance).not.toHaveBeenCalled();
    });

    it('creates wba instances through WbaInstanceService', async () => {
      await service.createInstance(
        'user-1',
        'sales-wba',
        undefined,
        undefined,
        undefined,
        undefined,
        'wba',
        {
          businessAccountId: '12345',
          phoneNumberId: '67890',
          displayPhoneNumber: '+55 11 99999-9999',
          accessToken: 'EAAG-token',
        },
      );

      expect(mockWbaService.createInstance).toHaveBeenCalled();
      expect(mockWhatsappService.createInstance).not.toHaveBeenCalled();
    });

    it('rejects wba creation when credentials are missing', async () => {
      await expect(
        service.createInstance(
          'user-1',
          'sales-wba',
          undefined,
          undefined,
          undefined,
          undefined,
          'wba',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates webhook URL before delegating', async () => {
      (validateOrThrow as jest.Mock).mockResolvedValue(undefined);
      await service.createInstance(
        'user-1',
        'my-papagai',
        'https://example.com/hook',
      );
      expect(validateOrThrow).toHaveBeenCalled();
    });

    it('throws BadRequestException for invalid webhook URL', async () => {
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
    });
  });

  describe('provider routing', () => {
    it('routes web sends through WhatsappService', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'web',
      });
      (validateOrThrow as jest.Mock).mockResolvedValue(undefined);

      await service.sendMessage('user-1', 'alpha', {
        to: '5511999999999',
        type: 'video',
        video: { link: 'https://example.com/video.mp4' },
      });

      expect(mockWhatsappService.send).toHaveBeenCalled();
      expect(mockWbaService.sendMessage).not.toHaveBeenCalled();
    });

    it('routes wba sends through WbaInstanceService', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'wba',
      });

      await service.sendMessage('user-1', 'sales-wba', {
        to: '5511999999999',
        type: 'text',
        text: { body: 'hello' },
      });

      expect(mockWbaService.sendMessage).toHaveBeenCalled();
      expect(mockWhatsappService.send).not.toHaveBeenCalled();
    });

    it('throws NotFound when instance does not exist', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue(null);

      await expect(service.getProvider('user-1', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getQR', () => {
    it('returns QR for web provider', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'web',
      });
      const qr = await service.getQR('user-1', 'alpha');
      expect(qr).toBe('qr-code');
    });

    it('rejects QR for wba provider', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'wba',
      });
      await expect(service.getQR('user-1', 'sales-wba')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getBase64FromMediaMessage', () => {
    it('returns base64 payload for stored image message', async () => {
      const mediaDir = mkdtempSync(join(tmpdir(), 'papagai-media-'));
      const mediaFilePath = join(mediaDir, 'hello.jpg');
      writeFileSync(mediaFilePath, Buffer.from('hello-media'));

      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'web',
      });
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'mediaDir' ? mediaDir : false,
      );
      mockWhatsappService.findMessageById.mockReturnValue({
        id: 'MSG-IMAGE-1',
        type: 'image',
        mediaPath: mediaFilePath,
        filename: 'hello.jpg',
        mimetype: 'image/jpeg',
        size: 11,
        caption: 'hello',
      });

      const result = await service.getBase64FromMediaMessage(
        'user-1',
        'alpha',
        {
          message: { key: { id: 'MSG-IMAGE-1' } },
          convertToMp4: false,
        },
      );

      expect(result.mediaType).toBe('imageMessage');
      expect(result.fileName).toBe('hello.jpg');
      expect(result.base64).toBe(Buffer.from('hello-media').toString('base64'));

      rmSync(mediaDir, { recursive: true, force: true });
    });

    it('rejects convertToMp4 true', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'web',
      });

      await expect(
        service.getBase64FromMediaMessage('user-1', 'alpha', {
          message: { key: { id: 'MSG-VIDEO-1' } },
          convertToMp4: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unsupported wba provider', async () => {
      mockPrismaService.instanceConfig.findUnique.mockResolvedValue({
        provider: 'wba',
      });

      await expect(
        service.getBase64FromMediaMessage('user-1', 'sales-wba', {
          message: { key: { id: 'MSG-1' } },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
