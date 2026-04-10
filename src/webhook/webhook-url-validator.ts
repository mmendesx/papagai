import * as net from 'net';
import { lookup } from 'dns/promises';

// CIDR check hand-rolled using Node's net module to avoid adding ipaddr.js dependency

export type WebhookUrlInvalidReason = 'scheme' | 'dns' | 'private_address';

export class WebhookUrlInvalidError extends Error {
  readonly reason: WebhookUrlInvalidReason;

  constructor(reason: WebhookUrlInvalidReason, message: string) {
    super(message);
    this.name = 'WebhookUrlInvalidError';
    this.reason = reason;
  }
}

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0
  );
}

function isBlockedIpv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);

  const ranges: Array<[string, number]> = [
    ['127.0.0.0', 8],
    ['10.0.0.0', 8],
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['169.254.0.0', 16],
    ['100.64.0.0', 10],
    ['0.0.0.0', 8],
  ];

  for (const [base, prefix] of ranges) {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const network = ipv4ToInt(base);
    if ((addr & mask) === (network & mask)) {
      return true;
    }
  }

  return false;
}

function isBlockedIpv6(ip: string): boolean {
  // Strip zone ID (e.g. fe80::1%eth0)
  const bare = ip.includes('%') ? ip.split('%')[0] : ip;

  // Loopback ::1/128
  if (bare === '::1') {
    return true;
  }

  // IPv4-mapped addresses ::ffff:x.x.x.x — extract embedded IPv4 and re-check
  const mappedMatch = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedMatch) {
    return isBlockedIpv4(mappedMatch[1]);
  }

  // For prefix-based checks we expand and compare the high-order bits
  // by parsing the first 64 bits as two 32-bit halves.
  const expanded = expandIpv6(bare);
  if (expanded === null) {
    return false;
  }

  const groups = expanded.split(':').map((g) => parseInt(g, 16));

  // Build a 128-bit value as four 32-bit unsigned integers [a, b, c, d]
  const hi1 = ((groups[0] << 16) | groups[1]) >>> 0;
  const hi2 = ((groups[2] << 16) | groups[3]) >>> 0;

  // fc00::/7  — ULA (fc00:: through fdff::)
  // First 7 bits = 1111110x  → 0xfe00 mask on first 16-bit group gives 0xfc00
  if ((groups[0] & 0xfe00) === 0xfc00) {
    return true;
  }

  // fe80::/10 — link-local
  // First 10 bits = 1111111010  → 0xffc0 mask on first 16-bit group gives 0xfe80
  if ((groups[0] & 0xffc0) === 0xfe80) {
    return true;
  }

  // 2001:db8::/32 — documentation range
  if (hi1 === 0x20010db8) {
    return true;
  }

  void hi2; // not needed for current ranges but kept for future use
  return false;
}

/**
 * Expands a compressed IPv6 address to its full 8-group form.
 * Returns null if the input is not a valid IPv6 address.
 */
function expandIpv6(ip: string): string | null {
  if (!net.isIPv6(ip)) {
    return null;
  }

  const halves = ip.split('::');
  if (halves.length > 2) {
    return null;
  }

  const parseGroups = (s: string): string[] => (s === '' ? [] : s.split(':'));

  if (halves.length === 1) {
    const groups = parseGroups(halves[0]);
    if (groups.length !== 8) {
      return null;
    }
    return groups.map((g) => g.padStart(4, '0')).join(':');
  }

  const left = parseGroups(halves[0]);
  const right = parseGroups(halves[1]);
  const missing = 8 - left.length - right.length;
  const middle = Array<string>(missing).fill('0000');
  return [...left, ...middle, ...right]
    .map((g) => g.padStart(4, '0'))
    .join(':');
}

export function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    return isBlockedIpv4(address);
  }

  if (net.isIPv6(address)) {
    return isBlockedIpv6(address);
  }

  return false;
}

export async function validateOrThrow(
  url: string,
  opts: { allowPrivate: boolean },
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebhookUrlInvalidError(
      'scheme',
      'URL do webhook deve usar http ou https',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new WebhookUrlInvalidError(
      'scheme',
      'URL do webhook deve usar http ou https',
    );
  }

  if (opts.allowPrivate) {
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(parsed.hostname, { all: true });
  } catch {
    throw new WebhookUrlInvalidError(
      'dns',
      'Não foi possível resolver o host do webhook',
    );
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new WebhookUrlInvalidError(
        'private_address',
        'URL do webhook aponta para um endereço privado ou interno',
      );
    }
  }
}
