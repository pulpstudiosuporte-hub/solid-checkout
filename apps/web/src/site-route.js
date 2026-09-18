export function isMarketingRoute({ hostname, pathname, hash }) {
  if (hash.startsWith('#/')) return false;
  if (pathname === '/site' || pathname === '/site/' || pathname === '/site.html') return true;
  return ['solidcheckout.xyz', 'www.solidcheckout.xyz', 'apirat.io', 'www.apirat.io'].includes(hostname) && pathname === '/';
}

export function marketingAccountUrl(hostname, mode) {
  const origin = ['apirat.io', 'www.apirat.io'].includes(hostname) ? 'https://app.apirat.io' : ['solidcheckout.xyz', 'www.solidcheckout.xyz'].includes(hostname) ? 'https://app.solidcheckout.xyz' : '';
  return `${origin}/#/${mode === 'cadastro' ? 'cadastro' : 'login'}`;
}
