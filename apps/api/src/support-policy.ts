const reads = new Set([
  '/auth/session', '/stores', '/dashboard', '/products', '/products/:productId',
  '/orders', '/orders/:orderId', '/abandoned-carts', '/abandoned-carts/recovery-settings',
  '/checkouts', '/shipping-methods', '/coupons', '/payment-discounts/pix',
  '/settings', '/store-domain', '/store-webhooks', '/chromasense',
  '/platform-content', '/notifications', '/notifications/push/config', '/media/images',
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
  if (method === 'GET' || method === 'HEAD') return reads.has(route);
  if (method === 'POST' && route === '/stores/:storeId/select') return true;
  return mode === 'MAINTENANCE' && maintenance.has(`${method} ${route}`);
}
