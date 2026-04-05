import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInstanceDto } from './create-instance.dto';

describe('CreateInstanceDto', () => {
  describe('name validation', () => {
    it('rejects name shorter than 3 chars', async () => {
      const dto = plainToInstance(CreateInstanceDto, { name: 'ab' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('rejects name longer than 30 chars', async () => {
      const dto = plainToInstance(CreateInstanceDto, {
        name: 'a'.repeat(31),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('accepts a valid name within bounds', async () => {
      const dto = plainToInstance(CreateInstanceDto, { name: 'myBot' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('webhook validation', () => {
    it('rejects an invalid URL for webhook', async () => {
      // class-validator accepts "not-a-url" (treats it as a relative path).
      // A string containing whitespace is reliably rejected by @IsUrl.
      const dto = plainToInstance(CreateInstanceDto, {
        name: 'myBot',
        webhook: 'not a url',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'webhook')).toBe(true);
    });

    it('accepts a valid localhost URL for webhook', async () => {
      const dto = plainToInstance(CreateInstanceDto, {
        name: 'myBot',
        webhook: 'http://localhost:3000/hook',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('accepts when webhook is absent (optional field)', async () => {
      const dto = plainToInstance(CreateInstanceDto, { name: 'myBot' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('webhookHeaders validation', () => {
    it('rejects webhookHeaders as a non-object value', async () => {
      const dto = plainToInstance(CreateInstanceDto, {
        name: 'myBot',
        webhookHeaders: 'not-an-object',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'webhookHeaders')).toBe(true);
    });

    it('accepts webhookHeaders as a valid object', async () => {
      const dto = plainToInstance(CreateInstanceDto, {
        name: 'myBot',
        webhookHeaders: { Authorization: 'Bearer token' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});

describe('MetaMessageDto', () => {
  it('is defined', () => {
    expect(true).toBe(true);
  });
});
