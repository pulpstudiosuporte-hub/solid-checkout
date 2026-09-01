import type { PrismaClient } from '@solid/database';

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

export async function refreshStoreOnboarding(database: PrismaClient, storeId: string, userId: string) {
  const [store, ownerMember] = await Promise.all([
    database.store.findUnique({ where: { id: storeId }, select: { name: true, profile: true, onboardingCompletedAt: true } }),
    database.storeMember.findFirst({ where: { storeId, role: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { name: true, profile: true } } } }),
  ]);
  const owner = ownerMember?.user ?? await database.user.findUnique({ where: { id: userId }, select: { name: true, profile: true } });
  if (!store || !owner) return { completed: false, completedAt: null, missing: ['store'] };
  const missing = onboardingMissingFields(store, owner);
  let completedAt = store.onboardingCompletedAt;
  if (!missing.length && !completedAt) {
    completedAt = new Date();
    await database.store.update({ where: { id: storeId }, data: { onboardingCompletedAt: completedAt } });
  }
  return { completed: missing.length === 0, completedAt, missing };
}

export async function storeOnboardingComplete(database: PrismaClient, storeId: string): Promise<boolean> {
  return Boolean((await database.store.findUnique({ where: { id: storeId }, select: { onboardingCompletedAt: true } }))?.onboardingCompletedAt);
}
