import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmsDocumentService } from './llms.document.service.js';

describe('LlmsDocumentService', () => {
  let service: LlmsDocumentService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LlmsDocumentService,
        {
          provide: ConfigService,
          useValue: { get: (_key: string) => 'https://api.example.com' },
        },
      ],
    }).compile();

    service = module.get(LlmsDocumentService);
    service.onModuleInit();
  });

  it('document starts with # Papagai', () => {
    expect(service.getDocument()).toMatch(/^# Papagai/);
  });

  it('document contains Base URL from config', () => {
    expect(service.getDocument()).toContain('Base URL: https://api.example.com');
  });

  it('document contains app version', () => {
    // version from package.json — just assert it looks like semver
    expect(service.getDocument()).toMatch(/Version: \d+\.\d+\.\d+/);
  });

  it('document contains all five webhook event names', () => {
    const doc = service.getDocument();
    expect(doc).toContain('message');
    expect(doc).toContain('message_update');
    expect(doc).toContain('qr');
    expect(doc).toContain('connected');
    expect(doc).toContain('disconnected');
  });

  it('document contains all messageType variants', () => {
    const doc = service.getDocument();
    const types = [
      'image',
      'audio',
      'voice',
      'video',
      'document',
      'sticker',
      'location',
      'contact',
      'button_response',
      'list_response',
      'reaction',
    ];
    for (const t of types) {
      expect(doc).toContain(t);
    }
  });

  it('document contains MediaFile fields', () => {
    const doc = service.getDocument();
    expect(doc).toContain('"path"');
    expect(doc).toContain('"url"');
    expect(doc).toContain('"filename"');
    expect(doc).toContain('"mimetype"');
    expect(doc).toContain('"size"');
    expect(doc).toContain('"caption"');
    expect(doc).toContain('"duration"');
  });

  it('document contains message_update status codes', () => {
    const doc = service.getDocument();
    expect(doc).toContain('1 = sent');
    expect(doc).toContain('2 = delivered');
    expect(doc).toContain('3 = read');
  });

  it('document contains qr field in qr event', () => {
    expect(service.getDocument()).toContain('"qr"');
  });

  it('document contains phoneNumber in connected event', () => {
    expect(service.getDocument()).toContain('"phoneNumber"');
  });

  it('document contains reason and willReconnect in disconnected event', () => {
    const doc = service.getDocument();
    expect(doc).toContain('"reason"');
    expect(doc).toContain('"willReconnect"');
  });

  it('document contains send-message endpoint', () => {
    expect(service.getDocument()).toContain(
      'POST /api/instances/:name/messages',
    );
  });

  it('document character count is under 16000', () => {
    expect(service.getDocument().length).toBeLessThan(16000);
  });

  it('document describes JWT auth', () => {
    const doc = service.getDocument();
    expect(doc).toContain('POST /api/auth/login');
    expect(doc).toContain('Authorization: Bearer');
  });

  it('document describes API key auth', () => {
    const doc = service.getDocument();
    expect(doc).toContain('POST /api/instances/:name/apikeys');
    expect(doc).toContain('Authorization: ApiKey');
  });

  it('document describes webhook config endpoint', () => {
    expect(service.getDocument()).toContain(
      'PATCH /api/instances/:name/webhook',
    );
  });

  it('document describes X-Papagai headers', () => {
    const doc = service.getDocument();
    expect(doc).toContain('X-Papagai-Instance');
    expect(doc).toContain('X-Papagai-Event');
  });

  it('document describes retry semantics', () => {
    expect(service.getDocument()).toContain('exponential-backoff');
  });

  it('document describes instance CRUD endpoints', () => {
    const doc = service.getDocument();
    expect(doc).toContain('POST /api/instances/create');
    expect(doc).toContain('GET /api/instances');
    expect(doc).toContain('DELETE /api/instances/:name');
    expect(doc).toContain('GET /api/instances/:name/qr');
    expect(doc).toContain('GET /api/instances/:name/status');
  });

  it('buildDocument uses provided baseUrl', () => {
    const doc = service.buildDocument('https://custom-host.io');
    expect(doc).toContain('Base URL: https://custom-host.io');
  });
});
