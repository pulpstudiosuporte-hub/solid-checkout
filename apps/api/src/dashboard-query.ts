import type { PrismaClient } from '@solid/database';

// All large sets stay in PostgreSQL. Only bounded chart buckets and rankings cross the wire.
export async function loadDashboardData(db: PrismaClient, storeId: string, start: Date, end: Date, now: Date): Promise<Record<string, unknown>> {
  const rows = await db.$queryRaw<{ payload: Record<string, unknown> & { analytics?: { geography?: { locations?: { country: string; latitude: number | null; longitude: number | null }[] } } } }[]>`
WITH params AS (SELECT ${storeId}::uuid store_id, ${start}::timestamptz starts, ${end}::timestamptz ends, ${now}::timestamptz current_at),
paid AS (
  SELECT DISTINCT ON (p.checkout_session_id) p.checkout_session_id, p.amount_cents, p.paid_at
  FROM payment_attempts p JOIN checkout_sessions s ON s.id = p.checkout_session_id JOIN checkouts c ON c.id = s.checkout_id, params a
  WHERE c.store_id = a.store_id AND p.status = 'PAID' AND p.paid_at BETWEEN a.starts AND a.ends
  ORDER BY p.checkout_session_id, p.paid_at DESC, p.id DESC
),
sessions AS (
  SELECT s.*, latest.status payment_status, latest.provider, latest.amount_cents payment_amount,
    COALESCE(NULLIF(s.tracking_parameters->>'visitor_id',''), CASE WHEN s.tracking_parameters->>'client_ip_address' IS NOT NULL THEN md5((s.tracking_parameters->>'client_ip_address') || ':' || COALESCE(s.tracking_parameters->>'client_user_agent','')) END, s.id::text) visitor_key
  FROM checkout_sessions s JOIN checkouts c ON c.id = s.checkout_id CROSS JOIN params a
  LEFT JOIN LATERAL (SELECT p.status, p.provider, p.amount_cents FROM payment_attempts p WHERE p.checkout_session_id = s.id AND p.provider_transaction_id IS NOT NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1) latest ON true
  WHERE c.store_id = a.store_id AND s.created_at BETWEEN a.starts AND a.ends
),
paid_sessions AS (SELECT s.*, p.amount_cents paid_amount, p.paid_at FROM paid p JOIN checkout_sessions s ON s.id = p.checkout_session_id),
totals AS (
 SELECT count(*) sessions, count(*) FILTER (WHERE payment_status IS NOT NULL) generated,
 COALESCE(sum(payment_amount),0) generated_amount,
 count(*) FILTER (WHERE id IN (SELECT checkout_session_id FROM paid)) converted,
 count(*) FILTER (WHERE payment_status = 'PENDING') pending,
 count(*) FILTER (WHERE payment_status = 'REFUNDED') refunded,
 count(*) FILTER (WHERE status = 'CANCELLED' OR payment_status = 'CANCELLED') cancelled,
 count(*) FILTER (WHERE status <> 'COMPLETED' AND (status = 'EXPIRED' OR (status = 'OPEN' AND created_at < (SELECT current_at FROM params) - interval '30 minutes'))) abandoned,
 count(DISTINCT customer_email_hash) customers,
 count(*) FILTER (WHERE customer_captured_at IS NOT NULL) personal,
 count(*) FILTER (WHERE shipping_captured_at IS NOT NULL) shipping FROM sessions
),
revenue AS (SELECT count(*) orders, COALESCE(sum(amount_cents),0) amount FROM paid),
days AS (SELECT generate_series((starts AT TIME ZONE 'America/Sao_Paulo')::date::timestamp, (ends AT TIME ZONE 'America/Sao_Paulo')::date::timestamp, interval '1 day')::date AS day FROM params),
daily AS (SELECT (paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(*) orders, sum(amount_cents) amount FROM paid GROUP BY 1),
hours AS (SELECT h AS hour, count(p.checkout_session_id) orders, COALESCE(sum(p.amount_cents),0) amount FROM generate_series(0,23) h LEFT JOIN paid p ON extract(hour FROM p.paid_at AT TIME ZONE 'America/Sao_Paulo') = h GROUP BY h),
weekdays AS (SELECT d AS weekday, count(p.checkout_session_id) orders, COALESCE(sum(p.amount_cents),0) amount FROM generate_series(0,6) d LEFT JOIN paid p ON extract(dow FROM p.paid_at AT TIME ZONE 'America/Sao_Paulo') = d GROUP BY d),
coupons AS (SELECT coupon_code code, count(*) orders, sum(paid_amount) amount, sum(GREATEST(0,discount_cents-payment_discount_cents)) discount FROM paid_sessions WHERE coupon_code IS NOT NULL GROUP BY coupon_code),
sold_items AS (
 SELECT i.product_id, i.title_snapshot, i.quantity, i.is_order_bump,
 round(i.total_cents::numeric * GREATEST(0,s.paid_amount-s.shipping_price_cents) / NULLIF(s.total_cents,0)) amount
 FROM paid_sessions s JOIN checkout_session_items i ON i.checkout_session_id=s.id
),
product_sales AS (SELECT product_id, max(title_snapshot) title, sum(quantity) quantity, COALESCE(sum(amount),0) amount FROM sold_items GROUP BY product_id ORDER BY amount DESC, product_id LIMIT 8),
geo AS (
 SELECT tracking_parameters->>'geo_country' country,
 COALESCE(tracking_parameters->>'geo_region_code',tracking_parameters->>'geo_region') region,
 tracking_parameters->>'geo_city' city,
 avg(CASE WHEN tracking_parameters->>'geo_latitude' ~ '^[-]?[0-9]{1,3}([.][0-9]+)?$'
 THEN CASE WHEN abs((tracking_parameters->>'geo_latitude')::double precision) <= 90 THEN (tracking_parameters->>'geo_latitude')::double precision END END) latitude,
 avg(CASE WHEN tracking_parameters->>'geo_longitude' ~ '^[-]?[0-9]{1,3}([.][0-9]+)?$'
 THEN CASE WHEN abs((tracking_parameters->>'geo_longitude')::double precision) <= 180 THEN (tracking_parameters->>'geo_longitude')::double precision END END) longitude,
 count(DISTINCT visitor_key) visitors FROM sessions WHERE tracking_parameters->>'geo_country' IS NOT NULL GROUP BY 1,2,3
),
state_sales AS (SELECT COALESCE(tracking_parameters->>'geo_region_code',tracking_parameters->>'geo_region') state, count(*) orders, sum(paid_amount) amount FROM paid_sessions GROUP BY 1),
city_sales AS (SELECT COALESCE(tracking_parameters->>'geo_region_code',tracking_parameters->>'geo_region') state, tracking_parameters->>'geo_city' city, count(*) orders, sum(paid_amount) amount FROM paid_sessions GROUP BY 1,2),
gateways AS (SELECT provider, count(*) attempts, count(*) FILTER (WHERE payment_status='PAID') paid, COALESCE(sum(payment_amount) FILTER (WHERE payment_status='PAID'),0) amount FROM sessions WHERE provider IS NOT NULL GROUP BY provider),
active AS (
 SELECT count(DISTINCT COALESCE(NULLIF(s.tracking_parameters->>'visitor_id',''), CASE WHEN s.tracking_parameters->>'client_ip_address' IS NOT NULL THEN md5((s.tracking_parameters->>'client_ip_address') || ':' || COALESCE(s.tracking_parameters->>'client_user_agent','')) END,s.id::text)) visitors
 FROM checkout_sessions s JOIN checkouts c ON c.id=s.checkout_id, params a WHERE c.store_id=a.store_id AND s.status='OPEN' AND s.expires_at>a.current_at AND s.updated_at>=a.current_at-interval '1 minute'
)
SELECT jsonb_build_object(
 'revenueCents',r.amount,'paidOrders',r.orders,'pendingPix',t.pending,'activeVisitors',(SELECT visitors FROM active),
 'conversionRate',COALESCE(round(t.converted*100.0/NULLIF(t.sessions,0),2),0),
 'series',(SELECT COALESCE(jsonb_agg(jsonb_build_object('date',d.day,'paidOrders',COALESCE(v.orders,0),'revenueCents',COALESCE(v.amount,0)) ORDER BY d.day),'[]'::jsonb) FROM days d LEFT JOIN daily v USING(day)),
 'analytics',jsonb_build_object(
  'sessions',t.sessions,'generatedOrders',t.generated,'generatedRevenueCents',t.generated_amount,'paidRevenueCents',r.amount,
  'averageTicketCents',COALESCE(round(r.amount/NULLIF(r.orders,0)),0),'abandoned',t.abandoned,'abandonmentRate',COALESCE(round(t.abandoned*100.0/NULLIF(t.sessions,0),2),0),
  'pending',t.pending,'cancelled',t.cancelled,'refunded',t.refunded,'uniqueCustomers',t.customers,
  'checkoutSteps',jsonb_build_object('visitors',t.sessions,'personal',t.personal,'shipping',t.shipping,'payment',t.generated,'paid',t.converted),
  'coupons',jsonb_build_object('orders',(SELECT COALESCE(sum(orders),0) FROM coupons),'revenueCents',(SELECT COALESCE(sum(amount),0) FROM coupons),'discountCents',(SELECT COALESCE(sum(discount),0) FROM coupons),'items',(SELECT COALESCE(jsonb_agg(jsonb_build_object('code',code,'orders',orders,'revenueCents',amount,'discountCents',discount)),'[]'::jsonb) FROM (SELECT * FROM coupons ORDER BY amount DESC,code LIMIT 100) c)),
  'bestMoments',jsonb_build_object('bestHour',(SELECT hour FROM hours WHERE orders>0 ORDER BY orders DESC,amount DESC,hour LIMIT 1),'bestWeekday',(SELECT (ARRAY['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])[weekday+1] FROM weekdays WHERE orders>0 ORDER BY orders DESC,amount DESC,weekday LIMIT 1),'hourly',(SELECT jsonb_agg(jsonb_build_object('hour',hour,'orders',orders,'revenueCents',amount) ORDER BY hour) FROM hours),'weekdays',(SELECT jsonb_agg(jsonb_build_object('day',(ARRAY['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])[weekday+1],'orders',orders,'revenueCents',amount) ORDER BY weekday) FROM weekdays)),
  'orderBumps',jsonb_build_object('items',(SELECT COALESCE(sum(quantity),0) FROM sold_items WHERE is_order_bump),'revenueCents',(SELECT COALESCE(sum(amount),0) FROM sold_items WHERE is_order_bump)),
  'gateways',(SELECT COALESCE(jsonb_agg(jsonb_build_object('provider',provider,'attempts',attempts,'paid',paid,'revenueCents',amount,'conversionRate',round(paid*100.0/NULLIF(attempts,0),2))),'[]'::jsonb) FROM gateways),
  'products',(SELECT COALESCE(jsonb_agg(jsonb_build_object('title',title,'quantity',quantity,'revenueCents',amount)),'[]'::jsonb) FROM product_sales),
  'geography',jsonb_build_object('locations',(SELECT COALESCE(jsonb_agg(jsonb_build_object('country',country,'region',region,'city',city,'latitude',latitude,'longitude',longitude,'visitors',visitors)),'[]'::jsonb) FROM (SELECT * FROM geo ORDER BY visitors DESC,country,region,city LIMIT 200) g),'countries',(SELECT count(DISTINCT country) FROM geo),'regions',(SELECT count(DISTINCT (country,region)) FROM geo WHERE region IS NOT NULL),'cities',(SELECT count(DISTINCT (country,region,city)) FROM geo WHERE city IS NOT NULL),'visitors',(SELECT count(DISTINCT visitor_key) FROM sessions WHERE tracking_parameters->>'geo_country' IS NOT NULL)),
  'salesGeography',jsonb_build_object('states',(SELECT COALESCE(jsonb_agg(jsonb_build_object('state',state,'orders',orders,'revenueCents',amount)),'[]'::jsonb) FROM (SELECT * FROM state_sales WHERE state IS NOT NULL ORDER BY amount DESC,state LIMIT 100) g),'cities',(SELECT COALESCE(jsonb_agg(jsonb_build_object('city',city,'state',state,'orders',orders,'revenueCents',amount)),'[]'::jsonb) FROM (SELECT * FROM city_sales WHERE state IS NOT NULL AND city IS NOT NULL ORDER BY amount DESC,state,city LIMIT 200) g))
 ),
 'checklist',jsonb_build_object('store',true,'product',EXISTS(SELECT 1 FROM products p,params a WHERE p.store_id=a.store_id AND p.active),'checkout',EXISTS(SELECT 1 FROM checkouts c,params a WHERE c.store_id=a.store_id AND c.archived_at IS NULL),'published',EXISTS(SELECT 1 FROM checkouts c,params a WHERE c.store_id=a.store_id AND c.archived_at IS NULL AND c.status='PUBLISHED'),'gateway',EXISTS(SELECT 1 FROM gateway_connections g,params a WHERE g.store_id=a.store_id AND g.active))
) payload FROM totals t CROSS JOIN revenue r`;
  const payload = rows[0]?.payload ?? {};
  const centroids: Record<string, [number, number]> = { BR: [-14.235,-51.9253], US: [37.0902,-95.7129], PT: [39.3999,-8.2245], AR: [-38.4161,-63.6167], CL: [-35.6751,-71.543], CO: [4.5709,-74.2973], MX: [23.6345,-102.5528], CA: [56.1304,-106.3468], GB: [55.3781,-3.436] };
  for (const location of payload.analytics?.geography?.locations ?? []) {
    const fallback = centroids[location.country.toUpperCase()];
    if (fallback) { location.latitude ??= fallback[0]; location.longitude ??= fallback[1]; }
  }
  return payload;
}
