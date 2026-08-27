import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(value: Buffer): string {
  let bits = 0; let buffer = 0; let output = '';
  for (const byte of value) {
    buffer = (buffer << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; output += ALPHABET[(buffer >>> bits) & 31]; }
  }
  if (bits > 0) output += ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(value: string): Buffer {
  let bits = 0; let buffer = 0; const bytes: number[] = [];
  for (const character of value.toUpperCase().replace(/=|\s|-/g, '')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Segredo TOTP inválido');
    buffer = (buffer << 5) | index; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); }
  }
  return Buffer.from(bytes);
}

export const generateTotpSecret = (): string => encodeBase32(randomBytes(20));

export function totpCode(secret: string, timestamp = Date.now(), digits = 6, stepSeconds = 30): string {
  const counter = Math.floor(timestamp / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8); counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 15;
  const binary = ((digest[offset]! & 127) << 24) | ((digest[offset + 1]! & 255) << 16) | ((digest[offset + 2]! & 255) << 8) | (digest[offset + 3]! & 255);
  return String(binary % (10 ** digits)).padStart(digits, '0');
}

export function verifyTotp(code: string, secret: string, timestamp = Date.now(), window = 1): boolean {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = totpCode(secret, timestamp + offset * 30_000);
    if (timingSafeEqual(Buffer.from(normalized), Buffer.from(expected))) return true;
  }
  return false;
}

export const recoveryCodeHash = (code: string): string => createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
export const generateRecoveryCodes = (count = 10): string[] => Array.from({ length: count }, () => {
  const raw = randomBytes(8).toString('hex').toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
});

export function totpUri(secret: string, email: string, issuer = 'SOLID Checkout'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
