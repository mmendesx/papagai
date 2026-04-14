import 'dotenv/config'; // loads .env silently if present; no-op when absent
import {
  INestApplication,
  ValidationPipe,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { WhatsappService } from '../../src/whatsapp/whatsapp.service';
import { FakeWhatsappService } from './fake-whatsapp.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-integration-secret';
  process.env.APP_KEY = 'ci-app-key';
  process.env.REDIS_URL = 'redis://localhost:6379';

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
    .overrideProvider(WhatsappService)
    .useClass(FakeWhatsappService)
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
