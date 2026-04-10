import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginateQueryDto } from './paginate-query.dto.js';

async function validateDto(plain: object): Promise<string[]> {
  const instance = plainToInstance(PaginateQueryDto, plain);
  const errors = await validate(instance);
  return errors
    .map((e) => Object.values(e.constraints ?? {}).join(', '))
    .flat();
}

describe('PaginateQueryDto', () => {
  describe('valid inputs', () => {
    it('accepts valid page and limit integers', async () => {
      const errors = await validateDto({ page: '1', limit: '20' });
      expect(errors).toHaveLength(0);
    });

    it('accepts page=1 and limit=100', async () => {
      const errors = await validateDto({ page: '1', limit: '100' });
      expect(errors).toHaveLength(0);
    });

    it('allows missing page (optional)', async () => {
      const errors = await validateDto({ limit: '10' });
      expect(errors).toHaveLength(0);
    });

    it('allows missing limit (optional)', async () => {
      const errors = await validateDto({ page: '2' });
      expect(errors).toHaveLength(0);
    });

    it('allows both fields missing', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid inputs', () => {
    it('rejects decimal page (fails IsInt)', async () => {
      const errors = await validateDto({ page: '1.5' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects decimal limit (fails IsInt)', async () => {
      const errors = await validateDto({ limit: '2.7' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects page=0 (fails Min(1))', async () => {
      const errors = await validateDto({ page: '0' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects limit=0 (fails Min(1))', async () => {
      const errors = await validateDto({ limit: '0' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects page=-1 (fails Min(1))', async () => {
      const errors = await validateDto({ page: '-1' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects limit=-3 (fails Min(1))', async () => {
      const errors = await validateDto({ limit: '-3' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects non-numeric string for page', async () => {
      const errors = await validateDto({ page: 'abc' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects non-numeric string for limit', async () => {
      const errors = await validateDto({ limit: 'xyz' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
