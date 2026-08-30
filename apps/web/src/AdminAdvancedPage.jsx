import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Database, Gauge, KeyRound, LoaderCircle, RefreshCw, ServerCog, ShieldCheck, Store, Users } from 'lucide-react';
import { getAdminAdvancedOverview } from './api';

const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
const date = value => new Date(value).toLocaleString('pt-BR');
const auditLabel = value => String(value || '').replaceAll('.', ' · ').replaceAll('_', ' ');

export default function AdminAdvancedPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async signal => {
    setLoading(true); setError('');
    try { setData(await getAdminAdvancedOverview(signal)); }
    catch (requestError) { if (requestError.name !== 'AbortError') setError(requestError.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const metrics = data?.metrics;
  const state = data?.status || 'operational';
  return <main className="page advanced-admin-page">
    <section className="page-title advanced-admin-title">
      <div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Central avançada</h1><p>Saúde, segurança e operação da plataforma em uma única visão.</p></div>
      <button className="secondary" disabled={loading} onClick={() => load()}><RefreshCw size={17} className={loading ? 'spin' : ''}/> Atualizar</button>
    </section>
    {error && <div className="admin-users-error" role="alert">{error}</div>}
    {loading && !data ? <section className="card advanced-admin-loading"><LoaderCircle className="spin"/><b>Consolidando indicadores...</b></section> : data && <>
      <section className={`advanced-admin-status ${state}`} role="status">
        {state === 'operational' ? <CheckCircle2/> : <AlertTriangle/>}
        <div><b>{state === 'operational' ? 'Plataforma operacional' : state === 'critical' ? 'Ação crítica necessária' : 'Pontos de atenção detectados'}</b><span>Atualizado em {date(data.generatedAt)}. Nenhuma credencial ou informação sensível é exibida aqui.</span></div>
      </section>
      <section className="advanced-admin-kpis">
        <article className="card"><span className="advanced-icon purple"><Users/></span><div><small>Usuários</small><b>{metrics.users.total}</b><em>{metrics.users.pending} aguardando aprovação</em></div></article>
        <article className="card"><span className="advanced-icon blue"><Store/></span><div><small>Lojas ativas</small><b>{metrics.commerce.stores}</b><em>{metrics.commerce.publishedCheckouts}/{metrics.commerce.checkouts} checkouts publicados</em></div></article>
        <article className="card"><span className="advanced-icon green"><Activity/></span><div><small>Receita processada · 30 dias</small><b>{money(metrics.commerce.revenueCents30d)}</b><em>{metrics.commerce.paidPayments} pagamentos confirmados</em></div></article>
        <article className="card"><span className="advanced-icon orange"><Clock3/></span><div><small>Pix pendentes</small><b>{metrics.commerce.pendingPayments}</b><em>{metrics.commerce.paymentAttempts} tentativas em 30 dias</em></div></article>
      </section>
      <section className="advanced-admin-grid">
        <article className="card advanced-panel"><header><span><ShieldCheck/> Segurança</span><small>Visão consolidada</small></header><div className="advanced-stat-list"><div><span>Sessões ativas</span><b>{metrics.security.activeSessions}</b></div><div><span>Adoção de MFA</span><b>{metrics.security.mfaAdoptionPercent}%</b></div><div><span>Eventos de auditoria · 24h</span><b>{metrics.security.auditEvents24h}</b></div><div><span>Contas bloqueadas</span><b>{metrics.users.blocked}</b></div><div><span>E-mails não verificados</span><b>{metrics.users.emailUnverified}</b></div></div></article>
        <article className="card advanced-panel"><header><span><ServerCog/> Filas e entregas</span><button onClick={() => onNavigate('Operações')}>Abrir operações <ArrowRight size={15}/></button></header><div className="advanced-queue"><div className="waiting"><b>{metrics.operations.pending}</b><span>Aguardando</span></div><div className="processing"><b>{metrics.operations.processing}</b><span>Processando</span></div><div className="failed"><b>{metrics.operations.dead}</b><span>Interrompidas</span></div></div></article>
        <article className="card advanced-panel"><header><span><Database/> Integrações</span><small>Conexões verificadas</small></header><div className="advanced-stat-list"><div><span>Shopify conectadas</span><b>{metrics.integrations.shopifyConnected}</b></div><div><span>Shopify exigindo reconexão</span><b>{metrics.integrations.shopifyAttention}</b></div><div><span>Gateways ativos</span><b>{metrics.integrations.gatewayConnected}</b></div><div><span>Domínios protegidos</span><b>{metrics.integrations.activeDomains}</b></div></div></article>
        <article className="card advanced-panel advanced-quick"><header><span><Gauge/> Atalhos administrativos</span></header><button onClick={() => onNavigate('Usuários')}><span className="advanced-icon purple"><KeyRound/></span><span><b>Gerenciar usuários</b><small>Aprovação, bloqueio e taxas especiais</small></span><ArrowRight/></button><button onClick={() => onNavigate('Operações')}><span className="advanced-icon orange"><ServerCog/></span><span><b>Tratar falhas</b><small>Retentativas e integrações interrompidas</small></span><ArrowRight/></button></article>
      </section>
      <section className="card advanced-audit"><header><div><b>Atividade administrativa recente</b><small>Trilha segura sem metadados sensíveis</small></div></header>{!data.recentAudit.length ? <p className="advanced-empty">Nenhuma atividade recente.</p> : <div className="table-wrap"><table><thead><tr><th>Ação</th><th>Origem</th><th>Alvo</th><th>Data</th></tr></thead><tbody>{data.recentAudit.map(event => <tr key={event.id}><td><b>{auditLabel(event.action)}</b></td><td>{event.actorType}</td><td>{event.targetType}{event.targetId ? ` · ${event.targetId.slice(-12)}` : ''}</td><td>{date(event.createdAt)}</td></tr>)}</tbody></table></div>}</section>
    </>}
  </main>;
}
