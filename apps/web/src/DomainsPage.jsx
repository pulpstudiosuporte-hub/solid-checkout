import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Globe2, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { deleteStoreDomain, getStoreDomain, saveStoreDomain, verifyStoreDomain } from './api';

function copy(value) { return navigator.clipboard?.writeText(value); }

export default function DomainsPage({ csrfToken }) {
  const [state, setState] = useState({ loading: true, domain: null, cnameTarget: 'pay.solidcheckout.xyz', error: '', notice: '' });
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState(false);
  const verifyingRef = useRef(false);

  const load = async () => {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const result = await getStoreDomain();
      setHostname(result.domain?.hostname || '');
      setState({ loading: false, domain: result.domain, cnameTarget: result.cnameTarget, error: '', notice: '' });
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: error.message || 'Não foi possível carregar os domínios.' }));
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const result = await saveStoreDomain(hostname, csrfToken);
      setHostname(result.domain.hostname);
      setState(current => ({ ...current, domain: result.domain, cnameTarget: result.cnameTarget, error: '', notice: 'Domínio salvo. Crie o CNAME indicado abaixo; a validação será repetida automaticamente.' }));
    } catch (error) {
      setState(current => ({ ...current, error: error.message || 'Não foi possível salvar o domínio.', notice: '' }));
    } finally { setBusy(false); }
  };

  const verify = async ({ silent = false } = {}) => {
    if (!state.domain || verifyingRef.current) return;
    verifyingRef.current = true;
    if (!silent) setBusy(true);
    try {
      const result = await verifyStoreDomain(state.domain.publicId, csrfToken);
      setState(current => ({
        ...current,
        domain: result.domain,
        cnameTarget: result.cnameTarget,
        error: result.verified || silent ? '' : `CNAME ainda não encontrado. No provedor do domínio, aponte ${current.domain?.hostname || hostname} para ${result.cnameTarget}.`,
        notice: result.verified ? 'DNS validado e domínio conectado com sucesso.' : current.notice,
      }));
    } catch (error) {
      if (!silent) setState(current => ({ ...current, error: error.message || 'Não foi possível verificar o DNS.', notice: '' }));
    } finally {
      verifyingRef.current = false;
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    if (!state.domain || state.domain.status === 'ACTIVE' || !csrfToken) return undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || attempts >= 20) return;
      attempts += 1;
      void verify({ silent: true });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [state.domain?.publicId, state.domain?.status, csrfToken]);

  const remove = async () => {
    if (!state.domain || !window.confirm(`Remover ${state.domain.hostname}? O DNS no seu provedor não será alterado.`)) return;
    setBusy(true);
    try {
      await deleteStoreDomain(state.domain.publicId, csrfToken);
      setHostname('');
      setState(current => ({ ...current, domain: null, error: '', notice: 'Domínio removido da loja.' }));
    } catch (error) {
      setState(current => ({ ...current, error: error.message || 'Não foi possível remover o domínio.' }));
    } finally { setBusy(false); }
  };

  const active = state.domain?.status === 'ACTIVE';
  const verified = active || state.domain?.status === 'VERIFIED_DNS';
  const recordName = state.domain?.hostname.split('.').slice(0, -2).join('.') || '';

  return <main className="page domains-page">
    <section className="page-title"><div><p className="eyebrow">CHECKOUT</p><h1>Domínios</h1><p>Use um subdomínio próprio para transmitir mais confiança no seu checkout.</p></div></section>
    {state.error && <p className="public-error" role="alert">{state.error}</p>}
    {state.notice && <p className="domain-notice"><CheckCircle2 size={16}/>{state.notice}</p>}
    <div className="domains-layout">
      <section className="card domain-form-card">
        <div className="domain-card-heading"><span><Globe2 size={22}/></span><div><h2>Seu domínio de checkout</h2><p>Incluído no MVP: 1 domínio ativo por loja.</p></div></div>
        <form onSubmit={save}>
          <label>Subdomínio<input value={hostname} onChange={event => setHostname(event.target.value)} placeholder="checkout.sualoja.com" inputMode="url" required disabled={busy}/></label>
          <small>Use apenas o domínio, sem <b>https://</b> ou caminhos.</small>
          <button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Globe2 size={17}/>} {state.domain ? 'Salvar alteração' : 'Adicionar domínio'}</button>
        </form>
        {state.domain && <div className={`domain-status ${verified ? 'verified' : ''}`}>
          <span>{verified ? <CheckCircle2 size={18}/> : <RefreshCw className="spin-slow" size={18}/>}</span>
          <div><b>{active ? 'Domínio ativo e protegido' : verified ? 'DNS validado, ativando checkout' : 'Aguardando o CNAME no seu provedor'}</b><small>{active ? state.domain.hostname : `${state.domain.hostname} → ${state.cnameTarget}`}</small></div>
          <button className="icon-btn danger-icon" type="button" aria-label="Remover domínio" title="Remover domínio" onClick={() => void remove()} disabled={busy}><Trash2 size={17}/></button>
        </div>}
      </section>
      <aside className="card domain-security"><span><ShieldCheck size={23}/></span><h2>Conexão segura</h2><p>O endereço só é aceito depois que apontar para a infraestrutura da SOLID.</p><ul><li>Salvar aqui não altera o DNS no provedor do domínio</li><li>SSL é emitido automaticamente após a validação</li><li>O checkout continua com preço validado pela API</li></ul></aside>
    </div>
    {state.domain && <section className="card dns-instructions">
      <div><p className="eyebrow">AÇÃO NECESSÁRIA</p><h2>Crie este CNAME no provedor do domínio</h2><p>A SOLID verificará automaticamente a cada 15 segundos. Não use registro A e remova qualquer registro A/AAAA existente com o mesmo nome.</p></div>
      <div className="dns-record"><span>CNAME</span><code>{recordName}</code><code>{state.cnameTarget}</code><button className="icon-btn" type="button" onClick={() => void copy(state.cnameTarget)} aria-label="Copiar destino"><Copy size={16}/></button></div>
      <div className="domain-actions">
        <button className="secondary" type="button" onClick={() => void verify()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <RefreshCw size={17}/>} Verificar agora</button>
        {!active && <small className="dns-auto-check">Verificação automática ativa enquanto esta tela estiver aberta.</small>}
        {active && <div className="domain-ready"><CheckCircle2 size={17}/><span><b>Checkout ativo</b><small>O endereço foi conectado e o certificado SSL está sendo emitido automaticamente.</small></span><a href={`https://${state.domain.hostname}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Abrir checkout</a></div>}
      </div>
    </section>}
    <section className="domain-help"><h2>Como funciona?</h2><ol><li>Escolha um endereço como <b>checkout.sualoja.com</b>.</li><li>No provedor do domínio, crie o CNAME apontando para <b>pay.solidcheckout.xyz</b>.</li><li>A SOLID detecta o registro, conecta o domínio à aplicação e solicita o SSL automaticamente.</li></ol></section>
  </main>;
}
