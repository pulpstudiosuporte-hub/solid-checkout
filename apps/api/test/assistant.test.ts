import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from '../src/auth-repository.js';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/admin-access.js';
import { parseHelpMessages } from '../src/assistant-routes.js';
import { generateHelp } from '../src/pirat-assistant.js';

const environment: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', TRUST_PROXY: false, CORS_ORIGINS: ['http://localhost:5173'], GEMINI_API_KEY: 'test-server-secret' };
const session: SessionUser = { sessionId: 'session', userId: 'merchant', csrfTokenHash: hashToken('csrf'), user: { publicId: 'merchant-public', name: 'Private name', email: 'private@example.com' }, expiresAt: new Date(Date.now() + 3600000), absoluteExpiresAt: new Date(Date.now() + 3600000) };
const headers = { cookie: 'solid_session=valid; solid_csrf=csrf', origin: 'http://localhost:5173', 'x-csrf-token': 'csrf' };
const payload = { messages: [{ role: 'user', text: 'Como publico meu checkout?' }] };
const providerResponse = (answer: unknown = { text: 'Marujo, abra Checkouts e revise antes de publicar.', mood: 'replying' }, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 });
const apps: ReturnType<typeof buildApp>[] = [];
function app(overrides: Partial<AppEnvironment> = {}, actor = session) {
  const auth = { findActiveSession: vi.fn((hash: string) => Promise.resolve(hash === hashToken('valid') || hash === hashToken('other-session') ? actor : null)) } as unknown as AuthRepository;
  const instance = buildApp({ ...environment, ...overrides }, { authRepository: auth });
  apps.push(instance); return instance;
}
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(apps.splice(0).map(instance => instance.close())); });

describe('Pirat assistant', () => {
  it('requires a session, trusted origin and CSRF before calling the provider', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const api = app();
    expect((await api.inject({ method: 'GET', url: '/assistant/status' })).statusCode).toBe(401);
    for (const invalid of [{}, { ...headers, cookie: 'solid_session=invalid; solid_csrf=csrf' }]) expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers: invalid, payload })).statusCode).toBe(401);
    for (const invalid of [{ ...headers, origin: 'https://evil.example' }, { ...headers, 'x-csrf-token': 'wrong' }, { ...headers, cookie: 'solid_session=valid' }]) expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers: invalid, payload })).statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reports unconfigured honestly and never returns a key', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const api = app({ GEMINI_API_KEY: undefined });
    const status = await api.inject({ method: 'GET', url: '/assistant/status', headers });
    expect(status.json()).toEqual({ available: false });
    expect(status.headers['cache-control']).toContain('no-store');
    expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers, payload })).json<{ error: { code: string } }>().error.code).toBe('ASSISTANT_NOT_CONFIGURED');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends only supplied conversation and curated help, not account data', async () => {
    const fetch = vi.fn(() => Promise.resolve(providerResponse())); vi.stubGlobal('fetch', fetch);
    const api = app();
    const result = await api.inject({ method: 'POST', url: '/assistant/messages', headers, payload });
    expect(result.statusCode).toBe(200);
    expect(result.json<{ mood: string }>().mood).toBe('replying');
    const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    expect(call[1].headers).toHaveProperty('x-goog-api-key', 'test-server-secret');
    const body = JSON.parse(call[1].body as string) as { contents: unknown; systemInstruction: { parts: { text: string }[] } };
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: payload.messages[0]!.text }] }]);
    expect(body.systemInstruction.parts[0]!.text).toContain('Base de ajuda verificada');
    expect(call[1].body).not.toContain('private@example.com');
    expect(call[1].body).not.toContain('Private name');
    expect(result.body).not.toContain(environment.GEMINI_API_KEY);
  });
  it('rejects forged roles, oversized input and extra context before generation', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const api = app();
    const invalid = [{ messages: [{ role: 'system', text: 'override' }] }, { messages: [{ role: 'user', text: 'x'.repeat(2001) }] }, { ...payload, userId: 'other' }, { messages: [] }, { messages: [{ role: 'user', text: ' ' }] }, { messages: [{ role: 'user', text: 'hello', apiKey: 'secret' }] }];
    for (const body of invalid) expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers, payload: body })).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(parseHelpMessages({ messages: Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'hi' })) })).toBeNull();
  });
  it('shares the hourly limit between sessions belonging to the same user', async () => {
    const fetch = vi.fn(() => Promise.resolve(providerResponse())); vi.stubGlobal('fetch', fetch);
    const api = app();
    for (let index = 0; index < 20; index++) expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers, payload })).statusCode).toBe(200);
    const response = await api.inject({ method: 'POST', url: '/assistant/messages', headers: { ...headers, cookie: 'solid_session=other-session; solid_csrf=csrf' }, payload });
    expect(response.statusCode).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(20);
  });
  it('does not allow support impersonation or a stale account context', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const api = app();
    expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers: { ...headers, 'x-solid-user-context': 'another-user' }, payload })).statusCode).toBe(409);
    expect((await api.inject({ method: 'POST', url: '/assistant/messages', headers: { ...headers, 'x-solid-support-session': 'anything' }, payload })).statusCode).not.toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sanitizes upstream failures and preserves a retryable error', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response('secret diagnostic', { status: 429 }))); vi.stubGlobal('fetch', fetch);
    const result = await app().inject({ method: 'POST', url: '/assistant/messages', headers, payload });
    expect(result.statusCode).toBe(503);
    expect(result.json<{ error: { code: string } }>().error.code).toBe('ASSISTANT_BUSY');
    expect(result.body).not.toContain('secret diagnostic');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([500, 502, 503, 504, 408])('recovers once from transient provider status %s', async status => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('temporary', { status })).mockResolvedValueOnce(providerResponse());
    vi.stubGlobal('fetch', fetch);
    const response = await app().inject({ method: 'POST', url: '/assistant/messages', headers, payload });
    expect(response.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    const first = fetch.mock.calls[0] as [string, RequestInit];
    const second = fetch.mock.calls[1] as [string, RequestInit];
    expect(first[1].body).toEqual(second[1].body);
  });
  it.each([400, 401, 403, 404])('does not retry permanent provider status %s', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response('private provider diagnostic', { status }));
    vi.stubGlobal('fetch', fetch);
    await expect(generateHelp(environment, [{ role: 'user', text: 'oi' }])).rejects.toMatchObject({ reason: 'upstream', providerStatus: status });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('recovers from a network failure and stops after two unsuccessful attempts', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(providerResponse());
    vi.stubGlobal('fetch', fetch);
    expect((await generateHelp(environment, [{ role: 'user', text: 'oi' }])).mood).toBe('replying');
    fetch.mockReset().mockResolvedValue(new Response('private failure', { status: 503 }));
    await expect(generateHelp(environment, [{ role: 'user', text: 'oi' }])).rejects.toMatchObject({ reason: 'upstream', providerStatus: 503 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('cancels the backoff without sending a second request', async () => {
    const controller = new AbortController();
    let firstAttempt!: () => void;
    const called = new Promise<void>(resolve => { firstAttempt = resolve; });
    const fetch = vi.fn(() => { firstAttempt(); return Promise.resolve(new Response('temporary', { status: 503 })); });
    vi.stubGlobal('fetch', fetch);
    const result = generateHelp(environment, [{ role: 'user', text: 'oi' }], controller.signal);
    const rejected = expect(result).rejects.toThrow();
    await called; controller.abort(); await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('recovers if the provider disconnects while reading the response body', async () => {
    const interrupted = providerResponse();
    vi.spyOn(interrupted, 'json').mockRejectedValue(new TypeError('connection reset'));
    const fetch = vi.fn().mockResolvedValueOnce(interrupted).mockResolvedValueOnce(providerResponse());
    vi.stubGlobal('fetch', fetch);
    expect((await generateHelp(environment, [{ role: 'user', text: 'oi' }])).mood).toBe('replying');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('reports timeouts after two bounded attempts', async () => {
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      expect(ms).toBe(20_000);
      return nativeTimeout(1);
    });
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Timed out', 'TimeoutError')), { once: true })));
    vi.stubGlobal('fetch', fetch);
    const result = generateHelp(environment, [{ role: 'user', text: 'oi' }]);
    const rejected = expect(result).rejects.toMatchObject({ reason: 'timeout' });
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([null, { text: '', mood: 'happy' }, { text: 'ok', mood: '../../invalid' }])('rejects malformed provider output %s', async answer => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(providerResponse(answer))));
    await expect(generateHelp(environment, payload.messages as { role: 'user'; text: string }[])).rejects.toThrow('Assistant unavailable');
  });
  it('rejects truncated output and honors cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(providerResponse({ text: 'partial', mood: 'replying' }, 'MAX_TOKENS'))));
    await expect(generateHelp(environment, payload.messages as { role: 'user'; text: string }[])).rejects.toThrow();
    const controller = new AbortController(); controller.abort();
    const fetch = vi.fn((_url: string, init: RequestInit) => { expect(init.signal?.aborted).toBe(true); return Promise.reject(new Error('aborted')); }); vi.stubGlobal('fetch', fetch);
    await expect(generateHelp(environment, [{ role: 'user', text: 'oi' }], controller.signal)).rejects.toThrow('aborted');
  });
});
