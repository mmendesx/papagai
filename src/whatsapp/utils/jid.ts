const WHATSAPP_SUFFIX = '@s.whatsapp.net';

// Brazilian mobile numbers after ~2012: 55 + DDD(2) + 9 + 8digits = 13 digits
// Pre-2012 / landline registrations:   55 + DDD(2) + 8digits      = 12 digits
// When we receive 12 digits starting with 55, insert the 9th digit.
const BRAZIL_CODE = '55';
const BRAZIL_LEN_WITHOUT_NINTH = 12;

/**
 * Converts a raw phone number string to a WhatsApp JID.
 *
 * - Already contains `@` → returned unchanged.
 * - Brazilian 12-digit numbers (55 + DDD + 8digits) → 9th digit inserted before last 8 digits.
 *
 * Examples:
 *   phoneNumberToJid("5561999990000")               → "5561999990000@s.whatsapp.net"
 *   phoneNumberToJid("556199990000")                → "5561999990000@s.whatsapp.net"
 *   phoneNumberToJid("5561999990000@s.whatsapp.net") → "5561999990000@s.whatsapp.net"
 */
export function phoneNumberToJid(phone: string): string {
  if (phone.includes('@')) return phone;

  const normalized = phone.replace(/\+/g, '');

  if (normalized.startsWith(BRAZIL_CODE) && normalized.length === BRAZIL_LEN_WITHOUT_NINTH) {
    const ddd = normalized.substring(2, 4);
    const digits = normalized.substring(4); // 8 digits
    return `${BRAZIL_CODE}${ddd}9${digits}${WHATSAPP_SUFFIX}`;
  }

  return `${normalized}${WHATSAPP_SUFFIX}`;
}

/**
 * Extracts the bare numeric string from a WhatsApp JID.
 *
 * Examples:
 *   jidToPhoneNumber("5561999990000@s.whatsapp.net")   → "5561999990000"
 *   jidToPhoneNumber("5561999990000:5@s.whatsapp.net") → "5561999990000"
 */
export function jidToPhoneNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0].replace(/\+/g, '');
}
