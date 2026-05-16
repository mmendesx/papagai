import { ConfigService } from '@nestjs/config';
import { WbaApiError, WbaClientService } from './wba-client.service';

describe('WbaClientService', () => {
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'wbaGraphApiBaseUrl') return 'https://graph.facebook.com';
      if (key === 'wbaGraphApiVersion') return 'v22.0';
      if (key === 'wbaHttpTimeoutMs') return 1000;
      return defaultValue;
    }),
  };

  let service: WbaClientService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WbaClientService(
      mockConfigService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes successful send responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.1' }],
      }),
    }) as any;

    const result = await service.sendMessage('12345', 'token', {
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'text',
      text: { body: 'hi' },
    });

    expect(result.messages?.[0]?.id).toBe('wamid.1');
  });

  it('normalizes Graph API errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'Message failed policy check',
          code: 131047,
        },
      }),
    }) as any;

    await expect(
      service.sendMessage('12345', 'token', {
        messaging_product: 'whatsapp',
        to: '5511999999999',
        type: 'text',
        text: { body: 'outside window' },
      }),
    ).rejects.toEqual(expect.any(WbaApiError));
  });
});
