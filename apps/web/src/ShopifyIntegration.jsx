import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ExternalLink, Globe2, Images, Layers3, LoaderCircle, MessageCircle, Plug, RefreshCw, Search, ShieldCheck, ShoppingBag, Truck, Unplug, Webhook, Workflow } from 'lucide-react';
import { connectShopify, disconnectShopify, getMetaStatus, getShopifyStatus, getUtmifyStatus, syncShopifyCatalog } from './api';
import ShopifyOnboarding from './ShopifyOnboarding';
import UtmifyIntegration from './UtmifyIntegration';
import MetaIntegration from './MetaIntegration';
import IntegrationDiagnostics from './IntegrationDiagnostics';

const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Ainda não sincronizado';
const shopHandle = domain => domain?.replace(/\.myshopify\.com$/i, '') ?? '';

function ShopifyIntegrationDetails({ csrfToken, storeKey, onBack }) {
  const [status, setStatus] = useState({ loading: true, configured: true, connected: false, reconnectRequired: false });
  const [shop, setShop] = useState(''); const [busy, setBusy] = useState(false); const [syncing, setSyncing] = useState(false); const [message, setMessage] = useState(''); const [result, setResult] = useState(null);
  const load = () => { setStatus(current => ({ ...current, loading: true })); getShopifyStatus().then(value => { setStatus({ ...value, loading: false }); if (value.shopDomain) setShop(shopHandle(value.shopDomain)); }).catch(error => { setStatus(current => ({ ...current, loading: false })); setMessage(error.message); }); };
  useEffect(() => { void load(); }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const value = new URLSearchParams(window.location.hash.split('?')[1] || '').get('shopify'); if (value === 'connected') setMessage('Shopify conectada com sucesso. Agora sincronize o catálogo.'); else if (value === 'already_connected') setMessage('Esta loja Shopify já está ativa em outra loja SOLID. Desconecte-a da loja anterior antes de transferir.'); else if (value) setMessage('Não foi possível concluir a conexão. Tente novamente.'); if (value) window.history.replaceState({}, '', '/#/integrations'); }, []);
  const connect = async event => { event.preventDefault(); setBusy(true); setMessage(''); try { const value = await connectShopify(shop, csrfToken); window.location.assign(value.authorizationUrl); } catch (error) { setMessage(error.message); setBusy(false); } };
  const disconnect = async () => { if (!window.confirm('Desconectar a Shopify desta loja? A sincronização será interrompida.')) return; setBusy(true); setMessage(''); try { await disconnectShopify(csrfToken); load(); setResult(null); setMessage('Integração desconectada.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } };
  const synchronize = async () => { setSyncing(true); setMessage(''); setResult(null); try { const value = await syncShopifyCatalog(csrfToken); setResult(value); setStatus(current => ({ ...current, lastSyncedAt: value.syncedAt })); setMessage('Catálogo sincronizado com sucesso.'); } catch (error) { setMessage(error.message); load(); } finally { setSyncing(false); } };
  const badge = status.reconnectRequired ? <><AlertTriangle size={15}/> Reconexão necessária</> : status.connected ? <><CheckCircle2 size={15}/> Conectado</> : <><Plug size={15}/> Não conectado</>;

  return <main className="page integrations-page integration-detail-page"><button className="integration-back" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar para integrações</button><section className="page-title"><div><p className="eyebrow">INTEGRAÇÕES</p><h1>Shopify</h1><p>Importe o catálogo completo da loja ativa com autorização segura.</p></div><span className={`connection-pill ${status.connected ? 'connected' : ''} ${status.reconnectRequired ? 'reconnect' : ''}`}>{badge}</span></section>
    {status.reconnectRequired && <div className="integration-alert reconnect-alert" role="alert"><AlertTriangle size={18}/><div><strong>Reconecte sua loja Shopify</strong><span>A autorização expirou ou foi revogada. Seus produtos e personalizações continuam salvos, mas novas sincronizações estão pausadas.</span></div></div>}
    {message && <div className="integration-alert" role="status" aria-live="polite">{message}</div>}
    <IntegrationDiagnostics storeKey={storeKey}/>
    <ShopifyOnboarding key={storeKey} connected={status.connected} synced={Boolean(status.lastSyncedAt)} shopDomain={status.shopDomain} storeKey={storeKey}/>
    <section className="integration-layout"><div className="card shopify-card"><div className="integration-heading"><span className="shopify-brand"><ShoppingBag size={25}/></span><div><h2>Shopify Admin</h2><p>Produtos, variantes, imagens e coleções serão importados para esta loja SOLID.</p></div></div>
      {status.loading ? <div className="integration-loading"><LoaderCircle className="spin"/> Verificando conexão...</div> : status.connected ? <div className="connected-content"><div className="connected-panel"><div><span>Loja conectada</span><strong>{status.shopDomain}</strong><small>Última sincronização: {formatDate(status.lastSyncedAt)}</small></div><button className="secondary danger-outline" disabled={busy || syncing} onClick={disconnect}>{busy ? <LoaderCircle className="spin" size={17}/> : <Unplug size={17}/>} Desconectar</button></div><div className="catalog-sync"><div><h3>Catálogo Shopify</h3><p>Atualiza dados de origem sem substituir os textos personalizados no checkout.</p></div><button className="primary sync-button" disabled={syncing || busy} onClick={synchronize}>{syncing ? <LoaderCircle className="spin" size={17}/> : <RefreshCw size={17}/>} {syncing ? 'Sincronizando...' : 'Sincronizar catálogo'}</button></div>{result && <div className="sync-result"><span><ShoppingBag size={16}/><strong>{result.products}</strong> produtos</span><span><Layers3 size={16}/><strong>{result.collections}</strong> coleções</span><span><Images size={16}/><strong>{result.images}</strong> imagens</span><span><RefreshCw size={16}/><strong>{result.variants}</strong> variantes</span></div>}</div> : <form onSubmit={connect}><label htmlFor="shopify-shop">Domínio MyShopify</label><div className="shop-domain-field"><input id="shopify-shop" value={shop} onChange={event => setShop(event.target.value)} placeholder="minha-loja" autoComplete="off" required/><span>.myshopify.com</span></div><small>Use o domínio original da Shopify, sem https:// ou www.</small><button className="primary connect-button" disabled={busy || !status.configured}>{busy ? <LoaderCircle className="spin" size={17}/> : <ExternalLink size={17}/>} {busy ? 'Redirecionando...' : status.reconnectRequired ? 'Reconectar Shopify' : 'Conectar com Shopify'}</button>{!status.configured && <p className="configuration-warning">A integração precisa ser configurada no servidor antes da conexão.</p>}{status.reconnectRequired && <p className="reconnect-preserved">O catálogo importado permanecerá salvo durante a reconexão.</p>}</form>}
    </div><aside className="card integration-security"><span><ShieldCheck size={23}/></span><h2>Conexão protegida</h2><p>Você autoriza o acesso diretamente na Shopify. A SOLID nunca solicita sua senha.</p><ul><li>Acesso somente de leitura ao catálogo</li><li>Token criptografado no banco</li><li>Dados separados por loja</li><li>Personalizações preservadas</li></ul></aside></section></main>;
}

const categories = ['Todas', 'E-commerce', 'Logística e Frete', 'Atendimento', 'Marketing', 'Automação'];
const integrations = [
  { id: 'shopify', name: 'Shopify', category: 'E-commerce', description: 'Sincronize produtos, variantes, imagens e coleções da sua loja Shopify.', icon: ShoppingBag, tone: 'shopify', available: true, keywords: 'loja ecommerce catálogo produtos' },
  { id: 'woocommerce', name: 'WooCommerce', category: 'E-commerce', description: 'Conecte sua operação WooCommerce de forma simples.', icon: Globe2, tone: 'woo', keywords: 'wordpress ecommerce loja' },
  { id: 'melhor-envio', name: 'Melhor Envio', category: 'Logística e Frete', description: 'Calcule fretes e automatize envios com Correios e transportadoras.', icon: Truck, tone: 'shipping', keywords: 'frete correios entrega transportadora' },
  { id: 'superfrete', name: 'Superfrete', category: 'Logística e Frete', description: 'Calcule fretes automaticamente em seus checkouts.', icon: Truck, tone: 'superfrete', keywords: 'frete entrega logística' },
  { id: 'frenet', name: 'Frenet', category: 'Logística e Frete', description: 'Cotação de frete, etiquetas e rastreio via Frenet.', icon: Truck, tone: 'frenet', keywords: 'frete etiqueta rastreio logística' },
  { id: 'whatsapp', name: 'WhatsApp', category: 'Atendimento', description: 'Recupere carrinhos e acompanhe clientes pelo WhatsApp.', icon: MessageCircle, tone: 'whatsapp', keywords: 'atendimento recuperação carrinho mensagens' },
  { id: 'meta', name: 'Meta Pixel', category: 'Marketing', description: 'Pixel e API de Conversões com eventos deduplicados.', icon: BarChart3, tone: 'meta', available: true, keywords: 'facebook instagram pixel conversões tráfego' },
  { id: 'utmify', name: 'UTMify', category: 'Marketing', description: 'Envie pedidos e conversões para sua operação de tráfego.', icon: Activity, tone: 'utmify', available: true, keywords: 'utm rastreamento tráfego pedidos' },
  { id: 'webhooks', name: 'Webhooks', category: 'Automação', description: 'Dispare eventos da loja para sistemas e fluxos externos.', icon: Webhook, tone: 'webhook', available: true, keywords: 'api eventos automação endpoint integração' },
];

function DetailShell({ title, onBack, children }) {
  return <main className="page integrations-page integration-detail-page"><button className="integration-back" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar para integrações</button><div className="integration-detail-heading"><p className="eyebrow">INTEGRAÇÕES</p><h1>{title}</h1></div>{children}</main>;
}

export default function ShopifyIntegration({ csrfToken, storeKey }) {
  const initialShopify = new URLSearchParams(window.location.hash.split('?')[1] || '').has('shopify');
  const [selected, setSelected] = useState(initialShopify ? 'shopify' : null);
  const [category, setCategory] = useState('Todas');
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState({ shopify: false, meta: false, utmify: false });
  useEffect(() => {
    let active = true;
    Promise.allSettled([getShopifyStatus(), getMetaStatus(), getUtmifyStatus()]).then(([shopify, meta, utmify]) => {
      if (!active) return;
      setConnections({
        shopify: shopify.status === 'fulfilled' && Boolean(shopify.value.connected),
        meta: meta.status === 'fulfilled' && Boolean(meta.value.connected),
        utmify: utmify.status === 'fulfilled' && Boolean(utmify.value.connected),
      });
    });
    return () => { active = false; };
  }, [storeKey, selected]);
  if (selected === 'shopify') return <ShopifyIntegrationDetails csrfToken={csrfToken} storeKey={storeKey} onBack={() => setSelected(null)}/>;
  if (selected === 'meta') return <DetailShell title="Meta Pixel" onBack={() => setSelected(null)}><MetaIntegration csrfToken={csrfToken} storeKey={storeKey}/></DetailShell>;
  if (selected === 'utmify') return <DetailShell title="UTMify" onBack={() => setSelected(null)}><UtmifyIntegration csrfToken={csrfToken} storeKey={storeKey}/></DetailShell>;
  const term = query.trim().toLocaleLowerCase('pt-BR');
  const visible = integrations.filter(item => (category === 'Todas' || item.category === category) && (!term || `${item.name} ${item.description} ${item.category} ${item.keywords}`.toLocaleLowerCase('pt-BR').includes(term)));
  const counts = Object.fromEntries(categories.map(name => [name, name === 'Todas' ? integrations.length : integrations.filter(item => item.category === name).length]));
  const grouped = categories.slice(1).map(name => [name, visible.filter(item => item.category === name)]).filter(([, list]) => list.length);
  const open = item => {
    if (!item.available) return;
    if (item.id === 'webhooks') { window.dispatchEvent(new CustomEvent('solid:navigate', { detail: 'Webhooks' })); return; }
    setSelected(item.id);
  };
  return <main className="page integrations-catalog-page">
    <div className="integration-breadcrumb"><span>Sistema</span><ArrowRight size={13}/><b>Integrações</b></div>
    <section className="page-title integration-catalog-title"><div><h1>Integrações</h1><p>Conecte sua operação com plataformas de e-commerce, logística, marketing e automação.</p></div></section>
    <div className="integration-catalog-layout">
      <aside className="card integration-categories" aria-label="Categorias de integrações"><b>Categorias</b>{categories.map(name => <button type="button" className={category === name ? 'active' : ''} aria-pressed={category === name} key={name} onClick={() => setCategory(name)}><span>{name}</span><em>{counts[name]}</em></button>)}</aside>
      <div className="integration-catalog-main">
        <label className="integration-search"><Search size={18}/><span className="sr-only">Buscar integração</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar integração..."/></label>
        {grouped.length ? grouped.map(([name, list]) => <section className="card integration-category-card" key={name}><header><h2>{name}</h2><p>{name === 'E-commerce' ? 'Integrações com plataformas de e-commerce' : name === 'Logística e Frete' ? 'Transportadoras, cotações e cálculo de frete' : name === 'Marketing' ? 'Mensuração e rastreamento de conversões' : name === 'Atendimento' ? 'Relacionamento e recuperação de clientes' : 'Eventos e fluxos automáticos da operação'}</p></header><div>{list.map(item => <article className="integration-catalog-item" key={item.id}><span className={`integration-logo ${item.tone}`}><item.icon size={21}/></span><div><h3>{item.name}{connections[item.id] && <span className="integration-active"><CheckCircle2 size={12}/> Ativa</span>}{!item.available && <span className="integration-soon">Em breve</span>}</h3><p>{item.description}</p></div><button type="button" disabled={!item.available} onClick={() => open(item)}>{item.available ? connections[item.id] ? 'Gerenciar' : 'Configurar' : 'Em breve'}{item.available && <ArrowRight size={16}/>}</button></article>)}</div></section>) : <section className="card integration-catalog-empty"><Workflow size={27}/><h2>Nenhuma integração encontrada</h2><p>Altere a busca ou selecione outra categoria.</p><button type="button" className="secondary" onClick={() => { setQuery(''); setCategory('Todas'); }}>Limpar filtros</button></section>}
      </div>
    </div>
  </main>;
}
