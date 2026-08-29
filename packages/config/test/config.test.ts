import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../src/index.js';

describe('parseEnvironment', () => {
  it('aplica padrões seguros para desenvolvimento', () => {
    expect(parseEnvironment({}).API_HOST).toBe('127.0.0.1');
  });
  it('rejeita porta privilegiada', () => {
    expect(() => parseEnvironment({ API_PORT: '80' })).toThrow('ambiente inválida');
  });
  it('rejeita localhost em produção', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'production', CORS_ORIGINS: 'http://localhost:5173' })).toThrow('localhost');
  });
  it('normaliza barras finais da URL pública do app', () => {
    const shopifyEnvironment = {
      SHOPIFY_CLIENT_ID: 'client-id',
      SHOPIFY_CLIENT_SECRET: 'client-secret-with-safe-length',
      SHOPIFY_REDIRECT_URI: 'https://api.solidcheckout.xyz/integrations/shopify/callback',
      APP_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64')
    };
    expect(parseEnvironment({ ...shopifyEnvironment, APP_URL: 'https://app.solidcheckout.xyz\\' }).APP_URL).toBe('https://app.solidcheckout.xyz');
    expect(parseEnvironment({ ...shopifyEnvironment, APP_URL: 'https://app.solidcheckout.xyz///' }).APP_URL).toBe('https://app.solidcheckout.xyz');
  });
});
