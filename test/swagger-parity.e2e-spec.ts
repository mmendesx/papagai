jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    ev: { on: jest.fn() },
    end: jest.fn(),
    user: null,
  })),
  useMultiFileAuthState: jest
    .fn()
    .mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 },
  downloadContentFromMessage: jest.fn(),
  fetchLatestWaWebVersion: jest
    .fn()
    .mockResolvedValue({ version: [2, 3000, 1] }),
  fetchLatestBaileysVersion: jest
    .fn()
    .mockResolvedValue({ version: [2, 3000, 1] }),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateTables } from './helpers/db-cleaner';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function hasAnyAuthSecurity(operation: { security?: Array<Record<string, unknown>> }): boolean {
  const security = operation.security ?? [];
  const schemeNames = new Set(security.flatMap((requirement) => Object.keys(requirement)));
  return schemeNames.has('bearer') && schemeNames.has('apiKey');
}

function resolveSchema(document: OpenAPIObject, schema: Record<string, any> | undefined) {
  if (!schema) {
    return undefined;
  }

  if (typeof schema.$ref === 'string') {
    const schemaName = schema.$ref.split('/').pop();
    if (!schemaName) {
      return undefined;
    }
    return document.components?.schemas?.[schemaName] as Record<string, any> | undefined;
  }

  return schema;
}

function collectEnumValues(document: OpenAPIObject, schema: Record<string, any> | undefined): string[] {
  const resolved = resolveSchema(document, schema);
  if (!resolved) {
    return [];
  }

  if (Array.isArray(resolved.enum)) {
    return resolved.enum as string[];
  }

  const composed = [
    ...(resolved.allOf ?? []),
    ...(resolved.oneOf ?? []),
    ...(resolved.anyOf ?? []),
  ] as Array<Record<string, any>>;

  if (composed.length === 0) {
    return [];
  }

  return composed.flatMap((entry) => collectEnumValues(document, entry));
}

describe('Swagger parity for AnyAuth and templates schema (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let openApiDocument: OpenAPIObject;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Papagai WhatsApp Gateway API')
      .setDescription(
        'Multi-instance WhatsApp gateway. Manage instances, send messages, and configure webhooks.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(undefined, 'bearer')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'apiKey')
      .build();

    openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  it('adds bearer and apiKey security to AnyAuth operations', () => {
    const authAnyAuthOperations: Array<{ path: string; method: HttpMethod }> = [
      { path: '/api/auth/me', method: 'get' },
      { path: '/api/auth/apikeys', method: 'post' },
      { path: '/api/auth/apikeys', method: 'get' },
      { path: '/api/auth/apikeys/{id}', method: 'delete' },
      { path: '/api/auth/apikeys/templates', method: 'get' },
    ];

    for (const target of authAnyAuthOperations) {
      const operation = openApiDocument.paths[target.path]?.[target.method];
      expect(operation).toBeDefined();
      expect(hasAnyAuthSecurity(operation as { security?: Array<Record<string, unknown>> })).toBe(true);
    }

    const instanceOperations: Array<{ path: string; method: HttpMethod }> = [];
    for (const [path, pathItem] of Object.entries(openApiDocument.paths ?? {})) {
      if (!path.startsWith('/api/instances')) {
        continue;
      }

      for (const method of HTTP_METHODS) {
        if (pathItem[method]) {
          instanceOperations.push({ path, method });
        }
      }
    }

    expect(instanceOperations.length).toBeGreaterThan(0);

    for (const target of instanceOperations) {
      const operation = openApiDocument.paths[target.path]?.[target.method];
      expect(operation).toBeDefined();
      expect(hasAnyAuthSecurity(operation as { security?: Array<Record<string, unknown>> })).toBe(true);
    }
  });

  it('documents templates endpoint schema with template properties and ids', () => {
    const operation = openApiDocument.paths['/api/auth/apikeys/templates']?.get;
    expect(operation).toBeDefined();

    const okResponse = operation?.responses?.['200'] as Record<string, any> | undefined;
    expect(okResponse).toBeDefined();

    const topLevelSchema = resolveSchema(
      openApiDocument,
      okResponse?.content?.['application/json']?.schema as
        | Record<string, any>
        | undefined,
    );

    expect(topLevelSchema?.type).toBe('object');
    expect(topLevelSchema?.properties?.templates?.type).toBe('array');

    const templateItemSchema = resolveSchema(
      openApiDocument,
      topLevelSchema?.properties?.templates?.items as Record<string, any> | undefined,
    );

    expect(templateItemSchema?.type).toBe('object');
    expect(templateItemSchema?.properties).toEqual(
      expect.objectContaining({
        id: expect.any(Object),
        name: expect.any(Object),
        description: expect.any(Object),
        permissions: expect.any(Object),
      }),
    );
    expect(templateItemSchema?.properties?.permissions?.type).toBe('array');
    expect(templateItemSchema?.required).toEqual(
      expect.arrayContaining(['id', 'name', 'description', 'permissions']),
    );
    const templateIdValues = collectEnumValues(
      openApiDocument,
      templateItemSchema?.properties?.id as Record<string, any> | undefined,
    );

    expect(templateIdValues).toEqual(
      expect.arrayContaining([
        'read_only',
        'operator',
        'instance_manager',
        'account_admin',
      ]),
    );
  });
});