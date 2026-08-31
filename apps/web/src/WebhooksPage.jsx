import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, EllipsisVertical, ExternalLink, Link2, LoaderCircle, Plus, Send, Trash2, Webhook, X } from 'lucide-react';
import { createStoreWebhook, deleteStoreWebhook, getStoreWebhooks, testStoreWebhook, updateStoreWebhook } from './api';
import './webhooks-page.css';
import './webhooks-accessibility.css';

const eventOptions = [['order.created', 'Pedido criado', 'Quando um novo Pix é gerado'], ['order.paid', 'Pedido pago', 'Quando o pagamento é confirmado'], ['order.cancelled', 'Pedido cancelado', 'Quando um pedido é cancelado'], ['order.refunded', 'Pedido estornado', 'Quando um pagamento é reembolsado'], ['payment.failed', 'Pagamento falhou', 'Quando uma tentativa de pagamento falha']];
const blank = { name: '', description: '', url: '', secret: '', active: true, events: [] };
const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useDialogFocus(ref, onClose) {
  const previous = useRef(null);
  useEffect(() => {
    previous.current = document.activeElement;
    const elements = () => [...(ref.current?.querySelectorAll(focusable) ?? [])];
    elements()[0]?.focus();
    const key = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = elements(); if (!items.length) return;
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous.current?.focus?.(); };
  }, [onClose, ref]);
}

function Dialog({ initial, onClose, onSaved, csrfToken }) {
  const ref = useRef(null); useDialogFocus(ref, onClose);
  const [form, setForm] = useState(initial ? { ...initial, secret: '' } : blank);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [revealed, setRevealed] = useState('');
  const toggle = event => setForm(value => ({ ...value, events: value.events.includes(event) ? value.events.filter(item => item !== event) : [...value.events, event] }));
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { const result = initial ? await updateStoreWebhook(initial.publicId, form, csrfToken) : await createStoreWebhook(form, csrfToken); if (result.secret) { setRevealed(result.secret); setBusy(false); } else onSaved(); } catch (cause) { setError(cause.message); setBusy(false); } };
  return <div className="webhook-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}><section ref={ref} className="webhook-dialog" role="dialog" aria-modal="true" aria-labelledby="webhook-dialog-title">
    <header><div><h2 id="webhook-dialog-title">{initial ? 'Editar webhook' : 'Novo webhook'}</h2><p>Receba notificações em tempo real dos eventos da sua loja.</p></div><label className="webhook-active"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })}/><i/><span>Ativo</span></label><button type="button" onClick={onClose} aria-label="Fechar"><X/></button></header>
    {revealed ? <div className="webhook-secret"><Check/><h3>Webhook criado</h3><p>Copie a chave secreta agora. Ela não será exibida novamente.</p><code>{revealed}</code><button className="secondary" onClick={() => navigator.clipboard.writeText(revealed)}><Copy size={16}/> Copiar chave</button><button className="primary" onClick={onSaved}>Concluir</button></div> : <form onSubmit={submit}>
      <fieldset><legend>Identificação</legend><p>Nome e descrição para organizar seus webhooks.</p><div className="webhook-two"><label>Nome<input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Integração ERP" required maxLength="120"/></label><label>Descrição<input value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Opcional" maxLength="240"/></label></div></fieldset>
      <fieldset><legend>Endpoint</legend><p>URL pública de destino e chave para validar as requisições.</p><label>URL do webhook<div className="webhook-url"><Link2 size={17}/><input type="url" value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} placeholder="https://api.sualoja.com/webhooks" required/></div></label>{!initial && <label>Chave secreta<input value={form.secret} onChange={event => setForm({ ...form, secret: event.target.value })} placeholder="Opcional — gerada automaticamente" minLength="16"/></label>}</fieldset>
      <fieldset><legend>Eventos <span>{form.events.length} selecionados</span></legend><p>Escolha quais notificações este webhook deve receber.</p><div className="webhook-events">{eventOptions.map(([id, title, description]) => <label key={id}><input type="checkbox" checked={form.events.includes(id)} onChange={() => toggle(id)}/><i/><span><b>{title}</b><small>{description}</small></span></label>)}</div></fieldset>
      {error && <p className="webhook-error" role="alert">{error}</p>}<footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy || !form.name.trim() || !form.url || !form.events.length}>{busy ? <LoaderCircle className="spin"/> : 'Salvar webhook'}</button></footer>
    </form>}
  </section></div>;
}

function ConfirmDelete({ item, busy, onClose, onConfirm }) {
  const ref = useRef(null); useDialogFocus(ref, onClose);
  return <div className="webhook-overlay"><section ref={ref} className="webhook-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-webhook-title"><h2 id="delete-webhook-title">Excluir webhook?</h2><p>O endpoint <b>{item.name}</b> deixará de receber novos eventos. O histórico também será removido.</p><div><button className="secondary" onClick={onClose}>Cancelar</button><button className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? 'Excluindo...' : 'Excluir webhook'}</button></div></section></div>;
}

export default function WebhooksPage({ storeKey, csrfToken }) {
  const [data, setData] = useState({ loading: true, error: '', items: [], writable: false }); const [editing, setEditing] = useState(null); const [menu, setMenu] = useState(null); const [testing, setTesting] = useState(''); const [deleting, setDeleting] = useState(null); const [deleteBusy, setDeleteBusy] = useState(false); const [notice, setNotice] = useState(null);
  const load = () => { const controller = new AbortController(); setData(value => ({ ...value, loading: true, error: '' })); getStoreWebhooks(controller.signal).then(value => setData({ loading: false, error: '', ...value })).catch(error => error.name !== 'AbortError' && setData(value => ({ ...value, loading: false, error: error.message }))); return controller; };
  useEffect(() => { const controller = load(); return () => controller.abort(); }, [storeKey]);
  useEffect(() => { if (!menu) return; const close = event => { if (event.key === 'Escape' || !event.target.closest?.('.webhook-card')) setMenu(null); }; document.addEventListener('keydown', close); document.addEventListener('pointerdown', close); return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); }; }, [menu]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(timer); }, [notice]);
  const remove = async () => { setDeleteBusy(true); try { await deleteStoreWebhook(deleting.publicId, csrfToken); setDeleting(null); setMenu(null); setNotice({ ok: true, text: 'Webhook excluído.' }); load(); } catch (error) { setNotice({ ok: false, text: error.message }); } finally { setDeleteBusy(false); } };
  const test = async item => { setTesting(item.publicId); setMenu(null); try { const result = await testStoreWebhook(item.publicId, item.events[0] || 'order.created', csrfToken); setNotice({ ok: result.success, text: result.success ? `Teste entregue com sucesso (HTTP ${result.statusCode}).` : `O endpoint respondeu HTTP ${result.statusCode}.` }); load(); } catch (error) { setNotice({ ok: false, text: error.message }); } finally { setTesting(''); } };
  return <main className="page webhooks-page"><div className="webhook-breadcrumb">Sistema <span>›</span> Webhooks</div><section className="page-title"><div><h1>Webhooks</h1><p>Receba notificações em tempo real sobre eventos da sua loja.</p></div>{data.writable && <button className="primary" onClick={() => setEditing({})}><Plus/> Novo webhook</button>}</section>
    {notice && <div className={`webhook-notice ${notice.ok ? 'ok' : 'error'}`} role="status">{notice.text}<button aria-label="Fechar aviso" onClick={() => setNotice(null)}><X size={16}/></button></div>}
    {data.loading ? <div className="webhook-state"><LoaderCircle className="spin"/> Carregando webhooks...</div> : data.error ? <div className="webhook-state error">{data.error}<button className="secondary" onClick={load}>Tentar novamente</button></div> : !data.items.length ? <div className="card webhook-empty"><Webhook/><h2>Nenhum webhook configurado</h2><p>Conecte seu ERP, automação ou sistema interno aos eventos da SOLID.</p>{data.writable && <button className="primary" onClick={() => setEditing({})}><Plus/> Criar primeiro webhook</button>}</div> : <div className="webhook-grid">{data.items.map(item => <article className="card webhook-card" key={item.publicId}><header><h2>{item.name}</h2><span className={item.active ? 'active' : 'inactive'}>{item.active ? 'Ativo' : 'Inativo'}</span><button aria-label={`Ações de ${item.name}`} aria-haspopup="menu" aria-expanded={menu === item.publicId} onClick={event => { event.stopPropagation(); setMenu(menu === item.publicId ? null : item.publicId); }}><EllipsisVertical/></button>{menu === item.publicId && <div className="webhook-menu" role="menu"><button role="menuitem" onClick={() => setEditing(item)}>Editar</button><button role="menuitem" onClick={() => test(item)} disabled={testing === item.publicId}>{testing === item.publicId ? 'Enviando...' : 'Enviar teste'}</button><button role="menuitem" className="danger" onClick={() => setDeleting(item)}><Trash2/> Excluir</button></div>}</header><a href={item.url} target="_blank" rel="noreferrer"><Link2/>{item.url}<ExternalLink/></a>{item.description && <p>{item.description}</p>}<div className="webhook-tags">{item.events.map(event => <span key={event}>{eventOptions.find(option => option[0] === event)?.[1] || event}</span>)}</div><footer><span>{item._count.deliveries} envios</span>{item.deliveries[0] && <span className={item.deliveries[0].success ? 'ok' : 'fail'}>{item.deliveries[0].success ? 'Último envio entregue' : item.deliveries[0].status === 'PENDING' ? 'Envio agendado' : 'Último envio falhou'}</span>}<button onClick={() => test(item)} disabled={testing === item.publicId} aria-label="Enviar teste"><Send/></button></footer></article>)}</div>}
    {editing && <Dialog initial={editing.publicId ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice({ ok: true, text: 'Webhook salvo.' }); load(); }} csrfToken={csrfToken}/>} {deleting && <ConfirmDelete item={deleting} busy={deleteBusy} onClose={() => setDeleting(null)} onConfirm={remove}/>} </main>;
}
