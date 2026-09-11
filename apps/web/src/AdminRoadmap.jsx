import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { createAdminFeedback, deleteAdminFeedback, updateAdminFeedback } from './api';
import './admin-roadmap.css';

const statuses = { BACKLOG: 'Aguardando', PLANNED: 'Planejado', IN_PROGRESS: 'Em andamento', DONE: 'Concluído' };
const blank = () => ({ title: '', description: '', type: 'SUGGESTION', status: 'BACKLOG', approved: false });
export default function AdminRoadmap({ items = [], csrfToken, onSaved }) {
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [filter, setFilter] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const titleRef = useRef(null);
  const mutation = useRef(false);
  const visible = useMemo(() => items.filter(item => (filter === 'ALL' || item.status === filter) && (visibility === 'ALL' || item.approved === (visibility === 'PUBLIC')) && `${item.title} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [items, filter, visibility, search]);
  const edit = item => {
    setError(''); setMessage('');
    setDraft(item ? { title: item.title, description: item.description, type: item.type, status: item.status, approved: item.approved } : blank());
    setEditor(item?.publicId || 'new');
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const run = async (callback, success, closeEditor = false) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await callback();
      if (closeEditor) { setEditor(null); setDraft(blank()); }
      setMessage(success);
      await onSaved();
    } catch (requestError) { setError(requestError.message); }
    finally { mutation.current = false; setBusy(false); }
  };
  const save = event => {
    event.preventDefault();
    void run(() => editor === 'new' ? createAdminFeedback(draft, csrfToken) : updateAdminFeedback(editor, draft, csrfToken), editor === 'new' ? 'Item criado no roadmap.' : 'Item do roadmap atualizado.', true);
  };
  return <section className="admin-roadmap" aria-label="Gestão do roadmap">
    <header className="admin-roadmap-heading"><div><h2>Roadmap e sugestões</h2><p>Organize as entregas da plataforma e escolha o que os lojistas podem acompanhar.</p></div><button type="button" className="primary" disabled={busy} onClick={() => edit(null)}><Plus size={17}/> Novo item</button></header>
    {message && <p className="news-message" role="status"><CheckCircle2 size={16}/>{message}</p>}
    {error && <p className="admin-users-error" role="alert">{error}</p>}
    {editor && <form className="card admin-content-form admin-roadmap-editor" onSubmit={save} aria-label={editor === 'new' ? 'Novo item do roadmap' : 'Editar item do roadmap'}>
      <h2>{editor === 'new' ? 'Novo item do roadmap' : 'Editar item do roadmap'}</h2>
      <fieldset disabled={busy}>
        <label>Título<input ref={titleRef} required minLength={5} maxLength={120} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}/></label>
        <label>Descrição<textarea required minLength={10} maxLength={2000} rows={4} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}/></label>
        <div className="admin-roadmap-fields"><label>Tipo<select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value }))}><option value="SUGGESTION">Melhoria / sugestão</option><option value="BUG">Correção de problema</option></select></label><label>Status do item<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <label className="admin-roadmap-publish"><input type="checkbox" checked={draft.approved} onChange={event => setDraft(current => ({ ...current, approved: event.target.checked }))}/><span>Visível para os lojistas</span></label><p>O status indica o progresso. A visibilidade decide se o item aparece no roadmap dos lojistas.</p>
        <div className="admin-roadmap-actions"><button className="primary" type="submit">{busy && <LoaderCircle size={16} className="spin"/>}{editor === 'new' ? 'Criar item' : 'Salvar alterações'}</button><button type="button" className="secondary" onClick={() => { setEditor(null); setError(''); }}>Cancelar</button></div>
      </fieldset>
    </form>}
    <div className="admin-roadmap-filters"><label>Buscar item<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Título ou descrição"/></label><label>Filtrar por status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="ALL">Todos os status</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label} ({items.filter(item => item.status === value).length})</option>)}</select></label><label>Visibilidade<select value={visibility} onChange={event => setVisibility(event.target.value)}><option value="ALL">Todos os itens</option><option value="PUBLIC">Publicados</option><option value="HIDDEN">Ocultos / aguardando aprovação</option></select></label></div>
    <p className="admin-roadmap-count">{visible.length} de {items.length} itens carregados</p>
    <div className="admin-feedback-grid">{visible.map(item => <article key={item.publicId} className={`card admin-feedback-card ${item.approved ? 'approved' : 'pending'}`}>
      <header><span>{item.type === 'BUG' ? 'Correção' : 'Melhoria / sugestão'}</span><b>{item.votes} votos</b></header>
      <div className={`admin-feedback-visibility ${item.approved ? 'approved' : 'pending'}`}>{item.approved ? <Eye size={14}/> : <EyeOff size={14}/>} {item.approved ? 'Publicado no roadmap' : 'Oculto para os lojistas'}</div>
      <h2>{item.title}</h2><p>{item.description}</p><small>{item.author} · {item.store}<br/>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</small>
      <label>Status de {item.title}<select disabled={busy || editor === item.publicId} value={item.status} onChange={event => void run(() => updateAdminFeedback(item.publicId, { status: event.target.value }, csrfToken), 'Status do roadmap atualizado.')}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="admin-feedback-actions"><button type="button" className="secondary" disabled={busy} onClick={() => edit(item)}><Pencil size={15}/> Editar</button><button type="button" className={item.approved ? 'secondary' : 'primary'} disabled={busy || editor === item.publicId} onClick={() => void run(() => updateAdminFeedback(item.publicId, { approved: !item.approved }, csrfToken), item.approved ? 'Item ocultado.' : 'Item publicado no roadmap.')}>{item.approved ? <EyeOff size={15}/> : <Eye size={15}/>} {item.approved ? 'Ocultar' : 'Publicar'}</button><button type="button" className="danger" disabled={busy || editor === item.publicId} onClick={() => { if (window.confirm(`Excluir definitivamente “${item.title}”? Esta ação não pode ser desfeita.`)) void run(() => deleteAdminFeedback(item.publicId, csrfToken), 'Item excluído.'); }}><Trash2 size={15}/> Excluir</button></div>
    </article>)}</div>
    {!visible.length && <div className="admin-content-empty"><b>{items.length ? 'Nenhum item corresponde aos filtros.' : 'Crie o primeiro item do roadmap.'}</b><p>{items.length ? 'Ajuste a busca, o status ou a visibilidade.' : 'Você também pode aprovar as sugestões recebidas dos lojistas.'}</p></div>}
  </section>;
}
