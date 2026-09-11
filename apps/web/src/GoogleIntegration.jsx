import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, CheckCircle2, LoaderCircle, Megaphone, ShieldCheck, Tags, Unplug } from 'lucide-react';
import { disconnectGoogleIntegration, getGoogleIntegration, saveGoogleIntegration } from './api';
import './google-integration.css';

const empty = { mode: 'direct', measurementId: '', propertyId: '', adsId: '', conversionLabel: '', containerId: '' };
const names = { ga4: 'Google Analytics 4', ads: 'Google Ads', gtm: 'Google Tag Manager' };

export default function GoogleIntegration(props) {
  return <GoogleWorkspace key={props.storeKey} {...props}/>;
}

function GoogleWorkspace({ csrfToken, storeKey, asset, initialService = 'ga4' }) {
  const [state, setState] = useState({ loading: true, configured: false, writable: false });
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [revision, setRevision] = useState(0);
  const mutation = useRef(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true }));
    getGoogleIntegration(controller.signal, storeKey).then(value => {
      if (controller.signal.aborted) return;
      setState({ ...value, loading: false });
      setForm(value.configured ? value.config : { ...empty, mode: initialService === 'gtm' ? 'gtm' : 'direct' });
      setFailed(false);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setState({ loading: false, configured: false, writable: false });
      setFailed(true); setMessage(error.message);
    });
    return () => controller.abort();
  }, [initialService, revision, storeKey]);
  const update = (field, value) => { setForm(current => ({ ...current, [field]: value })); setMessage(''); };
  const changeMode = mode => {
    setForm(current => ({ ...current, mode, ...(mode === 'gtm' ? { measurementId: '', adsId: '', conversionLabel: '' } : { containerId: '' }) }));
    setMessage('');
  };
  const save = async event => {
    event.preventDefault();
    if (!state.writable || busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const value = await saveGoogleIntegration(form, csrfToken, controller.signal, storeKey);
      if (controller.signal.aborted) return;
      setState({ ...value, loading: false }); setForm(value.config);
      setMessage('Configuração salva para esta loja. Abra um checkout e confira os eventos na sua conta Google.');
    } catch (error) { if (!controller.signal.aborted) { setFailed(true); setMessage(error.message); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const disconnect = async () => {
    if (!state.writable || busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true);
    try {
      await disconnectGoogleIntegration(csrfToken, controller.signal, storeKey);
      if (controller.signal.aborted) return;
      setState({ loading: false, configured: false, writable: true }); setForm(empty);
      setFailed(false); setMessage('Integrações Google desconectadas desta loja.'); setConfirmDisconnect(false);
    } catch (error) { if (!controller.signal.aborted) { setFailed(true); setMessage(error.message); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const reportsUrl = state.config?.propertyId ? `https://analytics.google.com/analytics/web/#/p${state.config.propertyId}/reports/intelligenthome` : 'https://analytics.google.com/';
  return <section className="google-integration">
    <header className="google-intro"><div><p className="eyebrow">DADOS DA SUA LOJA</p><h2>{names[initialService]}</h2><p>Acompanhe visitas, etapas do checkout e vendas na sua conta Google.</p></div><span className={`google-status ${state.configured ? 'configured' : ''}`}>{state.configured ? <><CheckCircle2 size={15}/> Configurado</> : 'Não configurado'}</span></header>
    {message && <div className={`integration-alert ${failed ? 'google-error' : ''}`} role={failed ? 'alert' : 'status'}>{message}{failed && !state.writable && <button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>}</div>}
    {state.loading ? <div className="card integration-loading"><LoaderCircle className="spin"/> Carregando configuração da loja...</div> : <div className="google-layout">
      <form className="card google-form" onSubmit={save}>
        <div className="google-card-heading"><span className="google-symbol">{asset?.imageUrl ? <img src={asset.imageUrl} alt={asset.altText || names[initialService]}/> : <BarChart3 size={24}/>}</span><div><h3>Conecte suas ferramentas</h3><p>Use os identificadores da conta deste lojista.</p></div></div>
        {!state.writable && <p className="google-note">Você pode consultar a configuração. Alterações exigem permissão de proprietário ou administrador.</p>}
        <fieldset disabled={busy || !state.writable}>
          <legend>Como deseja instalar?</legend>
          <div className="google-modes">
            <label className={form.mode === 'direct' ? 'selected' : ''}><input type="radio" name="google-mode" value="direct" checked={form.mode === 'direct'} onChange={() => changeMode('direct')}/><span><strong>GA4 e Google Ads</strong><small>Configuração direta pela SOLID</small></span></label>
            <label className={form.mode === 'gtm' ? 'selected' : ''}><input type="radio" name="google-mode" value="gtm" checked={form.mode === 'gtm'} onChange={() => changeMode('gtm')}/><span><strong>Tag Manager</strong><small>Gerencie as tags no seu contêiner</small></span></label>
          </div>
          {form.mode === 'direct' ? <>
            <div className="google-field"><label htmlFor="google-measurement">ID de medição do GA4</label><input id="google-measurement" value={form.measurementId} onChange={event => update('measurementId', event.target.value)} placeholder="G-XXXXXXXXXX" maxLength={22} autoComplete="off" spellCheck={false} aria-describedby="google-measurement-help"/><small id="google-measurement-help">Google Analytics → Administrador → Fluxos de dados → Web.</small></div>
            <details className="google-ads-fields" open={initialService === 'ads' || Boolean(form.adsId) || undefined}><summary><Megaphone size={17}/> Google Ads <span>Opcional</span></summary><p>Registre uma conversão quando o pagamento for confirmado.</p><div className="google-field"><label htmlFor="google-ads">ID de conversão</label><input id="google-ads" value={form.adsId} onChange={event => update('adsId', event.target.value)} placeholder="AW-123456789" maxLength={23} autoComplete="off" spellCheck={false}/></div><div className="google-field"><label htmlFor="google-label">Rótulo de conversão</label><input id="google-label" value={form.conversionLabel} onChange={event => update('conversionLabel', event.target.value)} placeholder="AbCdEFghIjKlmNop" maxLength={100} autoComplete="off" spellCheck={false}/><small>Google Ads → Metas → Conversões → sua ação de compra → Configuração da tag.</small></div></details>
          </> : <><div className="google-field"><label htmlFor="google-container">ID do contêiner</label><input id="google-container" value={form.containerId} onChange={event => update('containerId', event.target.value)} placeholder="GTM-XXXXXXX" maxLength={24} required autoComplete="off" spellCheck={false}/><small>Use um contêiner Web do Google Tag Manager.</small></div><p className="google-note">Nesse modo, publique as tags de GA4 e Ads no Tag Manager. A SOLID disponibiliza os eventos no dataLayer. Configure o consentimento e use somente tags necessárias ao checkout.</p></>}
          <div className="google-field"><label htmlFor="google-property">ID da propriedade GA4 <span>Opcional</span></label><input id="google-property" inputMode="numeric" value={form.propertyId} onChange={event => update('propertyId', event.target.value)} placeholder="123456789" maxLength={15} autoComplete="off"/><small>Permite abrir os relatórios da sua propriedade. Você precisa ter acesso a ela no Google.</small></div>
          <button className="primary google-save" disabled={busy || !state.writable}>{busy ? <LoaderCircle className="spin" size={17}/> : <CheckCircle2 size={17}/>} {busy ? 'Salvando...' : 'Salvar configuração'}</button>
        </fieldset>
        {state.configured && state.writable && <div className="google-disconnect">{confirmDisconnect ? <><p>Desconectar GA4, Ads e Tag Manager desta loja? Checkouts já abertos podem manter as tags até serem recarregados.</p><div><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Cancelar</button><button type="button" className="secondary danger-outline" disabled={busy} onClick={disconnect}>Confirmar desconexão</button></div></> : <button type="button" className="google-text-button" disabled={busy} onClick={() => setConfirmDisconnect(true)}><Unplug size={15}/> Desconectar Google desta loja</button>}</div>}
      </form>
      <aside className="google-guide">
        <section className="card"><span className="google-symbol"><ArrowUpRight size={23}/></span><h3>Os relatórios são seus</h3><p>Os eventos vão para a conta informada nesta loja. Consulte resultados e campanhas nas ferramentas do Google.</p><a className="secondary google-report-link" href={reportsUrl} target="_blank" rel="noopener noreferrer">Abrir Google Analytics <ArrowUpRight size={17}/></a><a className="google-inline-link" href="https://ads.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Ads <ArrowUpRight size={15}/></a><a className="google-inline-link" href="https://tagmanager.google.com/" target="_blank" rel="noopener noreferrer">Abrir Tag Manager <ArrowUpRight size={15}/></a></section>
        <section className="card"><span className="google-symbol"><Tags size={23}/></span><h3>Da visita à venda</h3><ul><li>Visualização do checkout e dos produtos</li><li>Início do checkout</li><li>Frete selecionado e Pix gerado</li><li>Compra com pagamento confirmado</li></ul><p className="google-note">Gerar um Pix não conta como compra. Bloqueadores, recusa de cookies e fechamento da página podem impedir o envio.</p></section>
        <section className="card"><span className="google-symbol"><ShieldCheck size={23}/></span><h3>Como confirmar</h3><ol><li>Salve os IDs da sua loja.</li><li>Abra um checkout publicado e aceite os cookies de medição.</li><li>Confira os eventos em Tempo real no GA4 ou no Tag Assistant.</li></ol><p>Salvar valida o formato dos IDs. A confirmação de recebimento é feita na sua conta Google.</p></section>
      </aside>
    </div>}
  </section>;
}
