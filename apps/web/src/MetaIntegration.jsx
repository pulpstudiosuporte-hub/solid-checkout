import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, KeyRound, LoaderCircle, ShieldCheck, Unplug } from 'lucide-react';
import { disconnectMeta, getMetaStatus, saveMeta } from './api';

export default function MetaIntegration({ csrfToken, storeKey }) {
  return <MetaForm key={storeKey} csrfToken={csrfToken}/>;
}
function MetaForm({ csrfToken }) {
  const [status, setStatus] = useState({ loading: true, connected: false });
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [serverEnabled, setServerEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    getMetaStatus().then(value => { if (!active) return; setStatus({ ...value, loading: false }); setPixelId(value.pixelId || ''); setServerEnabled(Boolean(value.serverEnabled)); }).catch(error => { if (active) { setStatus({ loading: false, connected: false }); setMessage(error.message); } });
    return () => { active = false; };
  }, []);
  const connect = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      const value = await saveMeta({ pixelId, accessToken, serverEnabled }, csrfToken);
      setStatus({ ...value, loading: false }); setAccessToken('');
      setMessage(value.serverEnabled ? 'Pixel salvo. O token também foi salvo para enviar eventos pelo servidor. O recebimento pode ser acompanhado no Gerenciador de Eventos.' : 'Pixel salvo. Ele será carregado nos checkouts desta loja ao abrir ou atualizar a página.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (busy || !window.confirm('Desconectar a Meta desta loja?')) return;
    setBusy(true);
    try { await disconnectMeta(csrfToken); setStatus({ loading: false, connected: false }); setPixelId(''); setAccessToken(''); setServerEnabled(false); setMessage('Meta desconectada.'); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <section className="utmify-section meta-section">
    <div className="utmify-title"><div><p className="eyebrow">ANÚNCIOS E CONVERSÕES</p><h2>Meta Pixel</h2><p>Cole o ID para rastrear os checkouts desta loja. Sem código para instalar.</p></div>{status.connected && <span className="connection-pill connected"><CheckCircle2 size={15}/> Pixel configurado</span>}</div>
    {message && <div className="integration-alert" role="status">{message}</div>}
    <div className="integration-layout"><div className="card shopify-card">
      <div className="integration-heading"><span className="utmify-brand meta-brand"><BarChart3 size={25}/></span><div><h2>Pixel do checkout</h2><p>Visualizações, início do checkout, pagamento e compra confirmada.</p></div></div>
      {status.loading ? <div className="integration-loading"><LoaderCircle className="spin"/> Carregando configuração...</div> : <form onSubmit={connect}>
        <label htmlFor="meta-pixel">ID do Pixel</label><div className="utmify-token-field"><BarChart3 size={18}/><input id="meta-pixel" inputMode="numeric" value={pixelId} onChange={event => setPixelId(event.target.value.replace(/\D/g, ''))} placeholder="Ex.: 123456789012345" maxLength={32} required disabled={busy}/></div>
        <p>Só o ID já ativa o Pixel no navegador em todos os checkouts desta loja.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}><input type="checkbox" checked={serverEnabled} onChange={event => setServerEnabled(event.target.checked)} disabled={busy}/> Enviar eventos também pelo servidor (opcional)</label>
        {serverEnabled && <><label htmlFor="meta-token">Token da API de Conversões</label><div className="utmify-token-field"><KeyRound size={18}/><input id="meta-token" type="password" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder={status.serverEnabled ? 'Deixe vazio para manter o token deste Pixel' : 'Cole o token do Gerenciador de Eventos'} autoComplete="off" disabled={busy}/></div><p>Complementa o Pixel, inclusive para compras confirmadas após fechar a página. Não é necessário enviar um teste para salvar.</p></>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 24 }}><button style={{ marginTop: 0 }} className="primary connect-button" disabled={busy || pixelId.length < 5}>{busy ? <LoaderCircle className="spin" size={17}/> : <BarChart3 size={17}/>} {busy ? 'Salvando...' : 'Salvar Pixel'}</button>
        {status.connected && <button type="button" className="secondary danger-outline" disabled={busy} onClick={disconnect}><Unplug size={17}/> Desconectar</button>}
      </div></form>}
    </div><aside className="card integration-security"><span><ShieldCheck size={23}/></span><h2>Eventos do checkout</h2><ul><li>PageView: abertura da página</li><li>ViewContent: visualização dos produtos</li><li>InitiateCheckout: início do checkout</li><li>AddPaymentInfo: pagamento gerado</li><li>Purchase: pagamento confirmado</li></ul><p>O token fica protegido no servidor. Quando os dois canais estão ativos, os eventos usam o mesmo identificador para evitar duplicidade.</p></aside></div>
  </section>;
}
