jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor.js';
import { WhatsappService } from '../src/whatsapp/whatsapp.service.js';

const mockWhatsappService = {
  createInstance: jest.fn(),
  getInstance: jest.fn().mockReturnValue(undefined),
  getQR: jest.fn().mockReturnValue(null),
  getInstances: jest.fn().mockReturnValue([]),
  disconnectInstance: jest.fn(),
  sendText: jest.fn(),
  sendButtons: jest.fn(),
  sendImage: jest.fn(),
  sendAudio: jest.fn(),
  sendVoice: jest.fn(),
  sendVideo: jest.fn(),
  sendDocument: jest.fn(),
  sendSticker: jest.fn(),
  sendLocation: jest.fn(),
  sendReaction: jest.fn(),
  getContactInfo: jest.fn(),
  getChats: jest.fn().mockResolvedValue([]),
};

describe('Validation (e2e)', () => {
  let app: INestApplication;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-jwt-secret-for-validation-spec';
    process.env.APP_KEY = 'e2e-app-key';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WhatsappService)
      .useValue(mockWhatsappService)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.init();
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: '00000000-0000-4000-8000-000000000002',
      email: 'validation-e2e@test.com',
      name: 'Validation E2E',
      role: 'user',
    });
    authHeader = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/instances/create with name too short returns 400 with structured body', () => {
    return request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'ab' })
      .expect(400)
      .expect((res) => {
        expect(res.body.statusCode).toBe(400);
        expect(res.body.path).toBe('/api/instances/create');
        expect(res.body.timestamp).toBeDefined();
        expect(() => new Date(res.body.timestamp)).not.toThrow();
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
        expect(res.body.message).toBeDefined();
      });
  });

  it('POST /api/instances/create with valid name succeeds (delegates to mocked service)', () => {
    mockWhatsappService.createInstance.mockResolvedValue(undefined);
    return request(app.getHttpServer())
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'validBot' })
      .expect(201);
  });
});
