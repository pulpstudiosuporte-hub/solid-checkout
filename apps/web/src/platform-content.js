export const releaseCategoryMap = { NEWS: ['Novidade', 'Novidades'], IMPROVEMENT: ['Melhoria', 'Melhorias'], FIX: ['Correção', 'Correções'], INTEGRATION: ['Integração', 'Integrações'], SECURITY: ['Segurança', 'Segurança'] };

export function normalizePlatformReleases(items = []) {
  return items.map(item => ({
    ...item,
    date: new Date(item.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    type: releaseCategoryMap[item.category]?.[0] || 'Novidade',
    category: releaseCategoryMap[item.category]?.[1] || 'Novidades',
  }));
}

export function dashboardNewsItems(items = [], limit = 4) {
  return items.slice(0, limit).map(item => [item.publicId, item.title, new Date(item.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })]);
}

export function releaseVideoSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return { kind: 'invalid', url: '' };
    const youtube = url.hostname === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'www.youtube.com'].includes(url.hostname) ? url.searchParams.get('v') : '';
    const vimeo = ['vimeo.com', 'www.vimeo.com'].includes(url.hostname) ? url.pathname.split('/').filter(Boolean)[0] : '';
    if (/^[\w-]{6,20}$/.test(youtube || '')) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${youtube}` };
    if (/^\d{5,12}$/.test(vimeo || '')) return { kind: 'embed', url: `https://player.vimeo.com/video/${vimeo}` };
    return { kind: 'media', url: url.toString() };
  } catch {
    return { kind: 'invalid', url: '' };
  }
}
