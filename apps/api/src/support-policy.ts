const reads = new Set([
  '/auth/session', '/stores', '/dashboard', '/products', '/products/:productId',
  '/orders', '/orders/:orderId', '/abandoned-carts', '/abandoned-carts/recovery-settings',
  '/checkouts', '/shipping-methods', '/coupons', '/payment-discounts/pix',
  '/settings', '/store-domain', '/store-webhooks', '/chromasense',
  '/platform-content', '/notifications', '/notifications/push/config', '/media/images',
  '/orders/:orderId/payment-receipts', '/orders/:orderId/payment-receipts/:paymentId',
]);

const fullReads = new Set([
  '/billing', '/billing/pix/:invoiceId', '/product-feedback',
  '/integrations/shopify/status', '/integrations/westpay/status', '/integrations/roas/status',
  '/integrations/utmify/status', '/integrations/meta/status', '/integrations/diagnostics',
  '/integrations/google',
]);
const fullWrites = new Set([
  'PATCH /settings', 'POST /stores', 'DELETE /stores/:storeId',
  'PUT /store-domain', 'POST /store-domain/:domainId/verify', 'DELETE /store-domain/:domainId',
  'POST /store-webhooks', 'PATCH /store-webhooks/:id', 'DELETE /store-webhooks/:id', 'POST /store-webhooks/:id/test',
  'PATCH /orders/:orderId/status', 'PUT /orders/:orderId/tracking', 'POST /orders/:orderId/block-visitor',
  'PUT /abandoned-carts/recovery-settings', 'DELETE /media/images/:filename',
  'PUT /integrations/westpay', 'PUT /integrations/roas', 'PUT /integrations/gateways/primary',
  'DELETE /integrations/gateways/:provider', 'PUT /integrations/utmify', 'DELETE /integrations/utmify',
  'PUT /integrations/meta', 'DELETE /integrations/meta',
  'PUT /integrations/google', 'DELETE /integrations/google',
  'POST /integrations/shopify/connect-credentials', 'DELETE /integrations/shopify', 'POST /integrations/shopify/sync',
  'POST /billing/pix', 'POST /billing/checkout', 'POST /billing/portal',
  'POST /notifications/read', 'POST /product-feedback', 'POST /product-feedback/:feedbackId/vote',
]);
const maintenance = new Set([
  'POST /products', 'DELETE /products/:productId',
  'POST /checkouts', 'PATCH /checkouts/:checkoutId/draft', 'POST /checkouts/:checkoutId/publish', 'DELETE /checkouts/:checkoutId',
  'POST /shipping-methods', 'PUT /shipping-methods/:methodId', 'DELETE /shipping-methods/:methodId',
  'POST /coupons', 'PUT /coupons/:couponId', 'DELETE /coupons/:couponId',
  'PUT /payment-discounts/pix', 'POST /media/images',
]);

// Match registered route templates, never prefixes of a user-controlled URL.
export function supportRequestAllowed(method: string, route: string, mode: string): boolean {
  if (!['READ_ONLY', 'MAINTENANCE', 'FULL_ACCESS'].includes(mode)) return false;
  if (method === 'GET' || method === 'HEAD') return reads.has(route) || (mode === 'FULL_ACCESS' && fullReads.has(route));
  if (method === 'POST' && route === '/stores/:storeId/select') return true;
  return (mode === 'MAINTENANCE' || mode === 'FULL_ACCESS') && (maintenance.has(`${method} ${route}`) || (mode === 'FULL_ACCESS' && fullWrites.has(`${method} ${route}`)));
}
