import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Bug, CheckCircle2, Eye, EyeOff, FileVideo2, Image, Inbox, LoaderCircle, Megaphone, RefreshCw, Send, Sparkles, Trash2, Upload } from 'lucide-react';
import { createAdminRelease, deleteAdminFeedback, deleteAdminRelease, getAdminContent, saveAdminIntegrationAsset, sendAdminBroadcast, updateAdminFeedback, uploadProductImage } from './api';

const tabs = [['feedback', 'Feedback', Inbox], ['releases', 'Novidades', FileVideo2], ['integrations', 'Integrações', Image], ['notifications', 'Notificações', BellRing]];
const statusLabels = { BACKLOG: 'Backlog', PLANNED: 'Faremos', IN_PROGRESS: 'Em desenvolvimento', DONE: 'Pronto' };
const categoryLabels = { NEWS: 'Novidade', IMPROVEMENT: 'Melhoria', FIX: 'Correção', INTEGRATION: 'Integração', SECURITY: 'Segurança' };
const integrations = [['shopify','Shopify'],['woocommerce','WooCommerce'],['melhor-envio','Melhor Envio'],['superfrete','Superfrete'],['frenet','Frenet'],['whatsapp','WhatsApp'],['meta','Meta Pixel'],['utmify','UTMify'],['webhooks','Webhooks']];

function ImageField({ value, onChange, csrfToken, label = 'Imagem' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try { const result = await uploadProductImage(file, csrfToken); onChange(result.imageUrl); }
    catch (requestError) { setError(requestError.message); }
    finally { setUploading(false); event.target.value = ''; }
  };
  return <div className="admin-media-field">
    <span className="admin-media-label">{label}</span>
    <div className="admin-media-controls">
      <input aria-label={`${label} por URL`} value={value} onChange={event => onChange(event.target.value)} placeholder="https://..."/>
      <label className="admin-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/>{uploading ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>} Enviar</label>
    </div>
    {error && <small>{error}</small>}{value && <img src={value} alt="Prévia do arquivo enviado"/>}
  </div>;
}

function FeedbackCard({ item, busy, csrfToken, act }) {
  const toggleApproval = () => act(item.publicId, () => updateAdminFeedback(item.publicId, { approved: !item.approved }, csrfToken), item.approved ? 'Item ocultado do roadmap.' : 'Item aprovado e publicado no roadmap.');
  const remove = () => {
    if (window.confirm(`Excluir definitivamente “${item.title}”? Esta ação não pode ser desfeita.`)) void act(item.publicId, () => deleteAdminFeedback(item.publicId, csrfToken), 'Feedback excluído.');
  };
  return <article className={`card admin-feedback-card ${item.approved ? 'approved' : 'pending'}`}>
    <header>
      <span className={item.type === 'BUG' ? 'bug' : ''}>{item.type === 'BUG' ? <Bug size={14}/> : <Sparkles size={14}/>} {item.type === 'BUG' ? 'Problema' : 'Sugestão'}</span>
      <b>{item.votes} votos</b>
    </header>
    <div className={`admin-feedback-visibility ${item.approved ? 'approved' : 'pending'}`}>{item.approved ? <Eye size={13}/> : <EyeOff size={13}/>} {item.approved ? 'Publicado no roadmap' : 'Aguardando aprovação'}</div>
    <h2>{item.title}</h2><p>{item.description}</p>
    <small>{item.author} · {item.email}<br/>{item.store} · {new Date(item.createdAt).toLocaleDateString('pt-BR')}</small>
    <label>Status<select value={item.status} disabled={busy === item.publicId} onChange={event => void act(item.publicId, () => updateAdminFeedback(item.publicId, { status: event.target.value }, csrfToken), 'Status do roadmap atualizado.')}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="admin-feedback-actions">
      <button type="button" className={item.approved ? 'secondary' : 'primary'} disabled={busy === item.publicId} onClick={toggleApproval}>{busy === item.publicId ? <LoaderCircle className="spin" size={15}/> : item.approved ? <EyeOff size={15}/> : <CheckCircle2 size={15}/>} {item.approved ? 'Ocultar' : 'Aprovar'}</button>
      <button type="button" className="danger" disabled={busy === item.publicId} onClick={remove}><Trash2 size={15}/> Excluir</button>
    </div>
  </article>;
}

export default function AdminContentPage({ csrfToken }) {
  const [tab, setTab] = useState('feedback');
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  const [release, setRelease] = useState({ category: 'NEWS', title: '', description: '', imageUrl: '', videoUrl: '', published: true });
  const [asset, setAsset] = useState({ integrationKey: 'shopify', imageUrl: '', altText: '' });
  const [broadcast, setBroadcast] = useState({ title: '', message: '', destination: 'Novidades' });
  const load = async signal => {
    setState(current => ({ ...current, loading: true, error: '' }));
    try { const data = await getAdminContent(signal); setState({ loading: false, data, error: '' }); }
    catch (error) { if (error.name !== 'AbortError') setState(current => ({ ...current, loading: false, error: error.message })); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  const act = async (key, callback, success) => {
    setBusy(key); setMessage('');
    try { await callback(); setMessage(success); await load(); }
    catch (error) { setState(current => ({ ...current, error: error.message })); }
    finally { setBusy(''); }
  };
  const counts = useMemo(() => ({ feedback: state.data?.feedback?.length || 0, releases: state.data?.releases?.length || 0, integrations: state.data?.integrationAssets?.length || 0 }), [state.data]);
  const publish = async event => {
    event.preventDefault(); setBusy('release'); setMessage('');
    try { await createAdminRelease(release, csrfToken); setRelease({ category: 'NEWS', title: '', description: '', imageUrl: '', videoUrl: '', published: true }); await load(); setMessage('Novidade publicada.'); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  };
  const saveAsset = event => { event.preventDefault(); void act('asset', () => saveAdminIntegrationAsset(asset.integrationKey, asset, csrfToken), 'Imagem da integração atualizada.'); };
  const notify = event => { event.preventDefault(); void act('broadcast', () => sendAdminBroadcast(broadcast, csrfToken), 'Notificação enviada para todas as lojas ativas.'); };

  let content;
  if (state.loading && !state.data) content = <div className="admin-content-loading"><LoaderCircle className="spin"/> Carregando central...</div>;
  else if (tab === 'feedback') content = <section className="admin-feedback-grid">
    {state.data?.feedback?.map(item => <FeedbackCard key={item.publicId} item={item} busy={busy} csrfToken={csrfToken} act={act}/>)}
    {!state.data?.feedback?.length && <div className="admin-content-empty"><Inbox/><b>Nenhum feedback recebido</b></div>}
  </section>;
  else if (tab === 'releases') content = <div className="admin-content-split">
    <form className="card admin-content-form" onSubmit={publish}><h2>Publicar novidade</h2>
      <label>Categoria<select value={release.category} onChange={event => setRelease(current => ({ ...current, category: event.target.value }))}>{Object.entries(categoryLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Título<input value={release.title} maxLength="140" required onChange={event => setRelease(current => ({ ...current, title: event.target.value }))}/></label>
      <label>Descrição<textarea rows="5" maxLength="4000" required value={release.description} onChange={event => setRelease(current => ({ ...current, description: event.target.value }))}/></label>
      <ImageField value={release.imageUrl} onChange={imageUrl => setRelease(current => ({ ...current, imageUrl }))} csrfToken={csrfToken}/>
      <label>Vídeo (YouTube, Vimeo ou arquivo HTTPS)<input type="url" value={release.videoUrl} onChange={event => setRelease(current => ({ ...current, videoUrl: event.target.value }))} placeholder="https://..."/></label>
      <button className="primary" disabled={busy === 'release'}>{busy === 'release' ? <LoaderCircle className="spin"/> : <Megaphone/>} Publicar</button>
    </form>
    <section className="admin-release-list">{state.data?.releases?.map(item => <article className="card" key={item.publicId}>{item.imageUrl && <img src={item.imageUrl} alt=""/>}<div><span>{categoryLabels[item.category]}</span><h3>{item.title}</h3><p>{item.description}</p>{item.videoUrl && <a href={item.videoUrl} target="_blank" rel="noreferrer"><FileVideo2 size={14}/> Abrir vídeo</a>}</div><button aria-label={`Excluir ${item.title}`} onClick={() => window.confirm('Excluir esta publicação?') && void act(item.publicId, () => deleteAdminRelease(item.publicId, csrfToken), 'Publicação excluída.')}><Trash2 size={16}/></button></article>)}</section>
  </div>;
  else if (tab === 'integrations') content = <div className="admin-content-split">
    <form className="card admin-content-form" onSubmit={saveAsset}><h2>Imagem da integração</h2>
      <label>Integração<select value={asset.integrationKey} onChange={event => { const integrationKey = event.target.value; const current = state.data?.integrationAssets?.find(item => item.integrationKey === integrationKey); setAsset({ integrationKey, imageUrl: current?.imageUrl || '', altText: current?.altText || '' }); }}>{integrations.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <ImageField value={asset.imageUrl} onChange={imageUrl => setAsset(current => ({ ...current, imageUrl }))} csrfToken={csrfToken} label="Logo ou imagem"/>
      <label>Texto alternativo<input value={asset.altText} maxLength="160" onChange={event => setAsset(current => ({ ...current, altText: event.target.value }))} placeholder="Ex.: Logotipo Shopify"/></label>
      <button className="primary" disabled={busy === 'asset'}>{busy === 'asset' ? <LoaderCircle className="spin"/> : <Image/>} Salvar imagem</button>
    </form>
    <section className="card admin-assets-list"><h2>Imagens configuradas</h2>{integrations.map(([id,name]) => { const current = state.data?.integrationAssets?.find(item => item.integrationKey === id); return <button key={id} onClick={() => setAsset({ integrationKey: id, imageUrl: current?.imageUrl || '', altText: current?.altText || '' })}>{current ? <img src={current.imageUrl} alt={current.altText}/> : <span><Image size={18}/></span>}<b>{name}</b><small>{current ? 'Configurada' : 'Usando ícone padrão'}</small></button>; })}</section>
  </div>;
  else content = <form className="card admin-content-form admin-broadcast-form" onSubmit={notify}><span className="admin-broadcast-icon"><BellRing/></span><h2>Enviar notificação</h2><p>O aviso aparecerá no sino de todas as lojas ativas.</p><label>Título<input value={broadcast.title} maxLength="120" required onChange={event => setBroadcast(current => ({ ...current, title: event.target.value }))}/></label><label>Mensagem<textarea rows="4" maxLength="300" required value={broadcast.message} onChange={event => setBroadcast(current => ({ ...current, message: event.target.value }))}/></label><label>Destino ao clicar<select value={broadcast.destination} onChange={event => setBroadcast(current => ({ ...current, destination: event.target.value }))}>{['Novidades','Início','Análises','Pedidos','Carrinhos','Produtos','Integrações','Webhooks'].map(value => <option key={value}>{value}</option>)}</select></label><button className="primary" disabled={busy === 'broadcast'}>{busy === 'broadcast' ? <LoaderCircle className="spin"/> : <Send/>} Enviar para todas as lojas</button></form>;

  return <main className="page admin-content-page">
    <section className="page-title"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Conteúdo da plataforma</h1><p>Gerencie feedback, publicações, imagens e avisos para os lojistas.</p></div><button className="secondary" onClick={() => load()} disabled={state.loading}><RefreshCw className={state.loading ? 'spin' : ''} size={17}/> Atualizar</button></section>
    <nav className="admin-content-tabs" aria-label="Seções de conteúdo">{tabs.map(([id,label,Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={17}/><span>{label}</span>{counts[id] > 0 && <em>{counts[id]}</em>}</button>)}</nav>
    {state.error && <div className="admin-users-error" role="alert">{state.error}</div>}{message && <div className="news-message" role="status"><CheckCircle2 size={16}/>{message}</div>}
    {content}
  </main>;
}
