import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { DEV_JWT_SECRET_PLACEHOLDER } from './config/configuration.js';
import { join } from 'path';

function warnWebhookAllowPrivateHosts(): void {
  if (
    process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS === 'true' &&
    process.env.NODE_ENV !== 'development'
  ) {
    console.warn('WEBHOOK_ALLOW_PRIVATE_HOSTS ignored: not in development');
  }
}

function assertProductionJwtSecret(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production') {
    return;
  }
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === DEV_JWT_SECRET_PLACEHOLDER) {
    throw new Error(
      'Fatal: JWT_SECRET must be set to a strong, unique value when NODE_ENV=production (not the dev default).',
    );
  }
}

async function bootstrap() {
  warnWebhookAllowPrivateHosts();
  assertProductionJwtSecret();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('corsOrigin', '*');

  function flattenErrors(errors: any[]): string[] {
    return errors.flatMap((e) => {
      const own = Object.values(e.constraints ?? {}) as string[];
      const nested = flattenErrors(e.children ?? []);
      return [...own, ...nested];
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        return new UnprocessableEntityException(flattenErrors(errors));
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin:
      corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  app.useStaticAssets(join(__dirname, '..', 'media'), {
    prefix: '/media/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🦜   P A P A G A I   v1.0.0                             ║ 
║                                                           ║
║   "O papagaio que não cala a boca"                        ║
║                                                           ║
║   Servidor rodando em: http://localhost:${port}           ║
║   API: /api/instances  ·  UI: /                           ║ 
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
}
bootstrap();
