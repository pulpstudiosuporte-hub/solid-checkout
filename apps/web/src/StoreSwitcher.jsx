import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Plus, Store, X } from 'lucide-react';

const initials = name => name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';

export default function StoreSwitcher({ stores, onSelect, onCreate, busy }) {
  const [open, setOpen] = useState(false); const [creating, setCreating] = useState(false); const [name, setName] = useState(''); const [error, setError] = useState('');
  const triggerRef = useRef(null); const modalRef = useRef(null);
  const activeStore = stores.find(store => store.active) || stores[0];
  const closeCreate = () => { setCreating(false); requestAnimationFrame(() => triggerRef.current?.focus()); };
  useEffect(() => { if (!creating) return; const handleKey = event => { if (event.key === 'Escape') return closeCreate(); if (event.key !== 'Tab') return; const focusable = [...(modalRef.current?.querySelectorAll('button:not(:disabled),input:not(:disabled)') || [])]; if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, [creating]);

  async function submit(event) {
    event.preventDefault(); setError('');
    if (name.trim().length < 3) return setError('Informe pelo menos 3 caracteres.');
    try { await onCreate(name.trim()); setName(''); setCreating(false); setOpen(false); }
    catch (requestError) { setError(requestError?.code === 'STORE_LIMIT_REACHED' ? 'O limite de lojas foi atingido.' : 'Não foi possível criar a loja.'); }
  }

  return <div className="store-switcher">
    <button ref={triggerRef} className="store-switch" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="listbox"><span className="store-avatar">{initials(activeStore?.name)}</span><span><b>{activeStore?.name || 'Carregando lojas'}</b><small>{activeStore?.slug || 'Aguarde...'}</small></span><ChevronDown size={16}/></button>
    {open && <><button className="store-menu-backdrop" onClick={() => setOpen(false)} aria-label="Fechar seletor de lojas"/><div className="store-menu" role="listbox" aria-label="Selecionar loja">
      <div className="store-menu-title"><b>Suas lojas</b><small>{stores.length} de 20</small></div>
      <div className="store-list">{stores.map(store => <button key={store.publicId} role="option" aria-selected={store.active} disabled={busy || store.active} onClick={async () => { await onSelect(store.publicId); setOpen(false); }}><span className="store-avatar">{initials(store.name)}</span><span><b>{store.name}</b><small>{store.slug}</small></span>{store.active ? <Check size={17}/> : busy ? <LoaderCircle className="spin" size={16}/> : null}</button>)}</div>
      <button className="create-store-trigger" onClick={() => setCreating(true)}><span><Plus size={17}/></span> Criar nova loja</button>
    </div></>}
    {creating && <div className="modal-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && closeCreate()}><section ref={modalRef} className="store-modal" role="dialog" aria-modal="true" aria-labelledby="create-store-title"><button className="modal-close" onClick={closeCreate} aria-label="Fechar"><X size={19}/></button><div className="store-modal-head"><span><Store size={21}/></span><div><h2 id="create-store-title">Criar nova loja</h2><p>Escolha um nome para identificar sua operação.</p></div></div><form onSubmit={submit}><label htmlFor="store-name">Nome da loja</label><input id="store-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Minha Loja Incrível" maxLength={120} autoFocus disabled={busy}/><small>Use entre 3 e 120 caracteres.</small>{error && <p className="store-form-error" role="alert">{error}</p>}<div className="store-modal-actions"><button type="button" className="secondary" onClick={closeCreate}>Cancelar</button><button type="submit" className="primary" disabled={busy || name.trim().length < 3}>{busy ? <><LoaderCircle className="spin" size={17}/> Criando...</> : 'Criar loja'}</button></div></form></section></div>}
  </div>;
}
