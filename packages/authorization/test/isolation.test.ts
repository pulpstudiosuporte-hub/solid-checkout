import { describe, expect, it } from 'vitest';
import { AuthorizationError, InMemoryTenantRepository, authorizeStore, type MembershipReader } from '../src/index.js';

const memberships: MembershipReader = {
  findMembership(userId, storePublicId) {
    if (userId === 'user-a' && storePublicId === 'public-a') return Promise.resolve({ userId, storeId: 'store-a', role: 'OWNER', storeActive: true });
    if (userId === 'user-b' && storePublicId === 'public-b') return Promise.resolve({ userId, storeId: 'store-b', role: 'ANALYST', storeActive: true });
    return Promise.resolve(null);
  }
};
const repository = new InMemoryTenantRepository([{ id: 'order-a', storeId: 'store-a', value: 'A' }, { id: 'order-b', storeId: 'store-b', value: 'B' }]);

describe('isolamento multiempresa', () => {
  it('deriva o storeId interno da associação autorizada', async () => {
    const context = await authorizeStore({ userId: 'user-a', sessionId: 'session-a' }, 'public-a', memberships);
    expect(context.storeId).toBe('store-a');
  });
  it('não autoriza publicId de outra loja', async () => {
    await expect(authorizeStore({ userId: 'user-a', sessionId: 'session-a' }, 'public-b', memberships)).rejects.toBeInstanceOf(AuthorizationError);
  });
  it('nunca lista registros pertencentes a outra loja', async () => {
    const context = await authorizeStore({ userId: 'user-a', sessionId: 'session-a' }, 'public-a', memberships);
    expect(await repository.list(context)).toEqual([{ id: 'order-a', storeId: 'store-a', value: 'A' }]);
    await expect(repository.find(context, 'order-b')).resolves.toBeNull();
  });
  it('aplica papel mínimo por operação', async () => {
    await expect(authorizeStore({ userId: 'user-b', sessionId: 'session-b' }, 'public-b', memberships, ['OWNER', 'ADMIN'])).rejects.toBeInstanceOf(AuthorizationError);
  });
});
