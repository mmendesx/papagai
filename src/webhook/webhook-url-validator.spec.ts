import {
  isBlockedAddress,
  validateOrThrow,
  WebhookUrlInvalidError,
} from './webhook-url-validator';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'dns/promises';

const mockLookup = lookup as jest.MockedFunction<typeof lookup>;

describe('WebhookUrlValidator', () => {
  describe('isBlockedAddress', () => {
    describe('blocked IPv4 addresses', () => {
      it('blocks 127.0.0.1 (loopback)', () => {
        expect(isBlockedAddress('127.0.0.1')).toBe(true);
      });

      it('blocks 10.0.0.5 (RFC1918 class A)', () => {
        expect(isBlockedAddress('10.0.0.5')).toBe(true);
      });

      it('blocks 172.16.0.1 (RFC1918 class B)', () => {
        expect(isBlockedAddress('172.16.0.1')).toBe(true);
      });

      it('blocks 192.168.1.1 (RFC1918 class C)', () => {
        expect(isBlockedAddress('192.168.1.1')).toBe(true);
      });

      it('blocks 169.254.169.254 (link-local / AWS metadata)', () => {
        expect(isBlockedAddress('169.254.169.254')).toBe(true);
      });

      it('blocks 100.64.0.1 (CGNAT)', () => {
        expect(isBlockedAddress('100.64.0.1')).toBe(true);
      });

      it('blocks 0.0.0.1 (0.0.0.0/8 reserved)', () => {
        expect(isBlockedAddress('0.0.0.1')).toBe(true);
      });
    });

    describe('blocked IPv6 addresses', () => {
      it('blocks ::1 (loopback)', () => {
        expect(isBlockedAddress('::1')).toBe(true);
      });

      it('blocks fc00::1 (ULA)', () => {
        expect(isBlockedAddress('fc00::1')).toBe(true);
      });

      it('blocks fe80::1 (link-local)', () => {
        expect(isBlockedAddress('fe80::1')).toBe(true);
      });

      it('blocks 2001:db8::1 (documentation range)', () => {
        expect(isBlockedAddress('2001:db8::1')).toBe(true);
      });

      it('blocks ::ffff:127.0.0.1 (IPv4-mapped loopback)', () => {
        expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
      });

      it('blocks ::ffff:192.168.1.1 (IPv4-mapped RFC1918)', () => {
        expect(isBlockedAddress('::ffff:192.168.1.1')).toBe(true);
      });
    });

    describe('allowed public addresses', () => {
      it('allows 8.8.8.8 (public IPv4)', () => {
        expect(isBlockedAddress('8.8.8.8')).toBe(false);
      });

      it('allows 203.0.113.5 (public IPv4)', () => {
        expect(isBlockedAddress('203.0.113.5')).toBe(false);
      });

      it('allows 2001:4860:4860::8888 (public IPv6 — Google DNS)', () => {
        expect(isBlockedAddress('2001:4860:4860::8888')).toBe(false);
      });
    });
  });

  describe('validateOrThrow — scheme validation', () => {
    it('throws with reason "scheme" for file:// URLs', async () => {
      await expect(
        validateOrThrow('file:///etc/passwd', { allowPrivate: false }),
      ).rejects.toMatchObject({
        reason: 'scheme',
        message: expect.stringContaining('http ou https'),
      });
    });

    it('throws with reason "scheme" for javascript: URLs', async () => {
      await expect(
        validateOrThrow('javascript:alert(1)', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'scheme' });
    });

    it('throws with reason "scheme" for gopher:// URLs', async () => {
      await expect(
        validateOrThrow('gopher://internal/', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'scheme' });
    });

    it('throws with reason "scheme" for ftp:// URLs', async () => {
      await expect(
        validateOrThrow('ftp://example.com/', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'scheme' });
    });

    it('throws a WebhookUrlInvalidError instance for scheme violations', async () => {
      await expect(
        validateOrThrow('file:///etc/passwd', { allowPrivate: false }),
      ).rejects.toBeInstanceOf(WebhookUrlInvalidError);
    });
  });

  describe('validateOrThrow — DNS resolution', () => {
    beforeEach(() => {
      mockLookup.mockReset();
    });

    it('resolves without throwing when hostname resolves to a public IPv4 address', async () => {
      mockLookup.mockResolvedValue([
        { address: '203.0.113.5', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://public.example.com/hook', {
          allowPrivate: false,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves without throwing for https:// with a public address', async () => {
      mockLookup.mockResolvedValue([
        { address: '203.0.113.5', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('https://public.example.com/hook', {
          allowPrivate: false,
        }),
      ).resolves.toBeUndefined();
    });

    it('throws "private_address" when localhost resolves to 127.0.0.1', async () => {
      mockLookup.mockResolvedValue([
        { address: '127.0.0.1', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://localhost/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({
        reason: 'private_address',
        message: expect.stringContaining('endereço privado ou interno'),
      });
    });

    it('throws "private_address" for literal 127.0.0.1 hostname', async () => {
      mockLookup.mockResolvedValue([
        { address: '127.0.0.1', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://127.0.0.1/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" for literal 10.0.0.5 hostname', async () => {
      mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as any);

      await expect(
        validateOrThrow('http://10.0.0.5/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" for literal 192.168.1.1 hostname', async () => {
      mockLookup.mockResolvedValue([
        { address: '192.168.1.1', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://192.168.1.1/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" for literal 172.16.0.1 hostname', async () => {
      mockLookup.mockResolvedValue([
        { address: '172.16.0.1', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://172.16.0.1/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" for literal 169.254.169.254 hostname', async () => {
      mockLookup.mockResolvedValue([
        { address: '169.254.169.254', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://169.254.169.254/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" for literal [::1] IPv6 loopback', async () => {
      mockLookup.mockResolvedValue([{ address: '::1', family: 6 }] as any);

      await expect(
        validateOrThrow('http://[::1]/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" for literal [fc00::1] ULA IPv6', async () => {
      mockLookup.mockResolvedValue([{ address: 'fc00::1', family: 6 }] as any);

      await expect(
        validateOrThrow('http://[fc00::1]/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "private_address" when any address in a multi-address response is private', async () => {
      mockLookup.mockResolvedValue([
        { address: '203.0.113.5', family: 4 },
        { address: '192.168.1.1', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://mixed.test/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });

    it('throws "dns" with appropriate message when DNS lookup fails with ENOTFOUND', async () => {
      const dnsError = Object.assign(
        new Error('getaddrinfo ENOTFOUND nonexistent.invalid'),
        {
          code: 'ENOTFOUND',
        },
      );
      mockLookup.mockRejectedValue(dnsError);

      await expect(
        validateOrThrow('http://nonexistent.invalid/hook', {
          allowPrivate: false,
        }),
      ).rejects.toMatchObject({
        reason: 'dns',
        message: 'Não foi possível resolver o host do webhook',
      });
    });

    it('throws "private_address" for IPv4-mapped loopback ::ffff:127.0.0.1 in resolved addresses', async () => {
      mockLookup.mockResolvedValue([
        { address: '::ffff:127.0.0.1', family: 6 },
      ] as any);

      await expect(
        validateOrThrow('http://mapped-loopback.test/hook', {
          allowPrivate: false,
        }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });
  });

  describe('validateOrThrow — dev override (allowPrivate)', () => {
    beforeEach(() => {
      mockLookup.mockReset();
    });

    it('resolves without throw when allowPrivate is true, even for a private host', async () => {
      // DNS should not even be called when allowPrivate is true
      await expect(
        validateOrThrow('http://localhost/hook', { allowPrivate: true }),
      ).resolves.toBeUndefined();

      expect(mockLookup).not.toHaveBeenCalled();
    });

    it('throws "private_address" when allowPrivate is false for a private host', async () => {
      mockLookup.mockResolvedValue([
        { address: '127.0.0.1', family: 4 },
      ] as any);

      await expect(
        validateOrThrow('http://localhost/hook', { allowPrivate: false }),
      ).rejects.toMatchObject({ reason: 'private_address' });
    });
  });
});
