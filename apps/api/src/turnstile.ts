import type { AppEnvironment } from '@solid/config';

type TurnstileResult = { success?: boolean; action?: string; ['error-codes']?: string[] };

export async function verifyTurnstile(environment: AppEnvironment, responseToken: unknown, remoteIp: string | undefined, expectedAction: string): Promise<boolean> {
  if (!environment.TURNSTILE_SECRET_KEY) return true;
  if (typeof responseToken !== 'string' || responseToken.length < 20 || responseToken.length > 2_048) return false;
  const body = new URLSearchParams({ secret: environment.TURNSTILE_SECRET_KEY, response: responseToken });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResult;
    return result.success === true && result.action === expectedAction;
  } catch {
    return false;
  }
}
