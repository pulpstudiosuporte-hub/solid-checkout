import { describe, expect, it } from 'vitest';
import { dashboardFeaturedRelease, dashboardNewsItems, normalizePlatformReleases, releaseVideoSource } from '../src/platform-content.js';

describe('conteúdo dinâmico da plataforma', () => {
  it('mantém a mídia em destaque quando chegam publicações só de texto', () => {
    const text = { title: 'Correção nova' };
    const image = { title: 'Imagem cadastrada', imageUrl: 'https://example.com/image.webp' };
    const video = { title: 'Vídeo cadastrado', videoUrl: 'https://example.com/video.mp4' };
    expect(dashboardFeaturedRelease([text, image, video])).toBe(image);
    expect(dashboardFeaturedRelease([text, video, image])).toBe(video);
    expect(dashboardFeaturedRelease([text])).toBe(text);
    expect(dashboardFeaturedRelease([])).toBeUndefined();
  });
  it('mantém listas vazias sem inventar publicações', () => {
    expect(normalizePlatformReleases([])).toEqual([]);
    expect(dashboardNewsItems([])).toEqual([]);
  });

  it('normaliza categorias e limita o resumo do painel', () => {
    const releases = Array.from({ length: 6 }, (_, index) => ({ publicId: `release-${index}`, title: `Novidade ${index}`, category: index ? 'FIX' : 'NEWS', publishedAt: '2026-08-31T12:00:00.000Z' }));
    expect(normalizePlatformReleases(releases)[0]).toMatchObject({ type: 'Novidade', category: 'Novidades' });
    expect(dashboardNewsItems(releases)).toHaveLength(4);
  });

  it('usa embeds privados e rejeita protocolos inseguros', () => {
    expect(releaseVideoSource('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
    expect(releaseVideoSource('https://vimeo.com/123456789')).toEqual({ kind: 'embed', url: 'https://player.vimeo.com/video/123456789' });
    expect(releaseVideoSource('http://example.com/video.mp4')).toEqual({ kind: 'invalid', url: '' });
  });
});
