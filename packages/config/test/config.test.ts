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
});
