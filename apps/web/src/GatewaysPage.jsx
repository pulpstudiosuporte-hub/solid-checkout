import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Barcode, Check, CheckCircle2, CreditCard, Eye, EyeOff, Info, Landmark, LoaderCircle, QrCode, RefreshCw, Save, Search, Settings2, ShieldCheck, WalletCards, X } from 'lucide-react';
import { getPlatformContent, getRoasStatus, getWestPayStatus, saveRoas, saveWestPay } from './api';
import { gatewayAssetMap, gatewayCatalog } from './gateway-catalog';
import './gateways-page.css';
import './gateway-modal.css';

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
  return <button type="button" className={`gateway-catalog-card ${connected ? 'connected' : ''} ${selected ? 'selected' : ''} ${!available ? 'coming-soon' : ''}`} onClick={() => onSelect(gateway.id)} aria-label={available ? `${connected ? 'Gerenciar' : 'Configurar'} ${gateway.name}` : `Ver disponibilidade de ${gateway.name}`}>
    <GatewayLogo gateway={gateway} asset={asset}/>
    <div><strong>{gateway.name}</strong><em>{gateway.scope}</em></div>
    <small>{gateway.description}</small>
    <span className={`gateway-card-status ${connected ? 'active' : ''}`}>{connected ? 'Ativo' : available ? 'Configurar' : 'Em breve'}</span>
    <span className="gateway-card-arrow" aria-hidden="true"><ArrowRight size={15}/></span>
  </button>;
}

function PaymentMethod({ icon: Icon, title, description, enabled, locked = false }) {
  return <div className={`gateway-method ${locked ? 'locked' : ''}`}><Icon size={18}/><div><b>{title}</b><span>{description}</span></div><span className={`gateway-method-switch ${enabled ? 'on' : ''}`} aria-label={enabled ? 'Ativo' : 'Indisponível'}><i/></span></div>;
}

function GatewayModal({ gateway, asset, status, forms, setForms, busy, onSubmit, onClose }) {
  const [revealPublic, setRevealPublic] = useState(false); const [revealSecret, setRevealSecret] = useState(false);
  const closeRef = useRef(null); const supported = Boolean(gateway.supported); const connected = Boolean(status?.connected);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeRef.current?.focus();
    const keyboard = event => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', keyboard); };
  }, [busy, onClose]);
  const values = gateway.id === 'ROAS' ? forms.ROAS : forms.WESTPAY;
  const secretName = gateway.id === 'ROAS' ? 'secretKey' : 'apiKey';
  return <div className="gateway-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <section className="gateway-modal" role="dialog" aria-modal="true" aria-labelledby="gateway-modal-title">
      <button ref={closeRef} className="gateway-modal-close" type="button" onClick={onClose} disabled={busy} aria-label="Fechar configuração"><X size={19}/></button>
      <div className="gateway-modal-main">
        <header className="gateway-modal-title"><GatewayLogo gateway={gateway} asset={asset}/><div><h2 id="gateway-modal-title">{gateway.name}</h2><p>{supported ? `Integre sua loja à ${gateway.name}` : 'Integração planejada para o catálogo SOLID'}</p></div></header>
        {!supported ? <div className="gateway-unavailable"><CreditCard size={28}/><h3>Este gateway estará disponível em breve</h3><p>A logo e a presença no catálogo já podem ser administradas, mas nenhuma credencial ou pagamento será processado até a integração oficial ser concluída.</p><button type="button" className="secondary" onClick={onClose}>Voltar ao catálogo</button></div> : <form onSubmit={onSubmit}>
          <section className="gateway-modal-card gateway-accounts"><div className="gateway-section-heading"><div><h3>Conta conectada</h3><p>Gerencie a conexão usada para processar os pagamentos desta loja.</p></div><span>1 conta por gateway</span></div><div className="gateway-account-row"><div><b>{gateway.name} principal</b>{connected && <em>Ativa</em>}<span>PIX</span></div><Check size={18}/></div></section>
          <section className="gateway-modal-card gateway-credentials"><div className="gateway-section-heading"><div><h3>Credenciais</h3><p>Informe as chaves fornecidas pelo gateway para autenticar a integração.</p></div></div>
            <label>Chave pública<span><input type={revealPublic ? 'text' : 'password'} autoComplete="new-password" value={values.publicKey} onChange={event => setForms(current => ({ ...current, [gateway.id]: { ...current[gateway.id], publicKey: event.target.value } }))} placeholder={connected ? 'Digite para substituir a chave atual' : 'Cole a chave pública'} required/><button type="button" onClick={() => setRevealPublic(value => !value)} aria-label={revealPublic ? 'Ocultar chave pública' : 'Mostrar chave pública'}>{revealPublic ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
            <label>{gateway.id === 'ROAS' ? 'Chave secreta' : 'API Key'}<span><input type={revealSecret ? 'text' : 'password'} autoComplete="new-password" value={values[secretName]} onChange={event => setForms(current => ({ ...current, [gateway.id]: { ...current[gateway.id], [secretName]: event.target.value } }))} placeholder={connected ? 'Digite para substituir a chave atual' : 'Cole a chave secreta'} required/><button type="button" onClick={() => setRevealSecret(value => !value)} aria-label={revealSecret ? 'Ocultar chave secreta' : 'Mostrar chave secreta'}>{revealSecret ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          </section>
          <section className="gateway-modal-card"><div className="gateway-section-heading"><div><h3>Métodos de pagamento</h3><p>Os métodos disponíveis refletem o suporte real da integração.</p></div></div><div className="gateway-methods"><PaymentMethod icon={CreditCard} title="Cartão de crédito" description="Ainda não suportado por esta conexão." enabled={false} locked/><PaymentMethod icon={QrCode} title="Pix" description="QR Code e copia e cola com confirmação automática." enabled/><PaymentMethod icon={Barcode} title="Boleto" description="Ainda não suportado por esta conexão." enabled={false} locked/></div></section>
          <button className="primary gateway-modal-save" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Save size={17}/>} {connected ? 'Salvar alterações' : `Conectar ${gateway.name}`}</button>
        </form>}
      </div>
      <aside className="gateway-modal-aside"><section><h3>Status da integração</h3><p>Define se este gateway processa pagamentos na sua loja.</p><div><span>Status atual</span><b className={connected ? 'active' : ''}>{connected ? <><RefreshCw size={13}/> Ativo</> : supported ? 'Não conectado' : 'Em breve'}</b></div></section><section><Info size={18}/><div><h3>Dica sobre credenciais</h3><p>Use apenas chaves oficiais do gateway. Nunca envie credenciais por chat ou suporte.</p></div></section><section><ShieldCheck size={18}/><div><h3>Armazenamento seguro</h3><p>As chaves são validadas e protegidas com criptografia AES-GCM.</p></div></section></aside>
    </section>
  </div>;
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
  const selectedGateway = gatewayCatalog.find(item => item.id === selected) || null;
  const current = selectedGateway?.supported ? providers[selected] : null;
  const closeModal = useCallback(() => setSelected(null), []);

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
    {selectedGateway && <GatewayModal gateway={selectedGateway} asset={assetByKey.get(selectedGateway.assetKey)} status={statuses[selected]} forms={forms} setForms={setForms} busy={busy} onSubmit={submit} onClose={closeModal}/>}
  </main>;
}
