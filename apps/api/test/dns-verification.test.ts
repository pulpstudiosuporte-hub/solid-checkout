import { describe, expect, it, vi } from 'vitest';
import { verifyCname } from '../src/dns-verification.js';

describe('verifyCname', () => {
  it('accepts the system resolver result without calling public DNS', async () => {
    const fetchImpl = vi.fn();
    await expect(verifyCname('checkout.example.com', 'pay.solidcheckout.xyz', {
      resolver: () => Promise.resolve(['pay.solidcheckout.xyz.']),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to DNS over HTTPS when Docker still caches NXDOMAIN', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Answer: [{ type: 5, data: 'pay.solidcheckout.xyz.' }] }),
    });
    await expect(verifyCname('checkout.example.com', 'pay.solidcheckout.xyz', {
      resolver: () => Promise.reject(new Error('ENOTFOUND')),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tries the second public resolver and rejects unrelated targets', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Answer: [{ type: 5, data: 'unrelated.example.com.' }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Answer: [] }) });
    await expect(verifyCname('checkout.example.com', 'pay.solidcheckout.xyz', {
      resolver: () => Promise.resolve([]),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
