/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const values = new Map();
vi.stubGlobal('sessionStorage', {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
});

const { apiBaseUrl, bindTabToUser, clearTabUser, resolveMediaUrl } = await import('../src/api.js');

beforeEach(() => values.clear());

describe('cliente web da API', () => {
  it('mantém o contexto do usuário isolado por aba', () => {
    bindTabToUser('user-1');
    expect(sessionStorage.getItem('solid-tab-user-context')).toBe('user-1');
    clearTabUser();
    expect(sessionStorage.getItem('solid-tab-user-context')).toBeNull();
  });

  it('normaliza mídia própria para o host atual da API', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(resolveMediaUrl(`https://old.example.com/media/${id}.webp?cache=1`)).toBe(`${apiBaseUrl}/media/${id}.webp`);
    expect(resolveMediaUrl('https://cdn.example.com/image.jpg')).toBe('https://cdn.example.com/image.jpg');
  });
});
