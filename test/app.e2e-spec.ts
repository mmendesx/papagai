jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(),
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { WhatsappService } from './../src/whatsapp/whatsapp.service';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from './../src/common/interceptors/logging.interceptor';

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

describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-jwt-secret-for-app-spec';
    process.env.APP_KEY = 'e2e-app-key';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WhatsappService)
      .useValue(mockWhatsappService)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());
    await app.init();
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'e2e@test.com',
      name: 'E2E',
      role: 'user',
    });
    authHeader = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/instances returns instance list', () => {
    return request(app.getHttpServer() as App)
      .get('/api/instances')
      .set(authHeader)
      .expect(200)
      .expect(res => {
        expect(res.body.total).toBe(0);
        expect(res.body.instances).toEqual([]);
      });
  });

  it('GET /api/instances without Authorization returns 401', () => {
    return request(app.getHttpServer() as App).get('/api/instances').expect(401);
  });

  it('POST /api/instances/create with invalid name returns 400', () => {
    return request(app.getHttpServer() as App)
      .post('/api/instances/create')
      .set(authHeader)
      .send({ name: 'ab' })
      .expect(400);
  });
});
