import { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, Trash2, X } from 'lucide-react';
import './media-library.css';

export default function MediaLibrary({ services, onSelect, onClose }) {
  const dialog = useRef(null);
  const heading = useId();
  const [data, setData] = useState({ items: [], usedBytes: 0, quotaBytes: 1, nextCursor: null });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    let active = true;
    services.listImages().then(value => { if (active) setData(value); }).catch(cause => { if (active) setError(cause.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; node.close(); previous?.focus?.(); };
  }, [services]);
  async function more() {
    setBusy(true); setError('');
    try { const next = await services.listImages(data.nextCursor); setData(current => ({ ...next, items: [...current.items, ...next.items] })); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try {
      await services.deleteImage(removing);
      setData(current => ({ ...current, usedBytes: current.usedBytes - (current.items.find(item => item.filename === removing)?.sizeBytes || 0), items: current.items.filter(item => item.filename !== removing) }));
      setRemoving(null);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="media-library" aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><h2 id={heading}>Biblioteca de imagens</h2><p>Reutilize arquivos ou exclua imagens sem uso.</p></div><button type="button" aria-label="Fechar biblioteca" disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <p className="media-library-usage">{(data.usedBytes / 1048576).toFixed(1)} MB de {(data.quotaBytes / 1048576).toFixed(0)} MB utilizados</p>
    {error && <p role="alert" className="public-error">{error}</p>}
    {removing && <div className="media-library-confirm"><p>Excluir este arquivo da biblioteca? Imagens usadas em checkouts ou pedidos são protegidas.</p><button type="button" disabled={busy} onClick={() => void remove()}>Confirmar exclusão</button><button type="button" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</button></div>}
    <div className="media-library-grid" aria-busy={busy}>{data.items.map((item, index) => <article key={item.filename}>
      <button type="button" disabled={busy} aria-label={`Usar imagem ${index + 1}`} onClick={() => onSelect(item.imageUrl)}><img src={item.imageUrl} alt={`Imagem ${index + 1} da biblioteca`} loading="lazy" width="180" height="120"/></button>
      <footer><small>{Math.ceil(item.sizeBytes / 1024)} KB</small><button type="button" aria-label={`Excluir imagem ${index + 1}`} title={services.isImageInDraft?.(item.filename) ? 'Imagem usada no rascunho atual' : 'Excluir imagem sem uso'} disabled={busy || services.isImageInDraft?.(item.filename)} onClick={() => setRemoving(item.filename)}><Trash2 size={17}/></button></footer>
    </article>)}</div>
    {!busy && !data.items.length && <p>Suas imagens enviadas aparecerão aqui.</p>}
    {busy && <p role="status"><LoaderCircle size={18} className="spin"/> Carregando imagens…</p>}
    {data.nextCursor && <button className="secondary" type="button" disabled={busy} onClick={() => void more()}>Carregar mais imagens</button>}
  </dialog>;
}
