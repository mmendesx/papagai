import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { ApiKeyService } from '../auth/api-key.service.js';
import { AnyAuthGuard } from '../auth/guards/any-auth.guard.js';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MediaUrlService } from '../media/media-url.service.js';

describe('InstancesController JWT', () => {
  let app: INestApplication;
  const apiKeyGuardMock = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'instances-controller-auth-spec',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [InstancesController],
      providers: [
        JwtAuthGuard,
        AnyAuthGuard,
        {
          provide: ApiKeyAuthGuard,
          useValue: apiKeyGuardMock,
        },
        {
          provide: ApiKeyService,
          useValue: {
            createAccountKey: jest.fn(),
            listAccountKeys: jest.fn(),
            revokeKey: jest.fn(),
            createInstanceKey: jest.fn(),
            listInstanceKeys: jest.fn(),
            validateKey: jest.fn(),
            instanceMatchesKey: jest.fn(),
          },
        },
        {
          provide: InstancesService,
          useValue: {
            getInstances: jest.fn().mockReturnValue([]),
            createInstance: jest.fn(),
            getInstance: jest.fn(),
            getQR: jest.fn(),
            disconnectInstance: jest.fn(),
            sendMessage: jest.fn(),
            getContactInfo: jest.fn(),
            getChats: jest.fn(),
            updateWebhookConfig: jest.fn(),
          },
        },
        {
          provide: MediaUrlService,
          useValue: {
            signPath: jest.fn(
              (path: string) =>
                `http://localhost:3000${path}?expires=1&signature=test`,
            ),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/instances without Authorization returns 401', () => {
    return request(app.getHttpServer() as App)
      .get('/api/instances')
      .expect(401)
      .then(() => {
        expect(apiKeyGuardMock.canActivate).not.toHaveBeenCalled();
      });
  });
});
