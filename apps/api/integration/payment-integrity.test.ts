import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '@solid/database';
import { PrismaGatewayRepository } from '../src/gateway-repository.js';
import { loadDashboardData } from '../src/dashboard-query.js';
import { storeImage, deleteUnusedImage } from '../src/media-storage.js';
import { recoverAbandonedDeliveryLeases } from '../src/abandoned-recovery.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name an isolated *_test database.');
const db = createDatabaseClient(url);
const repo = new PrismaGatewayRepository(db);
let storeId: string;
let checkoutId: string;
let productId: string;
let variantId: string;
async function session() {
  return db.checkoutSession.create({ data: { checkoutId, tokenHash: createHash('sha256').update(randomUUID()).digest('hex'), quantity: 1, unitPriceCents: 10000, totalCents: 10000, expiresAt: new Date(Date.now() + 600_000) } });
}
beforeAll(async () => {
  // This suite owns only fixtures named Integrity test in a dedicated *_test database.
  await db.paymentAttempt.updateMany({ where: { status: 'PENDING', session: { checkout: { store: { name: 'Integrity test' } } } }, data: { status: 'CANCELLED' } });
  const suffix = randomUUID();
  const store = await db.store.create({ data: { name: 'Integrity test', slug: `test-${suffix}` } });
  storeId = store.id;
  const owner = await db.user.create({ data: { name: 'Test owner', email: `${suffix}@example.test`, memberships: { create: { storeId, role: 'OWNER' } } } });
  expect(owner.id).toBeTruthy();
  const checkout = await db.checkout.create({ data: { storeId, name: 'Test', slug: `test-${suffix}`, status: 'PUBLISHED' } });
  checkoutId = checkout.id;
  const product = await db.product.create({ data: { storeId, sourceTitle: 'Paid product', checkoutTitle: 'Paid product', priceCents: 10000, variants: { create: { sourceExternalId: suffix, title: 'Default', priceCents: 10000 } } }, include: { variants: true } });
  productId = product.id; variantId = product.variants[0]!.id;
});
afterAll(async () => {
  if (storeId) await db.paymentAttempt.updateMany({ where: { status: 'PENDING', session: { checkout: { storeId } } }, data: { status: 'CANCELLED' } });
  await db.$disconnect();
});

describe('PostgreSQL payment integrity', () => {
  it('keeps coordinate pairs together and never invents a point for partial or missing geolocation', async () => {
    for (const coordinates of [{ geo_latitude: '-23.55' }, { geo_longitude: '-46.63' }, { geo_latitude: '0', geo_longitude: '0' }, { geo_latitude: '999', geo_longitude: '-46' }]) {
      const s = await session();
      await db.checkoutSession.update({ where: { id: s.id }, data: { trackingParameters: { geo_country: 'BR', geo_region_code: 'SP', geo_city: 'Partial-coordinate-test', ...coordinates } } });
    }
    const report = await loadDashboardData(db, storeId, new Date(Date.now() - 60000), new Date(), new Date());
    expect((report.analytics as { geography: { locations: unknown[] } }).geography.locations).toContainEqual(expect.objectContaining({ city: 'Partial-coordinate-test', latitude: null, longitude: null, visitors: 4 }));
  });
  it('only one concurrent caller reserves creation, including callers using another provider', async () => {
    const s = await session();
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => repo.claimPaymentCreation(s.id, i % 2 ? 'ROAS' : 'WESTPAY', 10000)));
    expect(results.filter(r => r.claimed)).toHaveLength(1);
    expect(new Set(results.map(r => r.attempt.id)).size).toBe(1);
    const restarted = new PrismaGatewayRepository(db);
    await repo.markCreationUncertain(results[0]!.attempt.id);
    expect((await restarted.claimPaymentCreation(s.id, 'ROAS', 10000)).claimed).toBe(false);
  });
  it('claims disjoint reconciliation batches and serves older-than-24h payments', async () => {
    const s = await session();
    const ids = Array.from({ length: 60 }, () => randomUUID());
    await db.paymentAttempt.createMany({ data: ids.map(id => ({ id, publicId: id.replaceAll('-', '').slice(0, 30), checkoutSessionId: s.id, provider: 'ROAS', providerTransactionId: id, idempotencyKey: id, amountCents: 10000, createdAt: new Date(Date.now() - 48 * 3600_000), nextVerificationAt: new Date(Date.now() - 3600_000) })) });
    const results = await Promise.all(Array.from({ length: 12 }, () => repo.pendingPaymentVerifications(new Date(), 'ROAS')));
    const selected = results.flat().map(a => a.id);
    expect(selected).toHaveLength(60);
    expect(new Set(selected).size).toBe(60);
    expect(new Set(selected)).toEqual(new Set(ids));
    expect(await repo.pendingPaymentVerifications(new Date(), 'ROAS')).toHaveLength(0);
  });
  it('resumes a saved gateway response after restart without creating another payment or job', async () => {
    const s = await session();
    const { attempt } = await repo.claimPaymentCreation(s.id, 'ROAS', 10000);
    await repo.saveProviderResponse(attempt.id, randomUUID(), 'encrypted-test-pix', null);
    const restarted = new PrismaGatewayRepository(db);
    await Promise.all([restarted.resumeSavedCreation(attempt.id), restarted.resumeSavedCreation(attempt.id)]);
    expect((await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).creationState).toBe('READY');
    expect((await restarted.claimPaymentCreation(s.id, 'WESTPAY', 10000)).claimed).toBe(false);
    expect(await db.integrationDeliveryJob.count({ where: { checkoutSessionId: s.id, provider: 'SOLID', event: 'pix_created' } })).toBe(1);
  });
  it('late and duplicate confirmations complete a session and charge one fee', async () => {
    const s = await session();
    const { attempt } = await repo.claimPaymentCreation(s.id, 'ROAS', 10000);
    await db.checkoutSession.update({ where: { id: s.id }, data: { status: 'EXPIRED' } });
    await Promise.all(Array.from({ length: 8 }, () => repo.confirmPayment(attempt.id, s.id, 'PAID', new Date())));
    expect((await db.checkoutSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('COMPLETED');
    expect(await db.billingLedgerEntry.count({ where: { paymentAttemptId: attempt.id, type: 'TRANSACTION_FEE' } })).toBe(1);
    await repo.recordPartialRefund(attempt.id, s.id);
    expect((await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).partialRefundAt).not.toBeNull();
    expect(await db.billingLedgerEntry.count({ where: { paymentAttemptId: attempt.id, type: 'REFUND_CREDIT' } })).toBe(0);
  });
  it('aggregates paid products only and isolates stores, including a payment after the creation period', async () => {
    const s = await session();
    await db.checkoutSession.update({ where: { id: s.id }, data: { trackingParameters: { geo_country: 'BR', geo_latitude: '-23.55', geo_longitude: '-46.63', visitor_id: 'geo-test' } } });
    await db.checkoutSessionItem.create({ data: { checkoutSessionId: s.id, productId, variantId, titleSnapshot: 'Paid product', quantity: 1, unitPriceCents: 10000, totalCents: 10000 } });
    let report = await loadDashboardData(db, storeId, new Date(Date.now() - 60000), new Date(), new Date());
    expect((report.analytics as { products: unknown[] }).products).toEqual([]);
    expect((report.analytics as { geography: { locations: unknown[] } }).geography.locations).toContainEqual(expect.objectContaining({ country: 'BR', latitude: -23.55, longitude: -46.63, visitors: 1 }));
    const { attempt } = await repo.claimPaymentCreation(s.id, 'ROAS', 10000);
    await repo.confirmPayment(attempt.id, s.id, 'PAID', new Date());
    await db.checkoutSession.update({ where: { id: s.id }, data: { createdAt: new Date(Date.now() - 10 * 86400_000) } });
    report = await loadDashboardData(db, storeId, new Date(Date.now() - 60000), new Date(), new Date());
    expect((report.analytics as { products: unknown[] }).products).toEqual([{ title: 'Paid product', quantity: 1, revenueCents: 10000 }]);
    expect((await loadDashboardData(db, randomUUID(), new Date(0), new Date(), new Date())).revenueCents).toBe(0);
  });
  it('credits only cumulative proportional fees and preserves already invoiced entries', async () => {
    const s = await session();
    const { attempt } = await repo.claimPaymentCreation(s.id, 'ROAS', 10000);
    await repo.confirmPayment(attempt.id, s.id, 'PAID', new Date());
    await repo.recordPartialRefund(attempt.id, s.id, 4000);
    const first = await db.billingLedgerEntry.findFirstOrThrow({ where: { paymentAttemptId: attempt.id, type: 'REFUND_CREDIT' } });
    expect(first.amountCents).toBe(-80);
    await db.billingLedgerEntry.update({ where: { id: first.id }, data: { billedAt: new Date() } });
    await Promise.all([repo.recordPartialRefund(attempt.id, s.id, 6000), repo.recordPartialRefund(attempt.id, s.id, 6000), repo.recordPartialRefund(attempt.id, s.id, 4000)]);
    await repo.confirmPayment(attempt.id, s.id, 'REFUNDED');
    const credits = await db.billingLedgerEntry.findMany({ where: { paymentAttemptId: attempt.id, type: 'REFUND_CREDIT' } });
    expect(credits.reduce((sum, credit) => sum + credit.amountCents, 0)).toBe(-200);
    expect(credits.find(credit => credit.id === first.id)?.amountCents).toBe(-80);
    expect(credits.find(credit => credit.id === first.id)?.billedAt).not.toBeNull();
  });
  it('deduplicates uploads, enforces concurrent quota and protects referenced or other-store images', async () => {
    const image = Buffer.alloc(60, 1);
    const uploaded = await Promise.all(Array.from({ length: 8 }, () => storeImage(db, storeId, image, 100)));
    expect(new Set(uploaded.map(item => item!.filename)).size).toBe(1);
    const filename = uploaded[0]!.filename;
    expect(await storeImage(db, storeId, Buffer.alloc(60, 2), 100)).toBeNull();
    expect(await deleteUnusedImage(db, randomUUID(), filename)).toBe('NOT_FOUND');
    await db.checkout.update({ where: { id: checkoutId }, data: { draftConfig: { logoUrl: `https://api.example.test/media/${filename}` } } });
    expect(await deleteUnusedImage(db, storeId, filename)).toBe('IN_USE');
    await db.checkout.update({ where: { id: checkoutId }, data: { draftConfig: {} } });
    expect(await deleteUnusedImage(db, storeId, filename)).toBe('DELETED');
    expect(await db.mediaAsset.count({ where: { storeId } })).toBe(0);
  });
  it('recovers an expired delivery lease and refuses completion by the old worker', async () => {
    const s = await session();
    const oldClaim = new Date(Date.now() - 10 * 60_000);
    const delivery = await db.abandonedRecoveryDelivery.create({ data: { storeId, checkoutSessionId: s.id, step: 1, status: 'PROCESSING', scheduledAt: oldClaim, claimedAt: oldClaim } });
    await recoverAbandonedDeliveryLeases(db);
    expect((await db.abandonedRecoveryDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe('PENDING');
    const stale = await db.abandonedRecoveryDelivery.updateMany({ where: { id: delivery.id, status: 'PROCESSING', claimedAt: oldClaim }, data: { status: 'DELIVERED' } });
    expect(stale.count).toBe(0);
  });
});
