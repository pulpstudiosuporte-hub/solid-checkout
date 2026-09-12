import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaApiError, sendMetaEvent, validateMetaCredentials } from '../src/meta-client.js';

const token = 'private-test-token-never-log';
const pixel = '123456789012345';
type TestBody = { test_event_code?: string; data: Array<{ user_data: { external_id: string[] }; custom_data?: unknown }> };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());

describe('Meta connection validation', () => {
  it('queries only the ID and keeps the token out of URLs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ id: pixel })); vi.stubGlobal('fetch', fetcher);
    await validateMetaCredentials(pixel, token);
    const [input, init] = fetcher.mock.calls[0]!; const url = input as URL;
    expect(url.searchParams.get('fields')).toBe('id');
    expect(url.toString()).not.toContain(token);
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
    expect(init?.method).toBe('GET');
  });
  it('offers the CAPI test path for missing read permissions, without accepting an unverified token', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response({ error: { code: 100, message: token } }, 400)));
    await expect(validateMetaCredentials(pixel, token)).rejects.toMatchObject({ code: 'META_TEST_CODE_REQUIRED', status: 422 });
  });
  it('validates through the events endpoint when an explicit test code is provided', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ events_received: 1 })); vi.stubGlobal('fetch', fetcher);
    await validateMetaCredentials(pixel, token, 'TEST12345');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [input, init] = fetcher.mock.calls[0]!; const url = input as URL; const body = JSON.parse(init?.body as string) as TestBody;
    expect(url.pathname).toBe(`/${pixel}/events`); expect(init?.method).toBe('POST');
    expect(body.test_event_code).toBe('TEST12345');
    expect(body.data[0]).toMatchObject({ event_name: 'SolidConnectionTest', action_source: 'system_generated' });
    expect(body.data[0]!.user_data.external_id[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(body.data[0]!.custom_data).toBeUndefined();
  });
  it.each([
    [400, { code: 190 }, 'META_TOKEN_INVALID', 422],
    [403, { code: 200 }, 'META_PERMISSION_DENIED', 422],
    [429, { code: 4 }, 'META_UNAVAILABLE', 503],
    [500, { code: 2 }, 'META_UNAVAILABLE', 503],
    [400, { code: 100, is_transient: true }, 'META_UNAVAILABLE', 503],
    [400, { code: 100 }, 'META_VALIDATION_FAILED', 422],
  ])('classifies upstream failure %s %j', async (status, error, code, expectedStatus) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response({ error: { ...error, message: token } }, status)));
    await expect(validateMetaCredentials(pixel, token, 'TEST12345')).rejects.toMatchObject({ code, status: expectedStatus });
  });
  it('does not expose transport errors or mislabel them as invalid tokens', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error(`fetch failed ${token}`)));
    const error: unknown = await validateMetaCredentials(pixel, token).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(MetaApiError); if (!(error instanceof MetaApiError)) throw new Error('Expected MetaApiError');
    expect(error.code).toBe('META_UNAVAILABLE'); expect(JSON.stringify(error)).not.toContain(token); expect(error.stack).not.toContain(token);
  });
  it.each([{}, null, { events_received: 0 }, { events_received: 2 }])('rejects unconfirmed event delivery %j', async body => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response(body)));
    await expect(validateMetaCredentials(pixel, token, 'TEST12345')).rejects.toThrow();
  });
  it('never carries a connection test code into live purchases', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(response({ events_received: 1 }))); vi.stubGlobal('fetch', fetcher);
    await validateMetaCredentials(pixel, token, 'TEST12345');
    await sendMetaEvent(pixel, token, { event_name: 'Purchase' });
    const purchase = JSON.parse(fetcher.mock.calls[1]![1]?.body as string) as TestBody;
    expect(purchase.test_event_code).toBeUndefined();
  });
  it('rejects invalid test codes without sending any event', async () => {
    const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher);
    await expect(validateMetaCredentials(pixel, token, 'wrong')).rejects.toMatchObject({ code: 'META_TEST_CODE_INVALID' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
