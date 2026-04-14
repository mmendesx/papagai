import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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
  const corsOrigin = configService.get<string>(
    'corsOrigin',
    'http://localhost:4200',
  );

  function flattenErrors(errors: any[]): string[] {
    return errors.flatMap((e) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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

  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.SWAGGER_ENABLED !== 'false' &&
      process.env.NODE_ENV !== 'production');

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Papagai WhatsApp Gateway API')
      .setDescription(
        'Multi-instance WhatsApp gateway. Manage instances, send messages, and configure webhooks.',
      )
      .setVersion(process.env.npm_package_version ?? '1.0.0')
      .addBearerAuth(undefined, 'bearer')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'apiKey')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  app.useStaticAssets(join(__dirname, '..', 'media'), {
    prefix: '/media/',
  });

  // uploads/ is created at runtime under process.cwd(), not inside dist/
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
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

  if (swaggerEnabled) {
    console.log(`Swagger UI: http://localhost:${port}/api/docs`);
  }
}
void bootstrap();
