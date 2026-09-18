// Keep session cookies same-site on the new panel without changing merchant checkouts.
export function resolveApiOrigin(hostname, configuredUrl) {
  if (hostname === 'app.apirat.io') return 'https://api.apirat.io';
  return (configuredUrl || 'http://127.0.0.1:3333').replace(/\/$/, '');
}
