import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

describe('InstancesController JWT', () => {
  let app: INestApplication;

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
    return request(app.getHttpServer() as App).get('/api/instances').expect(401);
  });
});
