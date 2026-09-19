import { docsAliases } from './docs-aliases';
export const docsOrigin = 'https://docs.apirat.io';

export function isDocsHost({ hostname = '' }) {
  return hostname.toLowerCase() === 'docs.apirat.io';
}

export function resolveDocsRoute({ hash = '', hostname = '', pathname = '/' }) {
  if (!/^#\/docs(?:\/|\?|$)/.test(hash)) {
    if (!isDocsHost({ hostname })) return null;
    // The dedicated public host never falls through to the authenticated app.
    return { slug: pathname === '/' && !hash ? '' : 'pagina-nao-encontrada', section: '' };
  }
  const [path, query = ''] = hash.slice(1).split('?');
  const slug = path.replace(/^\/docs\/?/, '').replace(/\/$/, '');
  return { slug: docsAliases[slug] || slug, section: docsAliases[slug] ? '' : new URLSearchParams(query).get('section') || '' };
}

export function docsHref(slug = '', section = '') {
  return `/#/docs${slug ? `/${encodeURIComponent(slug)}` : ''}${section ? `?section=${encodeURIComponent(section)}` : ''}`;
}
