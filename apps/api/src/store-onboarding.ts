import type { PrismaClient } from '@solid/database';
import {
  protectStoreProfile,
  protectUserProfile,
  readStoreProfile,
  readUserProfile,
  storeProfileNeedsMigration,
  userProfileNeedsMigration,
} from './profile-protection.js';

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const present = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

export const onboardingMissingFields = (store: { name: string; profile: unknown }, user: { name: string; profile: unknown }): string[] => {
  const storeProfile = record(store.profile);
  const userProfile = record(user.profile);
  const fields: Array<[string, unknown]> = [
    ['store.name', store.name],
    ['store.legalName', storeProfile.legalName],
    ['store.document', storeProfile.document],
    ['store.businessModel', storeProfile.businessModel],
    ['store.monthlyRevenue', storeProfile.monthlyRevenue],
    ['user.name', user.name],
    ['user.document', userProfile.document],
    ['user.birthDate', userProfile.birthDate],
    ['user.zipCode', userProfile.zipCode],
    ['user.address', userProfile.address],
    ['user.number', userProfile.number],
    ['user.district', userProfile.district],
    ['user.city', userProfile.city],
    ['user.state', userProfile.state],
  ];
  return fields.filter(([, value]) => !present(value)).map(([field]) => field);
};

export async function refreshStoreOnboarding(database: PrismaClient, storeId: string, userId?: string, encryptionKey?: string) {
  const [store, ownerMember] = await Promise.all([
    database.store.findUnique({ where: { id: storeId }, select: { name: true, profile: true, profileEncrypted: true, onboardingCompletedAt: true } }),
    database.storeMember.findFirst({ where: { storeId, role: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { id: true, name: true, platformAdmin: true, profile: true, profileEncrypted: true } } } }),
  ]);
  const fallbackOwner = !ownerMember?.user && userId
    ? await database.user.findUnique({ where: { id: userId }, select: { id: true, name: true, platformAdmin: true, profile: true, profileEncrypted: true } })
    : null;
  const owner = ownerMember?.user ?? fallbackOwner;
  if (!store || !owner) return { completed: false, completedAt: null, missing: ['store'] };

  // Platform administrators need disposable stores to exercise the complete
  // checkout flow. Their own stores bypass merchant KYC/onboarding, while
  // ordinary store owners and members keep the production requirements.
  if (owner.platformAdmin) {
    const completedAt = store.onboardingCompletedAt ?? new Date();
    if (!store.onboardingCompletedAt) {
      await database.store.update({ where: { id: storeId }, data: { onboardingCompletedAt: completedAt } });
    }
    return { completed: true, completedAt, missing: [], bypassed: true };
  }

  let storeProfile = record(store.profile);
  let ownerProfile = record(owner.profile);
  try {
    if (encryptionKey) {
      storeProfile = readStoreProfile(store.profile, store.profileEncrypted, encryptionKey);
      ownerProfile = readUserProfile(owner.profile, owner.profileEncrypted, encryptionKey);
      const migrations: Promise<unknown>[] = [];
      if (storeProfileNeedsMigration(store.profile, store.profileEncrypted)) {
        migrations.push(database.store.update({ where: { id: storeId }, data: protectStoreProfile(storeProfile, encryptionKey) }));
      }
      if (userProfileNeedsMigration(owner.profile, owner.profileEncrypted)) {
        migrations.push(database.user.update({ where: { id: owner.id }, data: protectUserProfile(ownerProfile, encryptionKey) }));
      }
      await Promise.all(migrations);
    } else if (store.profileEncrypted || owner.profileEncrypted) {
      return { completed: false, completedAt: null, missing: ['encryption'] };
    }
  } catch {
    return { completed: false, completedAt: null, missing: ['encryption'] };
  }

  const missing = onboardingMissingFields({ name: store.name, profile: storeProfile }, { name: owner.name, profile: ownerProfile });
  const completed = missing.length === 0;
  let completedAt = completed ? store.onboardingCompletedAt : null;
  if (completed && !completedAt) completedAt = new Date();
  if (completedAt?.getTime() !== store.onboardingCompletedAt?.getTime()) {
    await database.store.update({ where: { id: storeId }, data: { onboardingCompletedAt: completedAt } });
  }
  return { completed, completedAt, missing };
}

export async function storeOnboardingComplete(database: PrismaClient, storeId: string, encryptionKey?: string): Promise<boolean> {
  return (await refreshStoreOnboarding(database, storeId, undefined, encryptionKey)).completed;
}
