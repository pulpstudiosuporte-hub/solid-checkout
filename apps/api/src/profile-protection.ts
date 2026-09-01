import type { Prisma } from '@solid/database';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

const STORE_SENSITIVE_KEYS = new Set(['document', 'legalName']);
const USER_SENSITIVE_KEYS = new Set(['document', 'birthDate', 'zipCode', 'address', 'number', 'complement', 'district', 'city', 'state']);

const split = (value: unknown, sensitiveKeys: ReadonlySet<string>) => {
  const publicProfile: JsonRecord = {};
  const sensitiveProfile: JsonRecord = {};
  for (const [key, entry] of Object.entries(record(value))) {
    (sensitiveKeys.has(key) ? sensitiveProfile : publicProfile)[key] = entry;
  }
  return { publicProfile, sensitiveProfile };
};

const read = (value: unknown, encrypted: string | null | undefined, encryptionKey: string, sensitiveKeys: ReadonlySet<string>): JsonRecord => {
  const legacy = record(value);
  if (!encrypted) return legacy;
  const sensitive = record(JSON.parse(decryptSecret(encrypted, encryptionKey)));
  const { publicProfile } = split(legacy, sensitiveKeys);
  return { ...publicProfile, ...sensitive };
};

const protect = (value: unknown, encryptionKey: string, sensitiveKeys: ReadonlySet<string>) => {
  const { publicProfile, sensitiveProfile } = split(value, sensitiveKeys);
  return {
    profile: publicProfile as Prisma.InputJsonValue,
    profileEncrypted: encryptSecret(JSON.stringify(sensitiveProfile), encryptionKey),
  };
};

export const readStoreProfile = (profile: unknown, encrypted: string | null | undefined, encryptionKey: string) => read(profile, encrypted, encryptionKey, STORE_SENSITIVE_KEYS);
export const readUserProfile = (profile: unknown, encrypted: string | null | undefined, encryptionKey: string) => read(profile, encrypted, encryptionKey, USER_SENSITIVE_KEYS);
export const protectStoreProfile = (profile: unknown, encryptionKey: string) => protect(profile, encryptionKey, STORE_SENSITIVE_KEYS);
export const protectUserProfile = (profile: unknown, encryptionKey: string) => protect(profile, encryptionKey, USER_SENSITIVE_KEYS);
export const storeProfileNeedsMigration = (profile: unknown, encrypted: string | null | undefined) => !encrypted && Object.keys(split(profile, STORE_SENSITIVE_KEYS).sensitiveProfile).length > 0;
export const userProfileNeedsMigration = (profile: unknown, encrypted: string | null | undefined) => !encrypted && Object.keys(split(profile, USER_SENSITIVE_KEYS).sensitiveProfile).length > 0;
