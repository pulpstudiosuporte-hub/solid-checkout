import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Bug, CheckCircle2, Heart, Lightbulb, LoaderCircle, Plus, Rocket, Send, Sparkles, X } from 'lucide-react';
import { createProductFeedback, getPlatformContent, getProductFeedback, toggleProductFeedbackVote } from './api';

const fallbackReleases = [
  { date: '31 ago 2026', type: 'Novidade', category: 'Novidades', title: 'Catálogo de integrações renovado', description: 'Agora você encontra, pesquisa e gerencia Shopify, Meta Pixel, UTMify e Webhooks em uma central organizada.' },
  { date: '31 ago 2026', type: 'Melhoria', category: 'Melhorias', title: 'Busca avançada no painel', description: 'Use Ctrl K para encontrar páginas, recursos e ações por nome ou palavras relacionadas.' },
  { date: '31 ago 2026', type: 'Melhoria', category: 'Melhorias', title: 'Checkout responsivo e personalizável', description: 'Novos controles de visibilidade por dispositivo e melhorias de compatibilidade para checkouts publicados.' },
  { date: '30 ago 2026', type: 'Integração', category: 'Integrações', title: 'Webhooks duráveis por loja', description: 'Envie eventos de pedidos para sistemas externos com assinatura, tentativas e histórico de entrega.' },
  { date: '30 ago 2026', type: 'Segurança', category: 'Segurança', title: 'Proteções de conta ampliadas', description: 'Fluxos de recuperação, sessão protegida e verificações adicionais para ações sensíveis.' },
];
const categoryMap = { NEWS: ['Novidade', 'Novidades'], IMPROVEMENT: ['Melhoria', 'Melhorias'], FIX: ['Correção', 'Correções'], INTEGRATION: ['Integração', 'Integrações'], SECURITY: ['Segurança', 'Segurança'] };
const updateFilters = ['Todos', 'Novidades', 'Melhorias', 'Correções', 'Integrações', 'Segurança'];
const columns = [
  { id: 'BACKLOG', title: 'Backlog', description: 'Ideias da comunidade', tone: 'gray' },
  { id: 'PLANNED', title: 'Faremos', description: 'Priorizado para próximos ciclos', tone: 'orange' },
  { id: 'IN_PROGRESS', title: 'Estamos construindo', description: 'Em desenvolvimento pela equipe', tone: 'blue' },
  { id: 'DONE', title: 'Pronto', description: 'Já disponível na plataforma', tone: 'green' },
];
const platformRoadmap = [
  { publicId: 'platform-freight', status: 'PLANNED', type: 'SUGGESTION', title: 'Novas integrações de frete', description: 'Melhor Envio, Superfrete e Frenet no catálogo de integrações.', author: 'Equipe SOLID', votes: 0, voted: false, platform: true },
  { publicId: 'platform-gateways', status: 'IN_PROGRESS', type: 'SUGGESTION', title: 'Mais gateways de pagamento', description: 'Expansão dos meios de pagamento e adquirentes disponíveis.', author: 'Equipe SOLID', votes: 0, voted: false, platform: true },
  { publicId: 'platform-feedback', status: 'DONE', type: 'SUGGESTION', title: 'Novidades e roadmap', description: 'Área pública para acompanhar entregas, sugerir ideias e votar.', author: 'Equipe SOLID', votes: 0, voted: false, platform: true },
];

function ReleaseMedia({ item }) {
  if (item.videoUrl) {
    let embed = '';
    try { const url = new URL(item.videoUrl); const youtube = url.hostname.includes('youtu.be') ? url.pathname.slice(1) : url.hostname.includes('youtube.com') ? url.searchParams.get('v') : ''; const vimeo = url.hostname.includes('vimeo.com') ? url.pathname.split('/').filter(Boolean)[0] : ''; if (/^[\w-]{6,20}$/.test(youtube || '')) embed = `https://www.youtube-nocookie.com/embed/${youtube}`; else if (/^\d{5,12}$/.test(vimeo || '')) embed = `https://player.vimeo.com/video/${vimeo}`; } catch { /* validated by API */ }
    if (embed) return <div className="release-video"><iframe src={embed} title={`Vídeo: ${item.title}`} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen/></div>;
    return <video className="release-video" src={item.videoUrl} poster={item.imageUrl || undefined} controls preload="metadata">Seu navegador não consegue reproduzir este vídeo.</video>;
  }
  return item.imageUrl ? <img className="release-image" src={item.imageUrl} alt="" loading="lazy"/> : null;
}

function FeedbackDialog({ type, onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ title: '', description: '' });
  const submit = event => { event.preventDefault(); onSubmit({ ...form, type }); };
  return <div className="feedback-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}><form className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onSubmit={submit}><button className="feedback-close" type="button" onClick={onClose} disabled={busy} aria-label="Fechar"><X size={18}/></button><span className={type === 'BUG' ? 'bug' : ''}>{type === 'BUG' ? <Bug size={21}/> : <Lightbulb size={21}/>}</span><h2 id="feedback-title">{type === 'BUG' ? 'Reportar um problema' : 'Enviar uma sugestão'}</h2><p>{type === 'BUG' ? 'Conte o que aconteceu e como podemos reproduzir.' : 'Compartilhe uma ideia que melhoraria sua operação.'}</p><label>Título<input autoFocus maxLength="120" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder={type === 'BUG' ? 'Ex.: Filtro não atualiza os pedidos' : 'Ex.: Integração com novo gateway'} required/></label><label>Detalhes<textarea maxLength="2000" rows="6" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Explique o cenário, a necessidade e o resultado esperado..." required/></label><small>{form.description.length}/2000 caracteres</small><footer><button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary" disabled={busy || form.title.trim().length < 5 || form.description.trim().length < 10}>{busy ? <LoaderCircle className="spin" size={16}/> : <Send size={16}/>} {busy ? 'Enviando...' : 'Enviar'}</button></footer></form></div>;
}

export default function NewsRoadmapPage({ csrfToken }) {
  const [tab, setTab] = useState('updates'); const [filter, setFilter] = useState('Todos');
  const [publishedReleases, setPublishedReleases] = useState([]);
  const [feedback, setFeedback] = useState({ loading: true, items: [], error: '' }); const [dialog, setDialog] = useState(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = () => { const controller = new AbortController(); getProductFeedback(controller.signal).then(result => setFeedback({ loading: false, items: result.items || [], error: '' })).catch(error => { if (error.name !== 'AbortError') setFeedback({ loading: false, items: [], error: error.message }); }); return controller; };
  useEffect(() => { const controller = load(); return () => controller.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const controller = new AbortController(); getPlatformContent(controller.signal).then(result => setPublishedReleases((result.releases || []).map(item => ({ ...item, date: new Date(item.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }), type: categoryMap[item.category]?.[0] || 'Novidade', category: categoryMap[item.category]?.[1] || 'Novidades' })))).catch(() => {}); return () => controller.abort(); }, []);
  const submit = async input => { setBusy(true); setMessage(''); try { await createProductFeedback(input, csrfToken); setDialog(null); setTab('roadmap'); setMessage(input.type === 'BUG' ? 'Problema enviado para análise da equipe.' : 'Sugestão enviada para aprovação. Ela aparecerá no roadmap após a moderação.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } };
  const vote = async item => { if (item.platform) return; setFeedback(current => ({ ...current, items: current.items.map(entry => entry.publicId === item.publicId ? { ...entry, voted: !entry.voted, votes: entry.votes + (entry.voted ? -1 : 1) } : entry) })); try { const result = await toggleProductFeedbackVote(item.publicId, csrfToken); setFeedback(current => ({ ...current, items: current.items.map(entry => entry.publicId === item.publicId ? { ...entry, ...result } : entry) })); } catch (error) { setFeedback(current => ({ ...current, items: current.items.map(entry => entry.publicId === item.publicId ? item : entry), error: error.message })); } };
  const releases = publishedReleases.length ? publishedReleases : fallbackReleases;
  const visibleReleases = filter === 'Todos' ? releases : releases.filter(item => item.category === filter);
  const roadmapItems = useMemo(() => [...feedback.items, ...platformRoadmap], [feedback.items]);
  return <main className="page news-page"><div className="news-breadcrumb"><span>Início</span><ArrowRight size={13}/><b>Novidades</b></div><section className="news-heading"><div><h1>Novidades da SOLID</h1><p>{tab === 'updates' ? 'Histórico de lançamentos, melhorias e correções publicadas pela equipe.' : 'Vote nas ideias da comunidade e acompanhe o que estamos construindo.'}</p></div>{tab === 'roadmap' && <div><button className="secondary" onClick={() => setDialog('BUG')}><Bug size={16}/> Reportar problema</button><button className="primary" onClick={() => setDialog('SUGGESTION')}><Plus size={16}/> Enviar sugestão</button></div>}</section>
    <div className="news-tabs" role="tablist"><button role="tab" aria-selected={tab === 'updates'} className={tab === 'updates' ? 'active' : ''} onClick={() => setTab('updates')}>Atualizações</button><button role="tab" aria-selected={tab === 'roadmap'} className={tab === 'roadmap' ? 'active' : ''} onClick={() => setTab('roadmap')}>Roadmap</button></div>
    {message && <div className="news-message" role="status"><CheckCircle2 size={16}/>{message}</div>}{feedback.error && tab === 'roadmap' && <div className="news-message error" role="alert"><AlertCircle size={16}/>{feedback.error}</div>}
    {tab === 'updates' ? <><div className="release-filters">{updateFilters.map(name => <button className={filter === name ? 'active' : ''} key={name} onClick={() => setFilter(name)}>{name}</button>)}</div><div className="release-timeline"><h2>ATUALIZAÇÕES</h2>{visibleReleases.map(item => <article className="card release-card" key={item.publicId || item.title}><i/><div><span>{item.date}</span><em>{item.type}</em></div><h3>{item.title}</h3><p>{item.description}</p><ReleaseMedia item={item}/></article>)}</div></> : feedback.loading ? <div className="roadmap-loading"><LoaderCircle className="spin"/> Carregando ideias...</div> : <div className="roadmap-board">{columns.map(column => { const items = roadmapItems.filter(item => item.status === column.id); return <section className={`roadmap-column ${column.tone}`} key={column.id}><header><div><h2>{column.title}</h2><p>{column.description}</p></div><span>{items.length}</span></header>{column.id === 'BACKLOG' && <button className="roadmap-add" onClick={() => setDialog('SUGGESTION')}><Plus size={16}/> Adicionar ideia</button>}<div>{items.length ? items.map(item => <article className="roadmap-card" key={item.publicId}><div><span>{item.type === 'BUG' ? <Bug size={13}/> : <Sparkles size={13}/>} {item.type === 'BUG' ? 'Problema' : 'Sugestão'}</span></div><h3>{item.title}</h3><p>{item.description}</p><footer><small>{item.author}</small>{!item.platform && <button className={item.voted ? 'voted' : ''} onClick={() => vote(item)} aria-pressed={item.voted} aria-label={`${item.voted ? 'Remover voto de' : 'Votar em'} ${item.title}`}><Heart size={15} fill={item.voted ? 'currentColor' : 'none'}/>{item.votes}</button>}</footer></article>) : <div className="roadmap-empty"><Rocket size={21}/><span>Nenhum item nesta etapa</span></div>}</div></section>; })}</div>}
    {dialog && <FeedbackDialog type={dialog} onClose={() => setDialog(null)} onSubmit={submit} busy={busy}/>}
  </main>;
}
