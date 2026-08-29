import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, BarChart3, Box, Check, CheckCircle2, ChevronDown,
  CircleDollarSign, Clock3, Copy, CreditCard, Eye, FileText,
  Globe2, Home, LayoutTemplate, Link2, Menu, Package, PanelLeftClose, PanelLeftOpen, Plug, Plus,
  Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Store,
  Tag, TrendingUp, Truck, Users, X, Zap, LogOut, ServerCog
} from 'lucide-react';
import './styles.css';
import './admin-design.css';
import CheckoutEditor, { defaultCheckoutConfig } from './CheckoutEditor';
import { archiveStore, bindTabToUser, clearTabUser, completeMfaLogin, createStore, forgotPassword, getApiHealth, getSession, getStores, login, logout, registerAccount, resetPassword, selectStore, verifyAccount } from './api';
import { currentWebPushSubscription, disableWebPushOnThisDevice } from './web-push';
import Login, { SessionLoading } from './Auth';
import DashboardPage from './DashboardPage';
import AccountSettings from './AccountSettings';
import StoreSwitcher from './StoreSwitcher';
import ShopifyIntegration from './ShopifyIntegration';
import ProductsPage from './ProductsPage';
import CheckoutsPage from './CheckoutsPage';
import LogisticsPage from './LogisticsPage';
import GatewaysPage from './GatewaysPage';
import PublicCheckout, { PublicCheckoutErrorBoundary, PublicSessionCheckout } from './PublicCheckout';
import PageErrorBoundary from './PageErrorBoundary';
import OrdersPage, { RecentOrders } from './OrdersPage';
import OrderBumpsPage from './OrderBumpsPage';
import DomainsPage from './DomainsPage';
import AdminUsersPage from './AdminUsersPage';
import CouponsPage from './CouponsPage';
import NotificationCenter from './NotificationCenter';
import AdminOperationsPage from './AdminOperationsPage';
import InstallAppPrompt from './InstallAppPrompt';
import BillingPage from './BillingPage';
import AbandonedCartsPage from './AbandonedCartsPage';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const navGroups = [
  { label: 'Gestão', items: [
    { label: 'Visão geral', icon: Home }, { label: 'Pedidos', icon: ShoppingBag },
    { label: 'Carrinhos', icon: ShoppingCart }, { label: 'Produtos', icon: Package },
  ]},
  { label: 'Checkout', items: [
    { label: 'Checkouts', icon: LayoutTemplate }, { label: 'Domínios', icon: Globe2 },
    { label: 'Logística', icon: Truck }, { label: 'Gateways', icon: CreditCard },
  ]},
  { label: 'Marketing', items: [
    { label: 'Order bumps', icon: Sparkles }, { label: 'Cupons', icon: Tag },
    { label: 'Marketing', icon: BarChart3 }, { label: 'Integrações', icon: Plug },
  ]},
];

function Logo({ compact = false }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}><img className="brand-symbol" src="/brand/solid-symbol.png" alt=""/>{!compact && <img className="brand-wordmark" src="/brand/solid-wordmark-dark.png" alt="SOLID"/>}</div>;
}

function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}>{children}</span>; }

const roleLabels = { OWNER: 'Proprietário', ADMIN: 'Administrador', ANALYST: 'Analista' };

function Sidebar({ open, collapsed, onClose, onToggleCollapsed, page, setPage, user, onLogout, stores, storeBusy, onSelectStore, onCreateStore, onArchiveStore }) {
  const activeRole = stores.find(store => store.active)?.role;
  const groups = user?.platformAdmin ? [...navGroups, { label: 'Administração', items: [{ label: 'Usuários', icon: Users }, { label: 'Operações', icon: ServerCog }] }] : navGroups;
  const navigate = label => { setPage(label); onClose(); };
  return <>
    {open && <button className="backdrop" onClick={onClose} aria-label="Fechar menu" />}
    <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-head"><Logo compact={collapsed}/><button className="icon-btn sidebar-collapse" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button><button className="icon-btn mobile-only" onClick={onClose}><X size={19}/></button></div>
      <StoreSwitcher stores={stores} busy={storeBusy} onSelect={onSelectStore} onCreate={onCreateStore} onArchive={onArchiveStore}/>
      <nav aria-label="Menu principal">
        {groups.map(group => <section className="nav-group" key={group.label}><small className="nav-title">{group.label}</small>{group.items.map(item => <button key={item.label} title={collapsed ? item.label : undefined} className={page === item.label ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.label)}><item.icon size={18}/><span>{item.label}</span>{item.count && <em>{item.count}</em>}</button>)}</section>)}
      </nav>
      <div className="side-bottom">
        <small className="nav-title">Conta</small>
        <button title={collapsed ? 'Meu plano' : undefined} className={page === 'Meu plano' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Meu plano')}><CreditCard size={18}/><span>Meu plano</span></button>
        <button title={collapsed ? 'Configurações' : undefined} className={page === 'Configurações' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Configurações')}><Settings size={18}/><span>Configurações</span></button>
        <div className="profile"><div className="avatar">{user?.name?.split(' ').slice(0,2).map(part=>part[0]).join('').toUpperCase() || 'AD'}</div><span><b>{user?.name || 'Usuário'}</b><small>{roleLabels[activeRole] || 'Membro'}</small></span><button className="icon-btn" onClick={onLogout} aria-label="Sair do painel" title="Sair"><LogOut size={17}/></button></div>
      </div>
    </aside>
  </>;
}

function Header({ toggleSidebar, apiStatus, csrfToken, storeKey, onNavigate, page }) {
  const statusLabel = apiStatus === 'online' ? 'API conectada' : apiStatus === 'offline' ? 'API indisponível' : 'Conectando à API';
  return <header className="topbar">
    <button className="icon-btn menu-btn" onClick={toggleSidebar} aria-label="Abrir menu"><Menu size={21}/></button>
    <div className="topbar-context"><small>Painel</small><strong>{page}</strong></div>
    <div className="search"><Search size={18}/><input aria-label="Buscar" placeholder="Buscar no painel..."/><kbd>Ctrl K</kbd></div>
    <div className="top-actions"><span className={`sandbox api-status ${apiStatus}`} role="status"><span/> {statusLabel}</span><NotificationCenter csrfToken={csrfToken} storeKey={storeKey} onNavigate={onNavigate}/></div>
  </header>;
}

function Metric({ icon: Icon, label, value, delta, tone }) {
  return <div className="metric card"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small><TrendingUp size={13}/> {delta} <i>vs. período anterior</i></small></div></div>;
}

function Dashboard(props) {
  return <DashboardPage {...props}/>;
}

function LegacyDashboard({ setPage, storeKey }) {
  const [period, setPeriod] = useState('Últimos 7 dias');
  return <main className="page dashboard">
    <section className="page-title"><div><p className="eyebrow">VISÃO GERAL</p><h1>Olá, Ragnar <span>👋</span></h1><p>Acompanhe o desempenho da sua operação hoje.</p></div><div className="title-actions"><select value={period} onChange={e=>setPeriod(e.target.value)}><option>Hoje</option><option>Últimos 7 dias</option><option>Este mês</option></select><button className="secondary"><FileText size={17}/> Exportar</button></div></section>
    <section className="metrics">
      <Metric icon={CircleDollarSign} label="Receita confirmada" value="R$ 12.480,90" delta="18,2%" tone="purple"/>
      <Metric icon={ShoppingCart} label="Pedidos pagos" value="84" delta="12,5%" tone="blue"/>
      <Metric icon={TrendingUp} label="Conversão" value="4,8%" delta="0,7%" tone="green"/>
      <Metric icon={Clock3} label="Aguardando Pix" value="12" delta="3 novos" tone="orange"/>
    </section>
    <section className="grid-main">
      <div className="card chart-card"><div className="card-head"><div><h2>Receita e pedidos</h2><p>Valores confirmados no período</p></div><div className="legend"><span><i className="dot purple"/>Receita</span><span><i className="dot pale"/>Pedidos</span></div></div><div className="chart-wrap"><div className="y-labels"><span>R$ 4k</span><span>R$ 3k</span><span>R$ 2k</span><span>R$ 1k</span><span>R$ 0</span></div><div className="chart"><svg viewBox="0 0 680 230" preserveAspectRatio="none" aria-label="Gráfico de receita"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357e9" stopOpacity=".22"/><stop offset="1" stopColor="#7357e9" stopOpacity="0"/></linearGradient></defs><g className="gridlines"><line x1="0" y1="15" x2="680" y2="15"/><line x1="0" y1="65" x2="680" y2="65"/><line x1="0" y1="115" x2="680" y2="115"/><line x1="0" y1="165" x2="680" y2="165"/><line x1="0" y1="215" x2="680" y2="215"/></g><path className="area" d="M0,184 C55,172 72,139 113,145 S176,170 226,118 S295,142 340,94 S410,132 453,79 S520,99 567,54 S627,78 680,29 L680,215 L0,215Z"/><path className="line" d="M0,184 C55,172 72,139 113,145 S176,170 226,118 S295,142 340,94 S410,132 453,79 S520,99 567,54 S627,78 680,29"/></svg><div className="x-labels"><span>07 Ago</span><span>08 Ago</span><span>09 Ago</span><span>10 Ago</span><span>11 Ago</span><span>12 Ago</span><span>Hoje</span></div></div></div></div>
      <div className="card progress-card"><div className="card-head"><div><h2>Comece por aqui</h2><p>Prepare sua loja para vender</p></div><Badge tone="purple">3 de 5</Badge></div><div className="progress"><span style={{width:'60%'}}/></div>{[
        ['Criar sua loja Solid', true], ['Adicionar primeiro produto', true], ['Personalizar o checkout', true], ['Conectar gateway Pix', false], ['Publicar e testar', false]
      ].map(([t, done], i)=><button key={t} className={`task ${done?'done':''}`} onClick={()=>!done && setPage(i===3?'Integrações':'Checkouts')}><span>{done?<Check size={15}/>:i+1}</span><b>{t}</b>{!done&&<ArrowRight size={16}/>}</button>)}</div>
    </section>
    <RecentOrders storeKey={storeKey} onViewAll={()=>setPage('Pedidos')}/>
  </main>;
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
  return <div className="checkout-page" style={{'--primary':cfg.primary,'--bg':cfg.pageBg,'--surface':cfg.cardBg,'--text':cfg.textColor,'--border':cfg.borderColor,'--radius':`${cfg.radius}px`,fontFamily:cfg.font}}><header className="checkout-head"><Logo/><button className="ghost" onClick={onBack}><PanelLeftClose size={17}/> Voltar ao painel</button><div className="secure"><ShieldCheck size={19}/><span><b>Pagamento seguro</b><small>Ambiente protegido</small></span></div></header><div className="checkout-shell">
    <section className="checkout-content"><div className="steps"><div className="step active"><span>{step>1?<Check size={15}/>:1}</span><b>Identificação</b></div><i/><div className={`step ${step>=2?'active':''}`}><span>2</span><b>Pagamento</b></div></div>
      {step===1 ? <form onSubmit={advance}><p className="checkout-kicker">FINALIZE SEU PEDIDO</p><h1>Você está a um passo.</h1><p className="lead">Preencha seus dados para gerar o Pix. Leva menos de um minuto.</p><div className="form-card"><div className="section-title"><span><Users size={18}/></span><div><h2>Seus dados</h2><p>Usaremos apenas para processar o pedido.</p></div></div><label>Nome completo<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Como aparece no documento" required/></label><div className="field-grid"><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="voce@email.com" required/></label><label>Celular / WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(11) 99999-9999" required/></label></div><label>CPF ou CNPJ<input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} placeholder="000.000.000-00" required/></label></div><label className={`bump ${bump?'selected':''}`}><input type="checkbox" checked={bump} onChange={e=>setBump(e.target.checked)}/><span className="check-box">{bump&&<Check size={14}/>}</span><div className="bump-icon"><Zap size={21}/></div><div><Badge tone="purple">OFERTA ESPECIAL</Badge><h3>Adicione o Guia de Resultados</h3><p>Estratégias práticas para aproveitar ainda mais seu produto.</p></div><strong>+ {money.format(29.9)}</strong></label><button className="checkout-cta" type="submit" disabled={!valid}>Gerar Pix agora <ArrowRight size={19}/></button><p className="privacy"><ShieldCheck size={14}/> Seus dados estão protegidos e não serão compartilhados.</p></form> : <div className="pix-card"><div className="success-icon"><CheckCircle2 size={30}/></div><p className="checkout-kicker">PEDIDO CRIADO</p><h1>Escaneie e pague com Pix</h1><p className="lead">Abra o app do seu banco e escaneie o QR Code.</p><div className="qr"><div className="fake-qr">{Array.from({length:121}).map((_,i)=><i key={i} className={(i*7+i%3)%5<2?'dark':''}/>)}</div></div><strong className="pix-value">{money.format(total)}</strong><p className="expire"><Clock3 size={16}/> Expira em <b>14:59</b></p><button className="copy-btn" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Código copiado!':'Copiar código Pix'}</button><button className="ghost wide" onClick={()=>setStep(1)}>Voltar e editar dados</button></div>}
    </section>
    <aside className="order-summary"><div className="product"><div className="product-image"><Box size={38}/></div><div><Badge tone="purple">MAIS VENDIDO</Badge><h2>Kit Performance</h2><p>O pacote completo para acelerar seus resultados.</p></div></div><div className="summary-row"><span>Kit Performance <small>Quantidade: 1</small></span><b>{money.format(148)}</b></div>{bump&&<div className="summary-row bump-row"><span>Guia de Resultados</span><b>{money.format(29.9)}</b></div>}<div className="divider"/><div className="summary-row total"><span>Total</span><strong>{money.format(total)}</strong></div><div className="pix-only"><div className="pix-logo">pix</div><div><b>Pagamento via Pix</b><small>Aprovação em poucos segundos</small></div></div><div className="guarantees"><span><ShieldCheck size={17}/> Compra 100% segura</span><span><Zap size={17}/> Liberação imediata</span><span><CreditCard size={17}/> Sem taxas adicionais</span></div></aside>
  </div><footer className="checkout-footer"><Logo/><span>© 2026 Solid Commerce. Todos os direitos reservados.</span><div><a href="#">Privacidade</a><a href="#">Termos</a></div></footer></div>;
}

function PublicSessionRoute({ sessionId, urlToken }) {
  const [token] = useState(() => {
    const storageKey = `solid-checkout-session:${sessionId}`;
    if (urlToken) sessionStorage.setItem(storageKey, urlToken);
    return urlToken || sessionStorage.getItem(storageKey) || '';
  });
  useEffect(() => {
    if (urlToken) window.history.replaceState({}, '', `/#/session/${sessionId}`);
  }, [sessionId, urlToken]);
  if (!token) return <div className="public-checkout-state error" role="alert"><ShoppingBag/><b>Sessão indisponível</b><span>Abra novamente o link original do checkout para continuar.</span></div>;
  return <PublicSessionCheckout sessionId={sessionId} token={token}/>;
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

function App(){
  const [sidebar,setSidebar]=useState(false); const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>localStorage.getItem('solid-sidebar-collapsed-v1')==='true'); const [page,setPage]=useState(()=>window.location.hash.startsWith('#/integrations')?'Integrações':'Visão geral'); const [checkout,setCheckout]=useState(false); const [editor,setEditor]=useState(false); const [previewConfig,setPreviewConfig]=useState(null); const [apiStatus,setApiStatus]=useState('checking');
  const [auth,setAuth]=useState({status:'checking',user:null,csrfToken:null});
  const [sessionConflict,setSessionConflict]=useState(false);
  const [stores,setStores]=useState([]); const [storeBusy,setStoreBusy]=useState(false);
  useEffect(()=>{let active=true; getApiHealth().then(()=>active&&setApiStatus('online')).catch(()=>active&&setApiStatus('offline')); getSession().then(result=>{if(!active)return;bindTabToUser(result.user.publicId || result.user.id);setAuth({status:'authenticated',user:result.user,csrfToken:result.csrfToken})}).catch(error=>{if(!active)return;if(error?.code==='SESSION_CONTEXT_CHANGED')setSessionConflict(true);else setAuth({status:'anonymous',user:null,csrfToken:null})}); return()=>{active=false}},[]);
  useEffect(()=>{const conflict=()=>setSessionConflict(true);window.addEventListener('solid:session-conflict',conflict);const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;channel?.addEventListener('message',event=>{const current=auth.user?.publicId||auth.user?.id;if(auth.status==='authenticated'&&event.data?.type==='auth-changed'&&event.data.userId!==current)setSessionConflict(true)});const verify=()=>{if(document.visibilityState==='visible'&&auth.status==='authenticated')getSession().catch(()=>{})};window.addEventListener('focus',verify);document.addEventListener('visibilitychange',verify);return()=>{window.removeEventListener('solid:session-conflict',conflict);window.removeEventListener('focus',verify);document.removeEventListener('visibilitychange',verify);channel?.close()}},[auth.status,auth.user]);
  useEffect(()=>{if(auth.status!=='authenticated')return;let active=true;getStores().then(result=>active&&setStores(result.items)).catch(()=>active&&setApiStatus('offline'));return()=>{active=false}},[auth.status]);
  useEffect(()=>{const navigate=event=>typeof event.detail==='string'&&setPage(event.detail);window.addEventListener('solid:navigate',navigate);return()=>window.removeEventListener('solid:navigate',navigate)},[]);
  useEffect(()=>localStorage.setItem('solid-sidebar-collapsed-v1',String(sidebarCollapsed)),[sidebarCollapsed]);
  const publicMatch = window.location.pathname.match(/^\/c\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/) || window.location.hash.match(/^#\/c\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  const publicSessionMatch = window.location.hash.match(/^#\/session\/([A-Za-z0-9_-]{8,32})/); const publicSessionToken = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token');
  function finishLogin(result){const userId=result.user.publicId||result.user.id;bindTabToUser(userId);const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;channel?.postMessage({type:'auth-changed',userId});channel?.close();setAuth({status:'authenticated',user:result.user,csrfToken:result.csrfToken});window.history.replaceState({},'', '/');}
  async function handleLogin(email,password){const result=await login(email,password);if(!result.mfaRequired)finishLogin(result);return result;}
  async function handleMfaLogin(challengeToken,code,authCsrfToken){const result=await completeMfaLogin(challengeToken,code,authCsrfToken);finishLogin(result);return result;}
  async function handlePasswordReset(token,newPassword){
    await resetPassword(token,newPassword);
    clearTabUser();
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;
    channel?.postMessage({type:'auth-changed',userId:null});
    channel?.close();
    setAuth({status:'anonymous',user:null,csrfToken:null});
    setStores([]);
    setCheckout(false);
    setEditor(false);
  }
  async function handleLogout(){let pushSubscription=null;try{pushSubscription=await currentWebPushSubscription();await logout(auth.csrfToken,pushSubscription?.endpoint);}finally{await disableWebPushOnThisDevice(pushSubscription).catch(()=>{});clearTabUser();const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('solid-auth'):null;channel?.postMessage({type:'auth-changed',userId:null});channel?.close();setAuth({status:'anonymous',user:null,csrfToken:null});setStores([]);setCheckout(false);setEditor(false);window.history.replaceState({},'', '/#/login');}}
  async function handleSelectStore(storeId){setStoreBusy(true);try{await selectStore(storeId,auth.csrfToken);setStores(current=>current.map(store=>({...store,active:store.publicId===storeId})));setPage('Visão geral');}finally{setStoreBusy(false)}}
  async function handleCreateStore(name){setStoreBusy(true);try{const result=await createStore(name,auth.csrfToken);setStores(current=>[...current.map(store=>({...store,active:false})),result.store]);setPage('Visão geral');}finally{setStoreBusy(false)}}
  async function handleArchiveStore(storeId){setStoreBusy(true);try{await archiveStore(storeId,auth.csrfToken);const result=await getStores();setStores(result.items);setPage('Visão geral');}finally{setStoreBusy(false)}}
  if(publicSessionMatch) return <PublicCheckoutErrorBoundary><PublicSessionRoute sessionId={publicSessionMatch[1]} urlToken={publicSessionToken}/></PublicCheckoutErrorBoundary>;
  if(publicMatch) return <PublicCheckoutErrorBoundary><PublicCheckout storeSlug={publicMatch[1]} checkoutSlug={publicMatch[2]}/></PublicCheckoutErrorBoundary>;
  if(window.location.hash.startsWith('#/redefinir-senha')) return <Login onSubmit={handleLogin} onMfaSubmit={handleMfaLogin} onRegister={registerAccount} onVerify={verifyAccount} onForgot={forgotPassword} onReset={handlePasswordReset}/>;
  if(sessionConflict) return <SessionConflict/>;
  if(auth.status==='checking') return <SessionLoading/>;
  if(auth.status==='anonymous'){return <Login onSubmit={handleLogin} onMfaSubmit={handleMfaLogin} onRegister={registerAccount} onVerify={verifyAccount} onForgot={forgotPassword} onReset={handlePasswordReset}/>;}
  if(window.location.hash==='#/login')window.history.replaceState({},'', '/');
  if(editor) return <CheckoutEditor onBack={()=>setEditor(false)} onPreview={cfg=>{setPreviewConfig(cfg);setCheckout(true);setEditor(false)}}/>;
  if(checkout) return <Checkout customConfig={previewConfig} onBack={()=>{setCheckout(false);setPreviewConfig(null)}}/>;
  const activeStore=stores.find(store=>store.active);
  const pageContent=page==='Visão geral'?<Dashboard setPage={setPage} storeKey={activeStore?.publicId}/>:page==='Pedidos'?<OrdersPage storeKey={activeStore?.publicId}/>:page==='Carrinhos'?<AbandonedCartsPage storeKey={activeStore?.publicId} csrfToken={auth.csrfToken}/>:page==='Meu plano'?<BillingPage csrfToken={auth.csrfToken}/>:page==='Configurações'?<AccountSettings csrfToken={auth.csrfToken}/>:page==='Operações'?<AdminOperationsPage csrfToken={auth.csrfToken}/>:page==='Integrações'?<ShopifyIntegration csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>:page==='Gateways'?<GatewaysPage csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>:page==='Domínios'?<DomainsPage csrfToken={auth.csrfToken}/>:page==='Produtos'?<ProductsPage csrfToken={auth.csrfToken} storeKey={activeStore?.publicId} onOpenIntegrations={()=>setPage('Integrações')}/>:page==='Order bumps'?<OrderBumpsPage csrfToken={auth.csrfToken}/>:page==='Cupons'?<CouponsPage csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>:<SimplePage page={page} onCheckout={()=>setCheckout(true)} onEdit={()=>setEditor(true)} csrfToken={auth.csrfToken} storeKey={activeStore?.publicId}/>;
  return <div className={`app ${sidebarCollapsed?'sidebar-collapsed':''}`}><InstallAppPrompt/><Sidebar open={sidebar} collapsed={sidebarCollapsed} onToggleCollapsed={()=>setSidebarCollapsed(value=>!value)} onClose={()=>setSidebar(false)} page={page} setPage={setPage} user={auth.user} onLogout={handleLogout} stores={stores} storeBusy={storeBusy} onSelectStore={handleSelectStore} onCreateStore={handleCreateStore} onArchiveStore={handleArchiveStore}/><div className="main-shell"><Header page={page} toggleSidebar={()=>setSidebar(true)} apiStatus={apiStatus} csrfToken={auth.csrfToken} storeKey={activeStore?.publicId} onNavigate={setPage}/><PageErrorBoundary routeKey={`${activeStore?.publicId || 'store'}:${page}`} onHome={()=>setPage('Visão geral')}>{pageContent}</PageErrorBoundary></div></div>
}

createRoot(document.getElementById('root')).render(<App/>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
