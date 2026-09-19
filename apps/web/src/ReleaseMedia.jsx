import { releaseVideoSource } from './platform-content';

export default function ReleaseMedia({ item }) {
  if (item.videoUrl) {
    const source = releaseVideoSource(item.videoUrl);
    if (source.kind === 'embed') return <div className="release-video"><iframe src={source.url} title={`Vídeo: ${item.title}`} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen/></div>;
    if (source.kind === 'media') return <video className="release-video" aria-label={`Vídeo: ${item.title}`} src={source.url} poster={item.imageUrl || undefined} controls playsInline preload="metadata">Seu navegador não consegue reproduzir este vídeo.</video>;
  }
  return item.imageUrl ? <img className="release-image" src={item.imageUrl} alt={item.title} loading="lazy"/> : null;
}
