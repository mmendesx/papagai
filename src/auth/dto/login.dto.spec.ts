import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  it('rejects a 7-character password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: 'short12',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a 1-character password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: 'x',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts an 8-character password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: 'exactly8',
    });

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });
});
