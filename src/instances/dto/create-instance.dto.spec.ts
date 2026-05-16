import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInstanceDto } from './create-instance.dto';

describe('CreateInstanceDto', () => {
  it('defaults provider to web when omitted', async () => {
    const dto = plainToInstance(CreateInstanceDto, { name: 'my_bot' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.provider).toBe('web');
  });

  it('rejects web provider when wba block is provided', async () => {
    const dto = plainToInstance(CreateInstanceDto, {
      name: 'my_bot',
      provider: 'web',
      wba: {
        businessAccountId: '12345',
        phoneNumberId: '67890',
        displayPhoneNumber: '+55 11 99999-9999',
        accessToken: 'EAAG-example',
      },
    });
    const errors = await validate(dto);
    expect(
      errors.some(
        (error) =>
          error.property === 'providerWbaConsistency' &&
          error.constraints?.ProviderWbaConsistency,
      ),
    ).toBe(true);
  });

  it('rejects wba provider when wba block is missing', async () => {
    const dto = plainToInstance(CreateInstanceDto, {
      name: 'my_bot',
      provider: 'wba',
    });
    const errors = await validate(dto);
    expect(
      errors.some(
        (error) =>
          error.property === 'providerWbaConsistency' &&
          error.constraints?.ProviderWbaConsistency,
      ),
    ).toBe(true);
  });

  it('rejects wba provider when required credentials are missing', async () => {
    const dto = plainToInstance(CreateInstanceDto, {
      name: 'my_bot',
      provider: 'wba',
      wba: {
        businessAccountId: '12345',
      },
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'wba')).toBe(true);
  });

  it('accepts wba provider with required credential fields', async () => {
    const dto = plainToInstance(CreateInstanceDto, {
      name: 'my_bot',
      provider: 'wba',
      wba: {
        businessAccountId: '12345',
        phoneNumberId: '67890',
        displayPhoneNumber: '+55 11 99999-9999',
        accessToken: 'EAAG-example-token',
        webhookVerifyToken: 'custom-verify-token',
      },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid instance names', async () => {
    const dto = plainToInstance(CreateInstanceDto, { name: 'foo/bar' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});
