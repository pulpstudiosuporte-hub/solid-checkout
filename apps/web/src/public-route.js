export function resolvePublicRoute({ pathname, hash }) {
  const session = hash.match(/^#\/session\/([A-Za-z0-9_-]{8,32})(?:\?|$)/);
  if (session) return { kind: 'session', sessionId: session[1], token: new URLSearchParams(hash.split('?')[1] || '').get('token') };
  const checkout = pathname.match(/^\/c\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/) || hash.match(/^#\/c\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  return checkout ? { kind: 'checkout', storeSlug: checkout[1], checkoutSlug: checkout[2] } : null;
}
