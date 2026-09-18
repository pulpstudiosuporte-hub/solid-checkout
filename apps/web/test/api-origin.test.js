import { describe, expect, it } from 'vitest';
import { resolveApiOrigin } from '../src/api-origin';

describe('API during the Pirat domain migration', () => {
  it('keeps protected cookies same-site for the new panel', () => {
    expect(resolveApiOrigin('app.apirat.io', 'https://api.solidcheckout.xyz')).toBe('https://api.apirat.io');
  });
  it.each(['app.solidcheckout.xyz', 'pay.solidcheckout.xyz', 'checkout.example.com', 'app.apirat.io.example.com'])('preserves the configured API for %s', hostname => {
    expect(resolveApiOrigin(hostname, 'https://api.solidcheckout.xyz/')).toBe('https://api.solidcheckout.xyz');
  });
  it('preserves local development', () => {
    expect(resolveApiOrigin('localhost')).toBe('http://127.0.0.1:3333');
  });
});
