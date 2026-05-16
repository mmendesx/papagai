import { ForbiddenException } from '@nestjs/common';
import { WbaWebhookService } from './wba-webhook.service';

function buildPayload(overrides: Record<string, any> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-id',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: {
                phone_number_id: '12345',
                display_phone_number: '+55 11 99999-9999',
              },
              contacts: [
                {
                  wa_id: '5511999999999',
                  profile: { name: 'Meta User' },
                },
              ],
              messages: [
                {
                  id: 'wamid.in.1',
                  from: '5511999999999',
                  timestamp: '1710000000',
                  type: 'text',
                  text: { body: 'hello' },
                },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('WbaWebhookService', () => {
  const mockWbaInstanceService = {
    findByVerifyToken: jest.fn(),
    findInstanceByPhoneNumberId: jest.fn(),
    ingestIncomingMessage: jest.fn(),
    ingestStatusUpdate: jest.fn(),
  };

  let service: WbaWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WbaWebhookService(mockWbaInstanceService as any);
  });

  it('accepts webhook verification with valid token', async () => {
    mockWbaInstanceService.findByVerifyToken.mockResolvedValue({
      userId: 'u1',
      name: 'inst1',
    });

    await expect(
      service.verifyChallenge('subscribe', 'verify-token', '123'),
    ).resolves.toBe('123');
  });

  it('rejects webhook verification with invalid token', async () => {
    mockWbaInstanceService.findByVerifyToken.mockResolvedValue(null);

    await expect(
      service.verifyChallenge('subscribe', 'bad-token', '123'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ignores payloads for unowned phone number ids', async () => {
    mockWbaInstanceService.findInstanceByPhoneNumberId.mockResolvedValue(null);
    const payload = buildPayload();
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');

    const result = await service.ingestWebhook(payload, rawBody);
    expect(result).toEqual({ accepted: true, processed: 0, ignored: 1 });
    expect(mockWbaInstanceService.ingestIncomingMessage).not.toHaveBeenCalled();
  });

  it('rejects invalid signature when app secret is configured', async () => {
    mockWbaInstanceService.findInstanceByPhoneNumberId.mockResolvedValue({
      userId: 'u1',
      name: 'inst1',
      appSecret: 'top-secret',
    });
    const payload = buildPayload();
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');

    await expect(
      service.ingestWebhook(payload, rawBody, 'sha256=deadbeef'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ingests incoming messages and statuses for owned phone number ids', async () => {
    mockWbaInstanceService.findInstanceByPhoneNumberId.mockResolvedValue({
      userId: 'u1',
      name: 'inst1',
    });
    const payload = buildPayload({
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '12345' },
                contacts: [{ profile: { name: 'Meta User' } }],
                messages: [
                  {
                    id: 'wamid.in.1',
                    from: '5511999999999',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'hello' },
                  },
                ],
                statuses: [{ id: 'wamid.out.1', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    });
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');

    const result = await service.ingestWebhook(payload, rawBody);
    expect(result.accepted).toBe(true);
    expect(result.processed).toBe(2);
    expect(mockWbaInstanceService.ingestIncomingMessage).toHaveBeenCalledTimes(
      1,
    );
    expect(mockWbaInstanceService.ingestStatusUpdate).toHaveBeenCalledTimes(1);
  });
});
