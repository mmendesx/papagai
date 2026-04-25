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

const fakeWebhookQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

const fakeHealthService = {
  checkHealth: jest
    .fn()
    .mockResolvedValue({ db: 'ok', redis: 'ok', uptime: 0 }),
};

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-integration-secret';
  process.env.APP_KEY = 'ci-app-key';
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
    .compile();

  const app = moduleRef.createNestApplication();
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
