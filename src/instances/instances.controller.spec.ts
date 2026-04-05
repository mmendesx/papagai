// Mock Baileys before any module imports so Jest never tries to parse its ESM source.
// InstancesController → InstancesService → WhatsappService → @whiskeysockets/baileys (ESM).
jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest.fn(),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockInstancesService = {
  createInstance: jest.fn(),
  getInstance: jest.fn(),
  getQR: jest.fn(),
  sendMessage: jest.fn(),
  getContactInfo: jest.fn(),
  getChats: jest.fn(),
  getInstances: jest.fn(),
  disconnectInstance: jest.fn(),
};

describe('InstancesController', () => {
  let controller: InstancesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstancesController],
      providers: [
        {
          provide: InstancesService,
          useValue: mockInstancesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InstancesController>(InstancesController);
  });

  // Scenario 1 — createInstance success
  describe('createInstance', () => {
    it('returns success response when instance is created', async () => {
      mockInstancesService.createInstance.mockResolvedValue(undefined);

      const result = await controller.createInstance({
        name: 'bot',
        webhook: undefined,
        webhookHeaders: undefined,
      });

      expect(result).toMatchObject({
        success: true,
        instance: 'bot',
        message: expect.stringContaining('bot'),
      });
    });

    // Scenario 2 — createInstance duplicate throws 400
    it('throws HttpException with status 400 when instance already exists', async () => {
      mockInstancesService.createInstance.mockRejectedValue(new Error('já existe'));

      await expect(
        controller.createInstance({
          name: 'bot',
          webhook: undefined,
          webhookHeaders: undefined,
        }),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.createInstance({
          name: 'bot',
          webhook: undefined,
          webhookHeaders: undefined,
        }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  // Scenario 3 — getQR with pending QR
  describe('getQR', () => {
    it('returns qr data and pending status when QR is available', async () => {
      mockInstancesService.getInstance.mockReturnValue({ connected: false, socket: {} });
      mockInstancesService.getQR.mockReturnValue('qr-data');

      const result = await controller.getQR('bot');

      expect(result).toMatchObject({
        qr: 'qr-data',
        status: 'qr',
        instance: 'bot',
        message: expect.any(String),
      });
    });

    // Scenario 4 — getQR when connected (no QR)
    it('returns connected status with phone number when instance is connected and has no QR', async () => {
      mockInstancesService.getQR.mockReturnValue(null);
      mockInstancesService.getInstance.mockReturnValue({
        connected: true,
        socket: { user: { id: '5511:1@s.whatsapp.net' } },
      });

      const result = await controller.getQR('bot');

      expect(result).toMatchObject({
        status: 'connected',
        phoneNumber: '5511',
        message: expect.any(String),
      });
    });

    it('throws HttpException with status 404 when instance is not found and has no QR', async () => {
      mockInstancesService.getQR.mockReturnValue(null);
      mockInstancesService.getInstance.mockReturnValue(undefined);

      await expect(controller.getQR('ghost')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // Scenario 5 — listInstances
  describe('listInstances', () => {
    it('returns total count and instances array', async () => {
      mockInstancesService.getInstances.mockReturnValue([
        { name: 'a', connected: true, startTime: 0 },
        { name: 'b', connected: false, startTime: 0 },
      ]);

      const result = await controller.listInstances();

      expect(result).toMatchObject({
        total: 2,
        instances: expect.any(Array),
        message: expect.stringContaining('2'),
      });
    });
  });

  // Scenario 6 — getStatus success
  describe('getStatus', () => {
    it('returns formatted status for a connected instance', async () => {
      mockInstancesService.getInstance.mockReturnValue({
        name: 'bot',
        connected: true,
        startTime: 1000,
        socket: { user: { id: '5511:1@s.whatsapp.net' } },
      });

      const result = await controller.getStatus('bot');

      expect(result).toMatchObject({
        name: 'bot',
        connected: true,
        startTime: expect.any(String),
        uptime: expect.any(Number),
        phoneNumber: '5511',
      });
    });

    // Scenario 7 — getStatus 404 for missing instance
    it('throws HttpException with status 404 when instance is not found', async () => {
      mockInstancesService.getInstance.mockReturnValue(undefined);

      await expect(controller.getStatus('ghost')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // Scenario 8 — disconnectInstance success
  describe('disconnectInstance', () => {
    it('returns success message when instance is disconnected', async () => {
      mockInstancesService.disconnectInstance.mockResolvedValue(true);

      const result = await controller.disconnectInstance('bot');

      expect(result).toMatchObject({
        message: expect.stringContaining('bot'),
        instance: 'bot',
      });
    });

    // Scenario 9 — disconnectInstance 404
    it('throws HttpException with status 404 when instance is not found', async () => {
      mockInstancesService.disconnectInstance.mockResolvedValue(false);

      await expect(controller.disconnectInstance('ghost')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // Scenario 10 — sendMessage success (Meta format)
  describe('sendMessage', () => {
    it('returns Meta-compatible response with messageId after sending', async () => {
      mockInstancesService.sendMessage.mockResolvedValue({ key: { id: 'msg-123' } });

      const result = await controller.sendMessage('bot', {
        to: '5511999999999',
        type: 'text',
        text: { body: 'Hello' },
      });

      expect(result).toMatchObject({
        messaging_product: 'whatsapp',
        contacts: [{ input: '5511999999999', wa_id: '5511999999999' }],
        messages: [{ id: 'msg-123' }],
      });
    });

    it('throws HttpException with status 400 when instance is not connected', async () => {
      mockInstancesService.sendMessage.mockRejectedValue(new Error('não está conectado'));

      await expect(
        controller.sendMessage('bot', { to: '5511999999999', type: 'text', text: { body: 'Hello' } }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  // Scenario 25 — getContact
  describe('getContact', () => {
    it('returns contact info for a valid number', async () => {
      mockInstancesService.getContactInfo.mockResolvedValue({
        phoneNumber: '5511',
        pushName: 'Test',
      });

      const result = await controller.getContact('bot', '5511');

      expect(result).toMatchObject({
        phoneNumber: '5511',
        pushName: 'Test',
      });
    });
  });

  // Scenario 26 — getChats
  describe('getChats', () => {
    it('returns chats list with instance name and total count', async () => {
      const chats = [
        {
          phoneNumber: '5511',
          pushName: 'T',
          unreadCount: 0,
          timestamp: 0,
          isGroup: false,
        },
      ];
      mockInstancesService.getChats.mockResolvedValue(chats);

      const result = await controller.getChats('bot');

      expect(result).toMatchObject({
        instance: 'bot',
        total: 1,
        chats: expect.any(Array),
      });
    });
  });
});
