import type { PrismaClient } from '@solid/database';
import { describe, expect, it, vi } from 'vitest';
import { protectStoreProfile, protectUserProfile, readStoreProfile, readUserProfile } from '../src/profile-protection.js';
import { validBirthDate, validDocument } from '../src/settings-routes.js';
import { refreshStoreOnboarding } from '../src/store-onboarding.js';

const encryptionKey = Buffer.alloc(32, 19).toString('base64');

describe('account profile protection', () => {
  it('keeps only non-sensitive store fields in plaintext', () => {
    const original = { document: '04.252.011/0001-10', legalName: 'SOLID Ltda', businessModel: 'E-commerce' };
    const protectedProfile = protectStoreProfile(original, encryptionKey);
    expect(protectedProfile.profile).toEqual({ businessModel: 'E-commerce' });
    expect(protectedProfile.profileEncrypted).not.toContain('04.252.011');
    expect(readStoreProfile(protectedProfile.profile, protectedProfile.profileEncrypted, encryptionKey)).toEqual(original);
  });

  it('encrypts document, birth date and address while preserving the complete API view', () => {
    const original = { document: '529.982.247-25', birthDate: '1990-01-01', city: 'São Paulo', state: 'SP', locale: 'pt-BR' };
    const protectedProfile = protectUserProfile(original, encryptionKey);
    expect(protectedProfile.profile).toEqual({ locale: 'pt-BR' });
    expect(protectedProfile.profileEncrypted).not.toContain('529.982');
    expect(readUserProfile(protectedProfile.profile, protectedProfile.profileEncrypted, encryptionKey)).toEqual(original);
  });
});

describe('registration validation', () => {
  it('accepts valid CPF and CNPJ checksums and rejects repeated or invalid documents', () => {
    expect(validDocument('529.982.247-25')).toBe(true);
    expect(validDocument('04.252.011/0001-10')).toBe(true);
    expect(validDocument('111.111.111-11')).toBe(false);
    expect(validDocument('529.982.247-24')).toBe(false);
  });

  it('requires a real birth date and an adult account owner', () => {
    expect(validBirthDate('1990-01-01')).toBe(true);
    expect(validBirthDate('2020-02-30')).toBe(false);
    expect(validBirthDate(new Date().toISOString().slice(0, 10))).toBe(false);
  });
});

describe('store activation', () => {
  it('revokes activation when a required field is no longer present', async () => {
    const completedAt = new Date('2026-08-30T12:00:00.000Z');
    const storeProfile = protectStoreProfile({ document: '04.252.011/0001-10', legalName: 'SOLID Ltda', businessModel: 'E-commerce', monthlyRevenue: 'Até R$ 100 mil' }, encryptionKey);
    const userProfile = protectUserProfile({ document: '529.982.247-25', birthDate: '1990-01-01', zipCode: '01001-000', address: '', number: '10', district: 'Sé', city: 'São Paulo', state: 'SP' }, encryptionKey);
    const update = vi.fn().mockResolvedValue({});
    const database = {
      store: {
        findUnique: vi.fn().mockResolvedValue({ name: 'Loja SOLID', ...storeProfile, onboardingCompletedAt: completedAt }),
        update,
      },
      storeMember: {
        findFirst: vi.fn().mockResolvedValue({ user: { id: 'owner-id', name: 'Pessoa Responsável', ...userProfile } }),
      },
      user: { findUnique: vi.fn(), update: vi.fn() },
    } as unknown as PrismaClient;

    const result = await refreshStoreOnboarding(database, 'store-id', 'owner-id', encryptionKey);

    expect(result.completed).toBe(false);
    expect(result.missing).toContain('user.address');
    expect(update).toHaveBeenCalledWith({ where: { id: 'store-id' }, data: { onboardingCompletedAt: null } });
  });
});
