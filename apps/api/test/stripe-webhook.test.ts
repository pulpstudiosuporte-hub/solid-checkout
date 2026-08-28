import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from '../src/auth-repository.js';
import type { PrismaClient } from '@solid/database';
import { buildApp } from '../src/app.js';

describe('webhook Stripe', () => {
  it('valida a assinatura usando o corpo bruto recebido', async () => {
    const secret = 'whsec_test_secret';
    const payload = JSON.stringify({
      id: 'evt_test',
      object: 'event',
      api_version: '2025-11-17.clover',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cs_test', object: 'checkout.session', metadata: {}, subscription: null } },
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: 'checkout.session.completed',
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const environment = {
      NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, API_PUBLIC_URL: 'https://api.solidcheckout.xyz', APP_URL: 'https://app.solidcheckout.xyz',
      LOG_LEVEL: 'silent', CORS_ORIGINS: ['https://app.solidcheckout.xyz'], TRUST_PROXY: false,
      STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: secret,
      STRIPE_PRICE_START: 'price_start', STRIPE_PRICE_PRIME: 'price_prime', STRIPE_PRICE_ELITE: 'price_elite',
    } satisfies AppEnvironment;
    const app = buildApp(environment, { authRepository: {} as AuthRepository, database: {} as PrismaClient });

    const response = await app.inject({ method: 'POST', url: '/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, payload });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
  });
});
