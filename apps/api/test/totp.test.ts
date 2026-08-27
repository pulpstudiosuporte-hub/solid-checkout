import { describe, expect, it } from 'vitest';
import { decodeBase32, encodeBase32, recoveryCodeHash, totpCode, verifyTotp } from '../src/totp.js';

describe('TOTP', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches RFC 6238 SHA-1 vectors', () => {
    expect(totpCode(rfcSecret, 59_000, 8)).toBe('94287082');
    expect(totpCode(rfcSecret, 1_111_111_109_000, 8)).toBe('07081804');
    expect(totpCode(rfcSecret, 1_234_567_890_000, 8)).toBe('89005924');
  });

  it('accepts only the current TOTP window', () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(totpCode(rfcSecret, now), rfcSecret, now)).toBe(true);
    expect(verifyTotp('abcdef', rfcSecret, now)).toBe(false);
  });

  it('round-trips Base32 and normalizes recovery codes', () => {
    const value = Buffer.from('SOLID checkout MFA');
    expect(decodeBase32(encodeBase32(value))).toEqual(value);
    expect(recoveryCodeHash('ABCD-EF12')).toBe(recoveryCodeHash('abcd ef12'));
  });
});
