import { useAppTheme } from './app-theme';
import ThemeToggle from './ThemeToggle';
import PiratAssistant from './PiratAssistant';
import { SupportContext } from './support-context';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Box, Check, CheckCircle2, Clock3, Copy, CreditCard, Eye, Globe2, Home, LayoutTemplate, Menu, Package, PanelLeftClose, PanelLeftOpen, Plug, Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Store, Tag, TrendingUp, Truck, Users, X, Zap, LogOut, ServerCog, Webhook, Megaphone, ScanSearch } from 'lucide-react';
import './admin-styles.css';
import './admin-refresh.css';
import './pirat-theme.css';
import './app-dark-theme.css';
import { defaultCheckoutConfig } from './checkout-config';
const CheckoutEditor = lazy(() => import('./CheckoutEditor'));
import { archiveStore, bindTabToUser, clearTabUser, completeMfaLogin, createStore, forgotPassword, getApiHealth, getSession, getSettings, getStores, login, logout, registerAccount, resetPassword, selectStore, verifyAccount } from './api';
import { currentWebPushSubscription, disableWebPushOnThisDevice } from './web-push';
import Login, { SessionLoading } from './Auth';
import DashboardPage from './DashboardPage';
import StoreSwitcher from './StoreSwitcher';
const CheckoutsPage = lazy(() => import('./CheckoutsPage'));
import LogisticsPage from './LogisticsPage';
import PageErrorBoundary from './PageErrorBoundary';
import OrdersPage, {  } from './OrdersPage';
import AdminUsersPage from './AdminUsersPage';
import NotificationCenter from './NotificationCenter';
import InstallAppPrompt from './InstallAppPrompt';
import CommandPalette from './CommandPalette';
import { SupportBanner, SupportExpired } from './SupportAccess';
import { hasSupportSession } from './api-request';
import { canPlatform, canPlatformPage, platformPagePermission, canSupportPage } from './platform-access';
const PlatformTeamPage = lazy(() => import('./PlatformTeamPage'));
const AccessAuditPage = lazy(() => import('./AccessAuditPage'));
import { canAccessWithoutActiveStore } from './app-access';

const AccountSettings = lazy(() => import('./SettingsHub'));
const ShopifyIntegration = lazy(() => import('./ShopifyIntegration'));
const ProductsPage = lazy(() => import('./ProductsPage'));
const GatewaysPage = lazy(() => import('./GatewaysPage'));
const OrderBumpsPage = lazy(() => import('./OrderBumpsPage'));
const DomainsPage = lazy(() => import('./DomainsPage'));
const CouponsPage = lazy(() => import('./CouponsPage'));
const AdminOperationsPage = lazy(() => import('./AdminOperationsPage'));
const BillingPage = lazy(() => import('./BillingPage'));
const AbandonedCartsPage = lazy(() => import('./AbandonedCartsPage'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));
const WebhooksPage = lazy(() => import('./WebhooksPage'));
const NewsRoadmapPage = lazy(() => import('./NewsRoadmapPage'));
const AdminContentPage = lazy(() => import('./AdminContentPage'));
const ChromaSensePage = lazy(() => import('./ChromaSensePage'));

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const navGroups = [
  { label: 'Gestão', icon: Box, description: 'Operação e catálogo', items: [
    { label: 'Início', icon: Home }, { label: 'Análises', icon: BarChart3 }, { label: 'Pedidos', icon: ShoppingBag },
    { label: 'Carrinhos', icon: ShoppingCart }, { label: 'ChromaSense', icon: ScanSearch }, { label: 'Produtos', icon: Package }, { label: 'Webhooks', icon: Webhook },
  ]},
  { label: 'Checkout', icon: LayoutTemplate, description: 'Venda e entrega', items: [
    { label: 'Checkouts', icon: LayoutTemplate }, { label: 'Domínios', icon: Globe2 },
    { label: 'Logística', icon: Truck }, { label: 'Gateways', icon: CreditCard },
  ]},
  { label: 'Marketing', icon: Megaphone, description: 'Conversão e canais', items: [
    { label: 'Order bumps', icon: Sparkles }, { label: 'Cupons', icon: Tag },
    { label: 'Marketing', icon: BarChart3 }, { label: 'Integrações', icon: Plug },
  ]},
];

function Logo({ compact = false, merchantPreview = false }) {
  const { theme } = useAppTheme();
  return <div className={`brand ${compact ? 'compact' : ''}`}><img className="brand-symbol" src="/brand/pirat-mascot.png" alt=""/>{!compact && <img className="brand-wordmark" src={!merchantPreview && theme === 'dark' ? '/brand/pirat-logo-on-dark.png' : '/brand/pirat-logo-on-light.png'} alt="Pirat"/>}</div>;
}

function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}>{children}</span>; }

const roleLabels = { OWNER: 'Proprietário', ADMIN: 'Administrador', ANALYST: 'Analista' };

function Sidebar({ open, collapsed, onClose, onToggleCollapsed, page, setPage, user, onLogout, stores, storeBusy, onSelectStore, onCreateStore, onArchiveStore, support }) {
  const drawer = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...drawer.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')].filter(element => element.getClientRects().length);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const elements = focusable(); const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, onClose]);
  const activeRole = stores.find(store => store.active)?.role;
  const pageGroup = navGroups.find(group => group.items.some(item => item.label === page));
  const pageGroupLabel = pageGroup?.label;
  const [activeModule, setActiveModule] = useState(pageGroupLabel || 'Gestão');
  useEffect(() => { if (pageGroupLabel) setActiveModule(pageGroupLabel); }, [pageGroupLabel]);
  const activeGroup = navGroups.find(group => group.label === activeModule) || navGroups[0];
  const adminItems = [{ label: 'Usuários', icon: Users }, { label: 'Operações', icon: ServerCog }, { label: 'Conteúdo', icon: Megaphone }, { label: 'Equipe e permissões', icon: ShieldCheck }, { label: 'Histórico de acessos', icon: Clock3 }].filter(item => canPlatformPage(user, item.label));
  const navigate = label => { setPage(label); onClose(); };
  return <>
    {open && <button className="backdrop" onClick={onClose} aria-label="Fechar menu" />}
    <aside ref={drawer} aria-label="Navegação da loja" className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-head"><Logo compact={collapsed}/><button className="icon-btn sidebar-collapse" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button><button className="icon-btn mobile-only" aria-label="Fechar navegação" onClick={onClose}><X size={19}/></button></div>
      <StoreSwitcher stores={stores} busy={storeBusy} onSelect={onSelectStore} onCreate={onCreateStore} onArchive={onArchiveStore} support={support && support.mode !== 'FULL_ACCESS'}/>
      <nav aria-label="Menu principal">
        <section className="sidebar-navigation">
          <div className="module-tabs" role="tablist" aria-label="Áreas do painel">
            {navGroups.map(group => <button key={group.label} type="button" role="tab" aria-selected={activeGroup.label === group.label} aria-controls="sidebar-resources" className={`module-tab ${activeGroup.label === group.label ? 'active' : ''}`} title={collapsed ? group.label : undefined} onClick={() => setActiveModule(group.label)}><group.icon size={18} aria-hidden="true"/><span>{group.label}</span></button>)}
          </div>
          <div className="resource-panel" id="sidebar-resources" role="tabpanel">
            <div className="resource-head"><small>RECURSOS</small><strong>{activeGroup.label}</strong><span>{activeGroup.description}</span></div>
            <div className="resource-list">{activeGroup.items.filter(item => !support || canSupportPage(support, item.label)).map(item => <button aria-current={page === item.label ? "page" : undefined} key={item.label} title={collapsed ? item.label : undefined} className={page === item.label ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.label)}><item.icon size={18} aria-hidden="true"/><span>{item.label}</span>{item.count && <em>{item.count}</em>}</button>)}</div>
          </div>
        </section>
        {!support && adminItems.length > 0 && <section className="platform-nav" aria-label="Administração da plataforma"><small className="nav-title">Administração</small>{adminItems.map(item => <button key={item.label} title={collapsed ? item.label : undefined} className={page === item.label ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.label)}><item.icon size={18} aria-hidden="true"/><span>{item.label}</span></button>)}</section>}
      </nav>
      <div className="side-bottom">
        <small className="nav-title">Conta</small>
        <a className="nav-item" href="https://docs.apirat.io/" target="_blank" rel="noreferrer" title="Documentação (abre em nova aba)" style={{ textDecoration: 'none' }}><Globe2 size={18} aria-hidden="true"/><span>Documentação</span></a>
        {(!support || support.mode === 'FULL_ACCESS') && <button title={collapsed ? 'Meu plano' : undefined} className={page === 'Meu plano' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Meu plano')}><CreditCard size={18}/><span>Meu plano</span></button>}
        <button title={collapsed ? 'Configurações' : undefined} className={page === 'Configurações' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Configurações')}><Settings size={18}/><span>Configurações</span></button>
        <div className="profile"><div className="avatar">{user?.name?.split(' ').slice(0,2).map(part=>part[0]).join('').toUpperCase() || 'AD'}</div><span><b>{user?.name || 'Usuário'}</b><small>{roleLabels[activeRole] || 'Membro'}</small></span><button className="icon-btn" onClick={onLogout} aria-label="Sair do painel" title="Sair"><LogOut size={17}/></button></div>
      </div>
    </aside>
  </>;
}

function Header({ toggleSidebar, apiStatus, csrfToken, storeKey, onNavigate, onOpenSearch, page, support }) {
  const statusLabel = apiStatus === 'online' ? 'API conectada' : apiStatus === 'offline' ? 'API indisponível' : 'Conectando à API';
  return <header className="topbar">
    <button className="icon-btn menu-btn" onClick={toggleSidebar} aria-label="Abrir menu"><Menu size={21}/></button>
    <div className="topbar-context"><small>Painel</small><strong>{page}</strong></div>
    <button className="search" type="button" onClick={onOpenSearch} aria-label="Abrir busca avançada"><Search size={18}/><span>Buscar no painel...</span><kbd>Ctrl K</kbd></button>
    <div className="top-actions"><ThemeToggle/><span className={`sandbox api-status ${apiStatus}`} role="status"><span/> {statusLabel}</span>{!support && <NotificationCenter csrfToken={csrfToken} storeKey={storeKey} onNavigate={onNavigate}/>}</div>
  </header>;
}

function FirstStoreSetup({ onCreate, busy }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 3) return setError('Informe um nome com pelo menos 3 caracteres.');
    setError('');
    try { await onCreate(cleanName); }
    catch (cause) { setError(cause?.code === 'STORE_LIMIT_REACHED' ? 'O limite de lojas do plano foi atingido.' : 'Não foi possível criar sua loja agora. Tente novamente.'); }
  };
  return <main className="first-store-page">
    <section className="first-store-card" aria-labelledby="first-store-title">
      <div className="first-store-icon"><Store size={27}/></div>
      <p className="eyebrow">PRIMEIROS PASSOS</p>
      <h1 id="first-store-title">Crie sua primeira loja</h1>
      <p className="first-store-lead">Sua conta está pronta. Agora escolha o nome da operação que você quer administrar na Pirat.</p>
      <form onSubmit={submit}>
        <label htmlFor="first-store-name">Nome da loja</label>
        <div className="first-store-input"><Store size={18}/><input id="first-store-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Loja Pedro" minLength={3} maxLength={120} autoFocus disabled={busy}/></div>
        <small>Esse nome aparecerá no painel e poderá ser alterado depois.</small>
        {error && <p className="store-form-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy || name.trim().length < 3}>{busy ? 'Criando sua loja...' : <>Criar minha loja <ArrowRight size={17}/></>}</button>
      </form>
      <div className="first-store-benefits" aria-label="Próximas etapas"><span><CheckCircle2 size={16}/> Configure no seu ritmo</span><span><CheckCircle2 size={16}/> Importe ou crie produtos</span><span><CheckCircle2 size={16}/> Publique quando estiver pronto</span></div>
    </section>
  </main>;
}

function StoresUnavailable() {
  return <main className="first-store-page"><section className="first-store-card" role="alert"><div className="first-store-icon"><Store size={27}/></div><h1>Não foi possível carregar suas lojas</h1><p className="first-store-lead">A conexão com o cadastro da conta falhou. Nenhuma alteração foi feita.</p><button className="secondary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button></section></main>;
}

function Dashboard(props) {
  return <DashboardPage {...props}/>;
}

function SimplePage({ page, onCheckout, onEdit, csrfToken, storeKey, storeSlug }) {
  if (page === 'Usuários') return <AdminUsersPage csrfToken={csrfToken}/>;
  if (page === 'Checkouts') return <CheckoutsPage csrfToken={csrfToken} storeSlug={storeSlug}/>;
  if (page === 'Logística') return <LogisticsPage csrfToken={csrfToken} storeKey={storeKey}/>;
  const configs = {
    'Pedidos': ['Pedidos', 'Gerencie vendas, pagamentos e carrinhos abandonados.', ShoppingBag],
    'Produtos': ['Produtos', 'Seu catálogo sincronizado com a Shopify.', Package],
    'Checkouts': ['Checkouts', 'Crie experiências rápidas e focadas em conversão.', LayoutTemplate],
    'Order bumps': ['Order bumps', 'Ofertas complementares para aumentar seu ticket médio.', Sparkles],
    'Marketing': ['Marketing', 'Pixels e eventos de conversão da sua operação.', BarChart3],
    'Integrações': ['Integrações', 'Conecte os serviços essenciais para vender.', Plug],
  };
  const [title, desc, Icon] = configs[page] || configs['Pedidos'];
  return <main className="page"><section className="page-title"><div><p className="eyebrow">GESTÃO</p><h1>{title}</h1><p>{desc}</p></div><button className="primary"><Plus size={17}/> Adicionar</button></section><section className="card module-card"><div className="module-icon"><Icon size={26}/></div><div><h2>{page} no MVP</h2><p>Este módulo já está preparado na navegação. A próxima sprint conecta banco, regras e integrações reais.</p></div>{page==='Checkouts'&&<div className="module-actions"><button className="primary" onClick={onEdit}><Settings size={16}/> Personalizar checkout</button><button className="secondary" onClick={onCheckout}><Eye size={16}/> Abrir checkout</button></div>} {page==='Integrações'&&<div className="integration-grid"><div><span className="shopify-icon">S</span><b>Shopify</b><Badge tone="orange">Sandbox</Badge></div><div><Zap/><b>Gateway Pix</b><Badge tone="orange">Sandbox</Badge></div></div>}</section></main>;
}

function Checkout({ onBack, customConfig }) {
  const [step, setStep] = useState(1); const [bump, setBump] = useState(false); const [copied, setCopied] = useState(false); const [form, setForm] = useState({name:'',email:'',cpf:'',phone:''});
  const total = useMemo(()=>148 + (bump?29.9:0),[bump]);
  const valid = form.name && form.email.includes('@') && form.cpf && form.phone;
  const advance = e => { e.preventDefault(); if(valid) setStep(2); };
  const copy = () => { navigator.clipboard?.writeText('00020126580014BR.GOV.BCB.PIX0136solid-demo-pix-code'); setCopied(true); setTimeout(()=>setCopied(false),1800); };
  const cfg = customConfig || (()=>{try{return {...defaultCheckoutConfig,...JSON.parse(localStorage.getItem('solid-checkout-published-v1'))}}catch{return defaultCheckoutConfig}})();
  return <div className="checkout-page" style={{'--primary':cfg.primary,'--bg':cfg.pageBg,'--surface':cfg.cardBg,'--text':cfg.textColor,'--border':cfg.borderColor,'--radius':`${cfg.radius}px`,fontFamily:cfg.font}}><header className="checkout-head"><Logo merchantPreview/><button className="ghost" onClick={onBack}><PanelLeftClose size={17}/> Voltar ao painel</button><div className="secure"><ShieldCheck size={19}/><span><b>Pagamento seguro</b><small>Ambiente protegido</small></span></div></header><div className="checkout-shell">
    <section className="checkout-content"><div className="steps"><div className="step active"><span>{step>1?<Check size={15}/>:1}</span><b>Identificação</b></div><i/><div className={`step ${step>=2?'active':''}`}><span>2</span><b>Pagamento</b></div></div>
      {step===1 ? <form onSubmit={advance}><p className="checkout-kicker">FINALIZE SEU PEDIDO</p><h1>Você está a um passo.</h1><p className="lead">Preencha seus dados para gerar o Pix. Leva menos de um minuto.</p><div className="form-card"><div className="section-title"><span><Users size={18}/></span><div><h2>Seus dados</h2><p>Usaremos apenas para processar o pedido.</p></div></div><label>Nome completo<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Como aparece no documento" required/></label><div className="field-grid"><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="voce@email.com" required/></label><label>Celular / WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(11) 99999-9999" required/></label></div><label>CPF ou CNPJ<input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} placeholder="000.000.000-00" required/></label></div><label className={`bump ${bump?'selected':''}`}><input type="checkbox" checked={bump} onChange={e=>setBump(e.target.checked)}/><span className="check-box">{bump&&<Check size={14}/>}</span><div className="bump-icon"><Zap size={21}/></div><div><Badge tone="purple">OFERTA ESPECIAL</Badge><h3>Adicione o Guia de Resultados</h3><p>Estratégias práticas para aproveitar ainda mais seu produto.</p></div><strong>+ {money.format(29.9)}</strong></label><button className="checkout-cta" type="submit" disabled={!valid}>Gerar Pix agora <ArrowRight size={19}/></button><p className="privacy"><ShieldCheck size={14}/> Seus dados estão protegidos e não serão compartilhados.</p></form> : <div className="pix-card"><div className="success-icon"><CheckCircle2 size={30}/></div><p className="checkout-kicker">PEDIDO CRIADO</p><h1>Escaneie e pague com Pix</h1><p className="lead">Abra o app do seu banco e escaneie o QR Code.</p><div className="qr"><div className="fake-qr">{Array.from({length:121}).map((_,i)=><i key={i} className={(i*7+i%3)%5<2?'dark':''}/>)}</div></div><strong className="pix-value">{money.format(total)}</strong><p className="expire"><Clock3 size={16}/> Expira em <b>14:59</b></p><button className="copy-btn" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Código copiado!':'Copiar código Pix'}</button><button className="ghost wide" onClick={()=>setStep(1)}>Voltar e editar dados</button></div>}
    </section>
    <aside className="order-summary"><div className="product"><div className="product-image"><Box size={38}/></div><div><Badge tone="purple">MAIS VENDIDO</Badge><h2>Kit Performance</h2><p>O pacote completo para acelerar seus resultados.</p></div></div><div className="summary-row"><span>Kit Performance <small>Quantidade: 1</small></span><b>{money.format(148)}</b></div>{bump&&<div className="summary-row bump-row"><span>Guia de Resultados</span><b>{money.format(29.9)}</b></div>}<div className="divider"/><div className="summary-row total"><span>Total</span><strong>{money.format(total)}</strong></div><div className="pix-only"><div className="pix-logo">pix</div><div><b>Pagamento via Pix</b><small>Aprovação em poucos segundos</small></div></div><div className="guarantees"><span><ShieldCheck size={17}/> Compra 100% segura</span><span><Zap size={17}/> Liberação imediata</span><span><CreditCard size={17}/> Sem taxas adicionais</span></div></aside>
  </div><footer className="checkout-footer"><Logo merchantPreview/><span>© 2026 Pirat Checkout. Todos os direitos reservados.</span><div><a href="#">Privacidade</a><a href="#">Termos</a></div></footer></div>;
}


function SessionConflict() {
  return <main className="session-conflict" role="alert">
    <div className="session-conflict-card">
      <div className="session-conflict-icon"><ShieldCheck size={30}/></div>
      <p className="eyebrow">SESSÃO PROTEGIDA</p>
      <h1>A conta desta aba mudou</h1>
      <p>Outra aba deste navegador entrou em uma conta diferente. Esta página foi bloqueada antes de acessar ou alterar dados da outra conta.</p>
      <button className="primary" onClick={() => { clearTabUser(); window.location.reload(); }}>Usar a conta conectada agora</button>
      <small>Para manter administrador e cliente abertos ao mesmo tempo, use uma janela anônima ou perfis diferentes do Chrome.</small>
    </div>
  </main>;
}

export default function App() {
  const { theme } = useAppTheme();
  return <div className="pirat-app-theme" data-theme={theme}><AdminApplication/></div>;
}

function AdminApplication(){
  const closeSidebar = useCallback(() => setSidebar(false), []);
  const [sidebar,setSidebar]=useState(false); const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>localStorage.getItem('solid-sidebar-collapsed-v1')==='true'); const [page,setPage]=useState(()=>window.location.hash.startsWith('#/cli') ? 'Configurações' : window.location.hash === '#/admin/users' ? 'Usuários' : window.location.hash.startsWith('#/integrations')?'Integrações':'Início'); const [checkout,setCheckout]=useState(false); const [editor,setEditor]=useState(false); const [previewConfig,setPreviewConfig]=useState(null); const [apiStatus,setApiStatus]=useState('checking'); const [searchOpen,setSearchOpen]=useState(false);
  const [auth,setAuth]=useState({status:'checking',user:null,csrfToken:null});
  const [supportExpired,setSupportExpired]=useState(false);
  const support=auth.support;
  useEffect(()=>{const expire=()=>setSupportExpired(true);window.addEventListener('solid:support-expired',expire);const timer=support ? setTimeout(expire,Math.max(0,new Date(support.expiresAt).getTime()-Date.now())) : null;return()=>{window.removeEventListener('solid:support-expired',expire);if(timer)clearTimeout(timer)}},[support]);
  useEffect(()=>{document.body.classList.toggle('support-active',Boolean(support));return()=>document.body.classList.remove('support-active')},[support]);
  const [sessionConflict,setSessionConflict]=useState(false);
  const [stores,setStores]=useState([]); const [storesStatus,setStoresStatus]=useState('idle'); const [storeBusy,setStoreBusy]=useState(false);
  const [activation,setActivation]=useState(null);
  useEffect(()=>{let active=true; getApiHealth().then(()=>active&&setApiStatus('online')).catch(()=>active&&setApiStatus('offline')); getSession().then(result=>{if(!active)return;bindTabToUser(result.user.publicId || result.user.id);setAuth({status:'authenticated',user:result.user,csrfToken:result.csrfToken,support:result.support})}).catch(error=>{if(!active)return;if(hasSupportSession()){setSupportExpired(true);return}if(error?.code==='SESSION_CONTEXT_CHANGED')setSessionConflict(true);else setAuth({status:'anonymous',user:null,csrfToken:null})}); return()=>{active=false}},[]);
  useEffect(()=>{const conflict=()=>setSessionConflict(true);window.addEventListener('solid:session-conflict',conflict);const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;channel?.addEventListener('message',event=>{const current=auth.user?.publicId||auth.user?.id;if(event.data?.type==='auth-logged-out'){if(hasSupportSession()){setSupportExpired(true);return}clearTabUser();setSessionConflict(false);setAuth({status:'anonymous',user:null,csrfToken:null});setStores([]);setCheckout(false);setEditor(false);window.history.replaceState({},'', '/#/login');return}if(auth.status==='authenticated'&&event.data?.type==='auth-changed'&&event.data.userId&&event.data.userId!==(auth.support?.actorPublicId || current))setSessionConflict(true)});const verify=()=>{if(document.visibilityState==='visible'&&auth.status==='authenticated')getSession().catch(()=>{})};window.addEventListener('focus',verify);document.addEventListener('visibilitychange',verify);return()=>{window.removeEventListener('solid:session-conflict',conflict);window.removeEventListener('focus',verify);document.removeEventListener('visibilitychange',verify);channel?.close()}},[auth.status,auth.user,auth.support?.actorPublicId]);
  useEffect(()=>{if(auth.status!=='authenticated'){setStoresStatus('idle');return}let active=true;setStoresStatus('loading');getStores().then(result=>{if(!active)return;setStores(result.items);setStoresStatus('ready')}).catch(()=>{if(!active)return;setApiStatus('offline');setStoresStatus('error')});return()=>{active=false}},[auth.status]);
  useEffect(()=>{const refresh=event=>{if(event?.detail)setActivation(event.detail);getStores().then(result=>setStores(result.items)).catch(()=>{})};window.addEventListener('solid:onboarding-updated',refresh);return()=>window.removeEventListener('solid:onboarding-updated',refresh)},[]);
  useEffect(()=>{if(auth.status!=='authenticated'){setActivation(null);return}const store=stores.find(item=>item.active);if(!store){setActivation(null);return}if(store.onboardingCompleted){setActivation({completed:true,missing:[]});return}let current=true;setActivation(null);getSettings().then(result=>current&&setActivation(result.activation||null)).catch(()=>current&&setActivation(null));return()=>{current=false}},[auth.status,stores]);
  useEffect(()=>{const navigate=event=>typeof event.detail==='string'&&setPage(event.detail);window.addEventListener('solid:navigate',navigate);return()=>window.removeEventListener('solid:navigate',navigate)},[]);
  useEffect(()=>localStorage.setItem('solid-sidebar-collapsed-v1',String(sidebarCollapsed)),[sidebarCollapsed]);
  useEffect(()=>{const openSearch=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(value=>!value)}};window.addEventListener('keydown',openSearch);return()=>window.removeEventListener('keydown',openSearch)},[]);
  function finishLogin(result){const userId=result.user.publicId||result.user.id;bindTabToUser(userId);const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;channel?.postMessage({type:'auth-changed',userId});channel?.close();setAuth({status:'authenticated',user:result.user,csrfToken:result.csrfToken});window.history.replaceState({},'', '/');}
  async function handleLogin(email,password){const result=await login(email,password);if(!result.mfaRequired)finishLogin(result);return result;}
  async function handleMfaLogin(challengeToken,code,authCsrfToken){const result=await completeMfaLogin(challengeToken,code,authCsrfToken);finishLogin(result);return result;}
  async function handlePasswordReset(token,newPassword){
    await resetPassword(token,newPassword);
    clearTabUser();
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;
    channel?.postMessage({type:'auth-logged-out'});
    channel?.close();
    setAuth({status:'anonymous',user:null,csrfToken:null});
    setStores([]);
    setCheckout(false);
    setEditor(false);
  }
  async function handleLogout(){if(support){document.querySelector('.support-banner button')?.click();return}let pushSubscription=null;try{pushSubscription=await currentWebPushSubscription();await logout(auth.csrfToken,pushSubscription?.endpoint);}finally{await disableWebPushOnThisDevice(pushSubscription).catch(()=>{});clearTabUser();const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;channel?.postMessage({type:'auth-logged-out'});channel?.close();setSessionConflict(false);setAuth({status:'anonymous',user:null,csrfToken:null});setStores([]);setCheckout(false);setEditor(false);window.history.replaceState({},'', '/#/login');}}
  async function handleSelectStore(storeId){setStoreBusy(true);try{await selectStore(storeId,auth.csrfToken);setStores(current=>current.map(store=>({...store,active:store.publicId===storeId})));setPage('Início');}finally{setStoreBusy(false)}}
  async function handleCreateStore(name){setStoreBusy(true);try{const result=await createStore(name,auth.csrfToken);setStores(current=>[...current.map(store=>({...store,active:false})),result.store]);setPage('Início');}finally{setStoreBusy(false)}}
  async function handleArchiveStore(storeId){setStoreBusy(true);try{await archiveStore(storeId,auth.csrfToken);const result=await getStores();setStores(result.items);setPage('Início');}finally{setStoreBusy(false)}}
  if(supportExpired) return <SupportExpired/>;
  if(sessionConflict && hasSupportSession()) return <SupportExpired/>;
  if(window.location.hash.startsWith('#/redefinir-senha')) return <Login onSubmit={handleLogin} onMfaSubmit={handleMfaLogin} onRegister={registerAccount} onVerify={verifyAccount} onForgot={forgotPassword} onReset={handlePasswordReset}/>;
  if(sessionConflict) return <SessionConflict/>;
  if(auth.status==='checking') return <SessionLoading/>;
  if(auth.status==='anonymous'){return <Login onSubmit={handleLogin} onMfaSubmit={handleMfaLogin} onRegister={registerAccount} onVerify={verifyAccount} onForgot={forgotPassword} onReset={handlePasswordReset}/>;}
  if(window.location.hash==='#/login')window.history.replaceState({},'', '/');
  const supportBanner=support ? <SupportBanner support={support} user={auth.user} csrfToken={auth.csrfToken}/> : null;
  if(editor) return <SupportContext.Provider value={support}>{supportBanner}<Suspense fallback={<SessionLoading/>}><CheckoutEditor onBack={()=>setEditor(false)} onPreview={cfg=>{setPreviewConfig(cfg);setCheckout(true);setEditor(false)}}/></Suspense></SupportContext.Provider>;
  if(checkout) return <>{supportBanner}<Checkout customConfig={previewConfig} onBack={()=>{setCheckout(false);setPreviewConfig(null)}}/></>;
  const activeStore=stores.find(store=>store.active);
  const pageAllowed=(!platformPagePermission[page] || canPlatformPage(auth.user,page)) && (!support || canSupportPage(support, page));
  const pageContent=!pageAllowed ? <main className="page"><h1>Acesso indisponível</h1><p>Esta área não faz parte das permissões do seu acesso.</p></main> : page==='Equipe e permissões' ? <PlatformTeamPage csrfToken={auth.csrfToken} operator={auth.user}/> : page==='Histórico de acessos' ? <AccessAuditPage/> : page==='Usuários' ? <AdminUsersPage csrfToken={auth.csrfToken} operator={auth.user}/> : storesStatus==='loading'||storesStatus==='idle'?<SessionLoading/>:storesStatus==='error'?<StoresUnavailable/>:storesStatus==='ready'&&!activeStore&&!canAccessWithoutActiveStore(page,canPlatformPage(auth.user,page))?support && support.mode !== 'FULL_ACCESS' ? <main className="page"><h1>Esta conta ainda não possui loja.</h1></main> : <FirstStoreSetup onCreate={handleCreateStore} busy={storeBusy}/>:page==='Início'?<Dashboard setPage={setPage} storeKey={activeStore?.publicId}/>:page==='Novidades'?<NewsRoadmapPage csrfToken={auth.csrfToken}/>:page==='Análises'?<AnalyticsPage storeKey={activeStore?.publicId}/>:page==='Pedidos'?<OrdersPage storeKey={activeStore?.publicId} csrfToken={auth.csrfToken}/>:page==='Carrinhos'?<AbandonedCartsPage storeKey={activeStore?.publicId} csrfToken={auth.csrfToken}/>:page==='ChromaSense'?<ChromaSensePage storeKey={activeStore?.publicId}/>:page==='Webhooks'?<WebhooksPage storeKey={activeStore?.publicId} csrfToken={auth.csrfToken}/>:page==='Meu plano'?<BillingPage csrfToken={auth.csrfToken}/>:page==='Configurações'?<AccountSettings key={activeStore?.publicId} csrfToken={auth.csrfToken} support={support}/>:page==='Operações'?<AdminOperationsPage csrfToken={auth.csrfToken} writable={canPlatform(auth.user,'operations.manage')}/>:page==='Conteúdo'?<AdminContentPage csrfToken={auth.csrfToken}/>:page==='Integrações'?<ShopifyIntegration csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>:page==='Gateways'?<GatewaysPage csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>:page==='Domínios'?<DomainsPage csrfToken={auth.csrfToken}/>:page==='Produtos'?<ProductsPage csrfToken={auth.csrfToken} storeKey={activeStore?.publicId} onOpenIntegrations={()=>setPage('Integrações')}/>:page==='Order bumps'?<OrderBumpsPage csrfToken={auth.csrfToken}/>:page==='Cupons'?<CouponsPage csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>:<SimplePage page={page} onCheckout={()=>setCheckout(true)} onEdit={()=>setEditor(true)} csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>;
  const pendingCount=activation?.missing?.length;
  return <SupportContext.Provider value={support}><div className={`app solid-admin ${sidebarCollapsed?'sidebar-collapsed':''}`}>{supportBanner}{!support && <><InstallAppPrompt/><PiratAssistant key={`${auth.user?.publicId || auth.user?.id}:${activeStore?.publicId || "none"}`} csrfToken={auth.csrfToken}/></>}<CommandPalette open={searchOpen} onClose={()=>setSearchOpen(false)} onNavigate={setPage} user={auth.user} support={support}/><Sidebar open={sidebar} collapsed={sidebarCollapsed} onToggleCollapsed={()=>setSidebarCollapsed(value=>!value)} onClose={closeSidebar} page={page} setPage={setPage} user={auth.user} onLogout={handleLogout} stores={stores} storeBusy={storeBusy} onSelectStore={handleSelectStore} onCreateStore={handleCreateStore} onArchiveStore={handleArchiveStore} support={support}/><div className="main-shell"><Header support={support} page={page} toggleSidebar={()=>setSidebar(true)} apiStatus={apiStatus} csrfToken={auth.csrfToken} storeKey={activeStore?.publicId} onNavigate={setPage} onOpenSearch={()=>setSearchOpen(true)}/>{!support&&!auth.user?.platformAdmin&&activeStore&&!activeStore.onboardingCompleted&&page==='Início'&&<aside className="store-activation-banner" role="status"><ShieldCheck size={22}/><div><b>Conclua o cadastro para ativar a loja</b><span>{Number.isInteger(pendingCount)?`${pendingCount===1?'Falta 1 informação':`Faltam ${pendingCount} informações`}. `:'Existem informações pendentes. '}Você pode explorar o painel, mas publicar checkouts e receber pagamentos só será liberado após concluir os dados da loja e do responsável.</span></div><button type="button" onClick={()=>setPage('Configurações')}>Continuar cadastro <ArrowRight size={16}/></button></aside>}{support && <p className="support-readonly-note">{support.mode === 'FULL_ACCESS' ? 'Acesso completo: configurações e operações da loja liberadas, com registro no histórico. Senha e autenticador pertencem ao titular.' : support.mode === 'READ_ONLY' ? 'Consulta: alterações estão bloqueadas.' : 'Manutenção: edições de catálogo, checkouts, fretes e cupons estão liberadas.'}</p>}<PageErrorBoundary routeKey={`${activeStore?.publicId || 'store'}:${page}`} onHome={()=>setPage('Início')}><Suspense fallback={<SessionLoading/>}>{pageContent}</Suspense></PageErrorBoundary></div></div></SupportContext.Provider>
}
