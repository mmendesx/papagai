import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetBase64FromMediaMessageDto } from './get-base64-from-media-message.dto.js';

describe('GetBase64FromMediaMessageDto', () => {
  it('rejects missing message.key.id', async () => {
    const dto = plainToInstance(GetBase64FromMediaMessageDto, {
      message: { key: {} },
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing message object', async () => {
    const dto = plainToInstance(GetBase64FromMediaMessageDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts evolution-style payload', async () => {
    const dto = plainToInstance(GetBase64FromMediaMessageDto, {
      message: { key: { id: '3EB00C38AC4E1BA524D51E' } },
      convertToMp4: false,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
