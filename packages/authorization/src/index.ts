export const storeRoles = ['OWNER', 'ADMIN', 'ANALYST'] as const;
export type StoreRole = typeof storeRoles[number];

export type AuthenticatedActor = Readonly<{ userId: string; sessionId: string }>;
export type StoreMembership = Readonly<{ userId: string; storeId: string; role: StoreRole; storeActive: boolean }>;
export type StoreContext = Readonly<{ userId: string; sessionId: string; storeId: string; role: StoreRole }>;

export interface MembershipReader {
  findMembership(userId: string, storePublicId: string): Promise<StoreMembership | null>;
}

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN';
  constructor() { super('Acesso negado.'); this.name = 'AuthorizationError'; }
}

export async function authorizeStore(
  actor: AuthenticatedActor,
  storePublicId: string,
  memberships: MembershipReader,
  allowedRoles: readonly StoreRole[] = storeRoles
): Promise<StoreContext> {
  if (!actor.userId || !actor.sessionId || !storePublicId) throw new AuthorizationError();
  const membership = await memberships.findMembership(actor.userId, storePublicId);
  if (!membership?.storeActive || !allowedRoles.includes(membership.role)) throw new AuthorizationError();
  return { userId: actor.userId, sessionId: actor.sessionId, storeId: membership.storeId, role: membership.role };
}

export type TenantRecord = Readonly<{ id: string; storeId: string; value: string }>;
export interface TenantRepository { list(context: StoreContext): Promise<readonly TenantRecord[]>; find(context: StoreContext, id: string): Promise<TenantRecord | null>; }

export class InMemoryTenantRepository implements TenantRepository {
  constructor(private readonly records: readonly TenantRecord[]) {}
  list(context: StoreContext): Promise<readonly TenantRecord[]> { return Promise.resolve(this.records.filter(record => record.storeId === context.storeId)); }
  find(context: StoreContext, id: string): Promise<TenantRecord | null> { return Promise.resolve(this.records.find(record => record.storeId === context.storeId && record.id === id) ?? null); }
}
