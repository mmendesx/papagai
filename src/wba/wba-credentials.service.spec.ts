import { ConfigService } from '@nestjs/config';
import { WbaCredentialsService } from './wba-credentials.service';

describe('WbaCredentialsService', () => {
  it('encrypts and decrypts credentials using configured secret', () => {
    const config = {
      get: jest.fn().mockReturnValue('this-is-a-long-enough-secret'),
    } as unknown as ConfigService;
    const service = new WbaCredentialsService(config);

    const encrypted = service.encrypt('EAAG-token');
    expect(encrypted).not.toContain('EAAG-token');

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe('EAAG-token');
  });

  it('throws when encryption secret is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(''),
    } as unknown as ConfigService;
    const service = new WbaCredentialsService(config);

    expect(() => service.encrypt('token')).toThrow(
      'WBA credential encryption secret is not configured',
    );
  });
});
