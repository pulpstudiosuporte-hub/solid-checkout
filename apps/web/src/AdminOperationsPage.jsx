import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, ServerCog } from 'lucide-react';
import { getAdminOperations, retryAdminOperation } from './api';

const date = value => value ? new Date(value).toLocaleString('pt-BR') : 'Assim que possível';

export default function AdminOperationsPage({ csrfToken }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const load = async signal => { setLoading(true); setError(''); try { setData(await getAdminOperations(signal)); } catch (requestError) { if (requestError.name !== 'AbortError') setError(requestError.message); } finally { if (!signal?.aborted) setLoading(false); } };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  const retry = async job => { setBusy(job.id); setError(''); try { await retryAdminOperation(job.id, csrfToken); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(''); } };
  return <main className="page admin-operations-page">
    <section className="page-title"><div><p className="eyebrow">CONFIABILIDADE</p><h1>Operações</h1><p>Acompanhe entregas externas que precisam de atenção.</p></div><button className="secondary" disabled={loading} onClick={() => load()}><RefreshCw size={17} className={loading ? 'spin' : ''}/> Atualizar</button></section>
    {error && <div className="admin-users-error" role="alert">{error}</div>}
    <section className="operation-metrics"><div className="card"><ServerCog/><span><b>{data?.summary?.total ?? 0}</b><small>Falhas abertas</small></span></div><div className="card retrying"><RefreshCw/><span><b>{data?.summary?.retrying ?? 0}</b><small>Em retentativa</small></span></div><div className="card dead"><AlertTriangle/><span><b>{data?.summary?.dead ?? 0}</b><small>Exigem ação</small></span></div></section>
    <section className="card operation-card">{loading ? <div className="operation-empty"><LoaderCircle className="spin"/><b>Verificando filas...</b></div> : !data?.jobs?.length ? <div className="operation-empty success"><CheckCircle2/><b>Todas as entregas estão saudáveis</b><span>Nenhuma falha de integração ou pós-venda está pendente.</span></div> : <div className="table-wrap"><table className="operation-table"><thead><tr><th>Serviço</th><th>Loja e pedido</th><th>Estado</th><th>Tentativas</th><th>Próxima tentativa</th><th>Erro</th><th>Ação</th></tr></thead><tbody>{data.jobs.map(job => <tr key={job.id}><td><b>{job.provider}</b><small>{job.event}</small></td><td><b>{job.store}</b><small>#{job.order.slice(-8).toUpperCase()}</small></td><td><span className={`operation-status ${job.status.toLowerCase()}`}>{job.status === 'DEAD' ? 'Interrompido' : job.status === 'PROCESSING' ? 'Processando' : 'Aguardando'}</span></td><td>{job.attempts ?? 'Automático'}</td><td>{date(job.nextAttemptAt)}</td><td><span className="operation-error" title={job.error || ''}>{job.error || 'Aguardando nova tentativa'}</span></td><td><button className="secondary" disabled={busy === job.id} onClick={() => retry(job)}>{busy === job.id ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Tentar novamente</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
