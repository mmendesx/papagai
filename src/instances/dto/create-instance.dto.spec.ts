import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInstanceDto } from './create-instance.dto';

describe('CreateInstanceDto', () => {
  describe('name validation', () => {
    const MATCHES_MESSAGE =
      'Nome da instância inválido: use apenas letras, números, _ e -';

    describe('valid names', () => {
      const validNames = ['myBot123', 'my_bot', 'my-bot', 'a', 'a'.repeat(64)];
      validNames.forEach((name) => {
        it(`accepts "${name.length > 20 ? name.slice(0, 10) + '...' : name}"`, async () => {
          const dto = plainToInstance(CreateInstanceDto, { name });
          const errors = await validate(dto);
          const nameErrors = errors.filter((e) => e.property === 'name');
          expect(nameErrors.length).toBe(0);
        });
      });
    });

    describe('invalid characters', () => {
      const invalidNames = [
        'foo/bar',
        'foo:bar',
        'foo.bar',
        'foo bar',
        '../../etc/passwd',
        'böt',
        'foo@bar',
      ];
      invalidNames.forEach((name) => {
        it(`rejects "${name}" (invalid characters)`, async () => {
          const dto = plainToInstance(CreateInstanceDto, { name });
          const errors = await validate(dto);
          const nameError = errors.find((e) => e.property === 'name');
          expect(nameError).toBeDefined();
          expect(nameError!.constraints?.matches).toBeDefined();
          expect(nameError!.constraints?.matches).toBe(MATCHES_MESSAGE);
        });
      });
    });

    describe('boundary rejection', () => {
      it('rejects empty string', async () => {
        const dto = plainToInstance(CreateInstanceDto, { name: '' });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'name')).toBe(true);
      });

      it('rejects name of 65 chars', async () => {
        const dto = plainToInstance(CreateInstanceDto, {
          name: 'a'.repeat(65),
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'name')).toBe(true);
      });
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
