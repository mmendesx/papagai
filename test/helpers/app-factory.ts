import 'dotenv/config'; // loads .env silently if present; no-op when absent
import {
  INestApplication,
  ValidationPipe,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from '../../src/app.module';
import { WhatsappService } from '../../src/whatsapp/whatsapp.service';
import { FakeWhatsappService } from './fake-whatsapp.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { InMemoryPrismaService } from './in-memory-prisma.service';
import { WEBHOOK_DELIVERY_QUEUE } from '../../src/webhook/webhook-queue.module';
import { WebhookDeliveryProcessor } from '../../src/webhook/webhook-delivery.processor';
import { HealthService } from '../../src/health/health.service';
import { WbaClientService } from '../../src/wba/wba-client.service';

const fakeWebhookQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

const fakeHealthService = {
  checkHealth: jest
    .fn()
    .mockResolvedValue({ db: 'ok', redis: 'ok', uptime: 0 }),
};

const fakeWbaClientService = {
  sendMessage: jest.fn().mockResolvedValue({
    messaging_product: 'whatsapp',
    contacts: [{ input: '5511999999999', wa_id: '5511999999999' }],
    messages: [{ id: 'wamid.fake' }],
  }),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true, statusCode: 200 }),
};

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-integration-secret';
  process.env.APP_KEY = 'ci-app-key';
  process.env.WBA_CREDENTIALS_SECRET = 'ci-wba-credentials-secret';
  process.env.BASE_URL = 'http://localhost:3000';
  process.env.REDIS_URL = 'redis://e2e-in-memory:6379';

  function flattenErrors(errors: any[]): string[] {
    return errors.flatMap((e) => {
      const own = Object.values(e.constraints ?? {});
      const nested = flattenErrors(e.children ?? []);
      return [...own, ...nested];
    });
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useClass(InMemoryPrismaService)
    .overrideProvider(WhatsappService)
    .useClass(FakeWhatsappService)
    .overrideProvider(getQueueToken(WEBHOOK_DELIVERY_QUEUE))
    .useValue(fakeWebhookQueue)
    .overrideProvider(WebhookDeliveryProcessor)
    .useValue({})
    .overrideProvider(HealthService)
    .useValue(fakeHealthService)
    .overrideProvider(WbaClientService)
    .useValue(fakeWbaClientService)
    .compile();

  const app = moduleRef.createNestApplication({
    rawBody: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new UnprocessableEntityException(flattenErrors(errors)),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  return { app, prisma };
}
