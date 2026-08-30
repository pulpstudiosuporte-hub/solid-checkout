import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const countryCentroids: Record<string, readonly [number, number]> = {
  BR: [-14.235, -51.9253], US: [37.0902, -95.7129], PT: [39.3999, -8.2245],
  AR: [-38.4161, -63.6167], CL: [-35.6751, -71.543], CO: [4.5709, -74.2973],
  MX: [23.6345, -102.5528], CA: [56.1304, -106.3468], GB: [55.3781, -3.436],
};

type DashboardPeriod = 'today' | 'yesterday' | '7d' | 'month' | 'year';

function periodStart(now: Date, period: DashboardPeriod): Date {
  const today = dayFormatter.format(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const start = new Date(Date.UTC(period === 'year' ? year : year, period === 'year' ? 0 : month - 1, period === 'month' || period === 'year' ? 1 : day, 3));
  if (period === '7d') start.setUTCDate(start.getUTCDate() - 6);
  if (period === 'yesterday') start.setUTCDate(start.getUTCDate() - 1);
  return start;
}

export function registerDashboardRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const cookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';

  app.get<{ Querystring: { period?: string } }>('/dashboard', async (request, reply) => {
    const raw = request.cookies[cookie];
    const session = raw ? await auth.findActiveSession(sha256(raw), new Date()) : null;
    if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));

    const selected = await db.session.findUnique({ where: { id: session.sessionId }, select: { activeStoreId: true } });
    if (!selected?.activeStoreId) return reply.code(409).send(failure(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: selected.activeStoreId, userId: session.userId } } });
    if (!member) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));

    const now = new Date();
    const allowed = new Set<DashboardPeriod>(['today', 'yesterday', '7d', 'month', 'year']);
    const period = allowed.has(request.query.period as DashboardPeriod) ? request.query.period as DashboardPeriod : '7d';
    const start = periodStart(now, period);
    const end = period === 'yesterday' ? new Date(start.getTime() + 86_400_000 - 1) : now;
    const storeId = selected.activeStoreId;

    const [createdSessions, paidAttempts, products, checkouts, published, gateways, activeSessions] = await Promise.all([
      db.checkoutSession.findMany({
        where: { checkout: { storeId }, createdAt: { gte: start, lte: end } },
        select: {
          id: true, status: true, totalCents: true, discountCents: true, couponCode: true,
          customerEmailHash: true, customerCapturedAt: true, shippingCapturedAt: true, createdAt: true, trackingParameters: true,
          items: { select: { titleSnapshot: true, quantity: true, totalCents: true, isOrderBump: true } },
          paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, provider: true, amountCents: true } },
        },
      }),
      db.paymentAttempt.findMany({
        where: { status: 'PAID', paidAt: { gte: start, lte: end }, session: { checkout: { storeId } } },
        orderBy: { paidAt: 'asc' },
        select: { checkoutSessionId: true, amountCents: true, paidAt: true },
      }),
      db.product.count({ where: { storeId, active: true } }),
      db.checkout.count({ where: { storeId, archivedAt: null } }),
      db.checkout.count({ where: { storeId, status: 'PUBLISHED', archivedAt: null } }),
      db.gatewayConnection.count({ where: { storeId, active: true } }),
      db.checkoutSession.findMany({ where: { checkout: { storeId }, status: 'OPEN', expiresAt: { gt: now }, updatedAt: { gte: new Date(now.getTime() - 60_000) } }, select: { id: true, trackingParameters: true } }),
    ]);

    const activeVisitorKeys = new Set(activeSessions.map(row => {
      const tracking = typeof row.trackingParameters === 'object' && row.trackingParameters && !Array.isArray(row.trackingParameters) ? row.trackingParameters as Record<string, unknown> : {};
      const visitorId = typeof tracking.visitor_id === 'string' ? tracking.visitor_id : null;
      const ip = typeof tracking.client_ip_address === 'string' ? tracking.client_ip_address : null;
      const agent = typeof tracking.client_user_agent === 'string' ? tracking.client_user_agent : null;
      return visitorId || (ip ? sha256(`${ip}:${agent ?? ''}`) : row.id);
    }));
    const activeVisitors = activeVisitorKeys.size;

    const paidBySession = new Map<string, { amountCents: number; paidAt: Date }>();
    for (const attempt of paidAttempts) if (attempt.paidAt) paidBySession.set(attempt.checkoutSessionId, { amountCents: attempt.amountCents, paidAt: attempt.paidAt });
    const paid = [...paidBySession.values()];
    const lastDay = period === 'yesterday' ? end : now;
    const days = Math.max(1, Math.round((new Date(`${dayFormatter.format(lastDay)}T03:00:00.000Z`).getTime() - start.getTime()) / 86_400_000) + 1);
    const series = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      const matches = paid.filter(attempt => dayFormatter.format(attempt.paidAt) === date);
      return { date, revenueCents: matches.reduce((sum, attempt) => sum + attempt.amountCents, 0), paidOrders: matches.length };
    });

    const paidCreatedSessions = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'PAID').length;
    const generatedRevenueCents = createdSessions.reduce((sum, row) => sum + (row.totalCents ?? 0), 0);
    const paidRevenueCents = paid.reduce((sum, attempt) => sum + attempt.amountCents, 0);
    const abandoned = createdSessions.filter(row => row.status === 'EXPIRED' || (row.status === 'OPEN' && row.createdAt && row.createdAt < new Date(now.getTime() - 30 * 60_000))).length;
    const pending = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'PENDING').length;
    const refunded = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'REFUNDED').length;
    const cancelled = createdSessions.filter(row => row.status === 'CANCELLED' || row.paymentAttempts[0]?.status === 'CANCELLED').length;
    const customerHashes = createdSessions.map(row => row.customerEmailHash).filter((value): value is string => Boolean(value));
    const uniqueCustomers = new Set(customerHashes).size;
    const couponSessions = createdSessions.filter(row => row.couponCode);
    const bumpItems = createdSessions.flatMap(row => row.items ?? []).filter(item => item.isOrderBump);
    const productMap = new Map<string, { title: string; quantity: number; revenueCents: number }>();
    for (const row of createdSessions) for (const item of row.items ?? []) {
      const current = productMap.get(item.titleSnapshot) || { title: item.titleSnapshot, quantity: 0, revenueCents: 0 };
      current.quantity += item.quantity; current.revenueCents += item.totalCents; productMap.set(item.titleSnapshot, current);
    }
    const gatewayMap = new Map<string, { provider: string; attempts: number; paid: number; revenueCents: number }>();
    for (const row of createdSessions) {
      const attempt = row.paymentAttempts[0]; if (!attempt) continue;
      const current = gatewayMap.get(attempt.provider) || { provider: attempt.provider, attempts: 0, paid: 0, revenueCents: 0 };
      current.attempts += 1; if (attempt.status === 'PAID') { current.paid += 1; current.revenueCents += attempt.amountCents; } gatewayMap.set(attempt.provider, current);
    }
    const geoMap = new Map<string, { country: string; region: string | null; city: string | null; latitude: number | null; longitude: number | null; visitors: number }>();
    for (const row of createdSessions) {
      const tracking = typeof row.trackingParameters === 'object' && row.trackingParameters && !Array.isArray(row.trackingParameters) ? row.trackingParameters as Record<string, unknown> : {};
      const country = typeof tracking.geo_country === 'string' ? tracking.geo_country : null;
      if (!country) continue;
      const region = typeof tracking.geo_region_code === 'string' ? tracking.geo_region_code : typeof tracking.geo_region === 'string' ? tracking.geo_region : null;
      const city = typeof tracking.geo_city === 'string' ? tracking.geo_city : null;
      const fallbackCoordinates = countryCentroids[country.toUpperCase()];
      const latitude = typeof tracking.geo_latitude === 'string' && Number.isFinite(Number(tracking.geo_latitude)) ? Number(tracking.geo_latitude) : fallbackCoordinates?.[0] ?? null;
      const longitude = typeof tracking.geo_longitude === 'string' && Number.isFinite(Number(tracking.geo_longitude)) ? Number(tracking.geo_longitude) : fallbackCoordinates?.[1] ?? null;
      const key = `${country}:${region ?? ''}:${city ?? ''}`;
      const current = geoMap.get(key) || { country, region, city, latitude, longitude, visitors: 0 };
      current.visitors += 1; geoMap.set(key, current);
    }
    const locations = [...geoMap.values()].sort((a, b) => b.visitors - a.visitors);
    return reply.header('cache-control', 'private, no-store').send({
      userName: session.user.name,
      revenueCents: paidRevenueCents,
      paidOrders: paid.length,
      pendingPix: pending,
      activeVisitors,
      conversionRate: createdSessions.length ? Math.round(paidCreatedSessions / createdSessions.length * 10_000) / 100 : 0,
      series,
      analytics: {
        sessions: createdSessions.length, generatedRevenueCents, paidRevenueCents,
        averageTicketCents: paid.length ? Math.round(paidRevenueCents / paid.length) : 0,
        abandoned, abandonmentRate: createdSessions.length ? Math.round(abandoned / createdSessions.length * 10_000) / 100 : 0,
        pending, cancelled, refunded, uniqueCustomers,
        checkoutSteps: {
          visitors: createdSessions.length,
          personal: createdSessions.filter(row => row.customerCapturedAt).length,
          shipping: createdSessions.filter(row => row.shippingCapturedAt).length,
          payment: createdSessions.filter(row => row.paymentAttempts.length).length,
          paid: paidCreatedSessions,
        },
        coupons: {
          orders: couponSessions.length,
          revenueCents: couponSessions.reduce((sum, row) => sum + (row.totalCents ?? 0), 0),
          discountCents: couponSessions.reduce((sum, row) => sum + (row.discountCents ?? 0), 0),
        },
        orderBumps: {
          items: bumpItems.reduce((sum, item) => sum + item.quantity, 0),
          revenueCents: bumpItems.reduce((sum, item) => sum + item.totalCents, 0),
        },
        gateways: [...gatewayMap.values()].map(item => ({ ...item, conversionRate: item.attempts ? Math.round(item.paid / item.attempts * 10_000) / 100 : 0 })),
        products: [...productMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
        geography: { locations, countries: new Set(locations.map(item => item.country)).size, regions: new Set(locations.map(item => `${item.country}:${item.region ?? ''}`)).size, cities: new Set(locations.filter(item => item.city).map(item => `${item.country}:${item.region ?? ''}:${item.city}`)).size, visitors: locations.reduce((sum, item) => sum + item.visitors, 0) },
      },
      checklist: { store: true, product: products > 0, checkout: checkouts > 0, gateway: gateways > 0, published: published > 0 },
    });
  });
}
