import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, KeyRound, Landmark, LoaderCircle, RefreshCw, Save, Search, Settings2, ShieldCheck, WalletCards } from 'lucide-react';
import { getPlatformContent, getRoasStatus, getWestPayStatus, saveRoas, saveWestPay } from './api';
import { gatewayAssetMap, gatewayCatalog } from './gateway-catalog';
import './gateways-page.css';

const providers = {
  ROAS: { name: 'Roas', description: 'Pix com liquidação e reconciliação automática.', icon: Landmark, fields: ['Secret Key', 'Public Key'] },
  WESTPAY: { name: 'WestPay', description: 'Pix real com confirmação automática de pagamento.', icon: WalletCards, fields: ['API Key', 'Public Key'] },
};

function GatewayLogo({ gateway, asset }) {
  if (asset?.imageUrl) return <img src={asset.imageUrl} alt={asset.altText || `Logo ${gateway.name}`} loading="lazy"/>;
  const Icon = providers[gateway.id]?.icon || CreditCard;
  return <span aria-hidden="true"><Icon size={21}/></span>;
}

function GatewayCard({ gateway, asset, connected, selected, onSelect }) {
  const available = Boolean(gateway.supported);
  return <button type="button" className={`gateway-catalog-card ${connected ? 'connected' : ''} ${selected ? 'selected' : ''}`} onClick={() => available && onSelect(gateway.id)} disabled={!available} aria-label={available ? `${connected ? 'Gerenciar' : 'Configurar'} ${gateway.name}` : `${gateway.name}, em breve`}>
    <GatewayLogo gateway={gateway} asset={asset}/>
    <div><strong>{gateway.name}</strong><em>{gateway.scope}</em></div>
    <small>{gateway.description}</small>
    <span className={`gateway-card-status ${connected ? 'active' : ''}`}>{connected ? 'Ativo' : available ? 'Configurar' : 'Em breve'}</span>
    <span className="gateway-card-arrow" aria-hidden="true"><ArrowRight size={15}/></span>
  </button>;
}

export default function GatewaysPage({ csrfToken, storeKey }) {
  const [statuses, setStatuses] = useState({ ROAS: { loading: true, connected: false }, WESTPAY: { loading: true, connected: false } });
  const [assets, setAssets] = useState([]); const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState(''); const [scope, setScope] = useState('Todos');
  const [forms, setForms] = useState({ ROAS: { secretKey: '', publicKey: '' }, WESTPAY: { apiKey: '', publicKey: '' } });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const [roas, westpay, content] = await Promise.allSettled([getRoasStatus(), getWestPayStatus(), getPlatformContent()]);
    setStatuses({
      ROAS: roas.status === 'fulfilled' ? { ...roas.value, loading: false } : { loading: false, connected: false },
      WESTPAY: westpay.status === 'fulfilled' ? { ...westpay.value, loading: false } : { loading: false, connected: false },
    });
    if (content.status === 'fulfilled') setAssets(content.value.integrationAssets || []);
    const statusError = [roas, westpay].find(value => value.status === 'rejected');
    if (statusError?.status === 'rejected') setMessage(statusError.reason?.message || 'Não foi possível verificar os gateways.');
    setLoading(false);
  };
  useEffect(() => { void load(); }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const assetByKey = useMemo(() => gatewayAssetMap(assets), [assets]);
  const visible = useMemo(() => { const term = search.trim().toLocaleLowerCase('pt-BR'); return gatewayCatalog.filter(item => (scope === 'Todos' || item.scope === scope) && (!term || `${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(term))); }, [scope, search]);
  const configured = visible.filter(item => statuses[item.id]?.connected);
  const available = visible.filter(item => !statuses[item.id]?.connected);
  const current = selected ? providers[selected] : null;
  const Icon = current?.icon;

  const submit = async event => {
    event.preventDefault(); if (!selected || !current) return;
    setBusy(true); setMessage('');
    try {
      if (selected === 'ROAS') await saveRoas(forms.ROAS, csrfToken); else await saveWestPay(forms.WESTPAY, csrfToken);
      setForms(value => ({ ...value, [selected]: selected === 'ROAS' ? { secretKey: '', publicKey: '' } : { apiKey: '', publicKey: '' } }));
      setMessage(`${current.name} conectada e validada com sucesso.`); await load();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  return <main className="page gateways-page">
    <section className="page-title gateway-page-title"><div><h1>Formas de Pagamento</h1><p>Gerencie os gateways de pagamento e as formas disponíveis para sua loja.</p></div></section>
    <div className="gateway-tabs" role="tablist" aria-label="Configurações de pagamento"><button role="tab" aria-selected="true"><Settings2 size={16}/> Gateways</button><button role="tab" aria-selected="false" disabled><RefreshCw size={15}/> Retentativa <small>Em breve</small></button></div>
    {message && <div className="integration-alert" role="status">{message}</div>}
    <section className="card gateway-catalog-shell">
      <div className="gateway-catalog-toolbar"><label><Search size={17}/><span className="sr-only">Buscar gateway</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar gateway..."/></label><div role="group" aria-label="Abrangência do gateway">{['Todos','Nacional','Global'].map(value => <button type="button" key={value} className={scope === value ? 'active' : ''} onClick={() => setScope(value)}>{scope === value && <i/>}{value}</button>)}</div></div>
      {loading ? <div className="gateway-catalog-loading"><LoaderCircle className="spin"/> Verificando gateways...</div> : <>
        {configured.length > 0 && <div className="gateway-catalog-group"><h2><CheckCircle2 size={16}/> Gateways configurados</h2><div className="gateway-catalog-grid">{configured.map(gateway => <GatewayCard key={gateway.id} gateway={gateway} asset={assetByKey.get(gateway.assetKey)} connected selected={selected === gateway.id} onSelect={setSelected}/>)}</div></div>}
        <div className="gateway-catalog-group available"><h2>Gateways disponíveis <span>({available.length})</span></h2>{available.length ? <div className="gateway-catalog-grid">{available.map(gateway => <GatewayCard key={gateway.id} gateway={gateway} asset={assetByKey.get(gateway.assetKey)} connected={false} selected={selected === gateway.id} onSelect={setSelected}/>)}</div> : <div className="gateway-catalog-empty">Nenhum gateway encontrado para estes filtros.</div>}</div>
      </>}
    </section>
    {current && <section className="gateway-layout" id="gateway-configuration"><form className="card gateway-form" onSubmit={submit}><div className="gateway-heading"><span>{Icon && <Icon size={25}/>}</span><div><div className="gateway-title-line"><h2>Configurar {current.name}</h2>{statuses[selected].connected && <span className="gateway-badge">Ativo</span>}</div><p>{current.description}</p></div></div>{statuses[selected].loading ? <div className="integration-loading"><LoaderCircle className="spin"/> Verificando...</div> : <><label>{current.fields[0]}<input type="password" autoComplete="new-password" value={selected === 'ROAS' ? forms.ROAS.secretKey : forms.WESTPAY.apiKey} onChange={event => setForms(value => ({ ...value, [selected]: { ...value[selected], [selected === 'ROAS' ? 'secretKey' : 'apiKey']: event.target.value } }))} placeholder={selected === 'ROAS' ? 'Cole a Secret Key da Roas' : 'live_...'} required/></label><label>{current.fields[1]}<input type="password" autoComplete="new-password" value={forms[selected].publicKey} onChange={event => setForms(value => ({ ...value, [selected]: { ...value[selected], publicKey: event.target.value } }))} placeholder={`Cole a Public Key da ${current.name}`} required/></label><small className="gateway-note"><KeyRound size={14}/> As chaves são validadas e armazenadas com criptografia AES-GCM.</small><button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Save size={17}/>} {statuses[selected].connected ? 'Atualizar credenciais' : `Conectar ${current.name}`}</button></>}</form><aside className="card gateway-security"><ShieldCheck size={25}/><h2>Pagamento protegido</h2><p>O checkout calcula o total no servidor e envia somente os dados necessários ao gateway.</p><ul><li>Credenciais nunca chegam ao navegador</li><li>Preço e frete são recalculados no servidor</li><li>Cada tentativa é identificada por sessão</li><li>O status é confirmado diretamente no gateway</li></ul></aside></section>}
  </main>;
}
