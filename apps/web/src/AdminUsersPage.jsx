import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, RefreshCw, ShieldCheck, UserX, Users } from 'lucide-react';
import { approveAdminUser, blockAdminUser, getAdminUsers } from './api';

const tabs = [['PENDING', 'Pendentes'], ['APPROVED', 'Aprovados'], ['REJECTED', 'Bloqueados']];
const statusLabel = { PENDING: 'Aguardando aprovação', APPROVED: 'Ativo', REJECTED: 'Bloqueado' };

export default function AdminUsersPage({ csrfToken }) {
  const [status, setStatus] = useState('PENDING');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setData(await getAdminUsers(status)); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [status]);

  const approve = async user => { setBusy(user.publicId); setError(''); try { await approveAdminUser(user.publicId, csrfToken); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(''); } };
  const block = async user => { if (!window.confirm(`Bloquear a conta de ${user.name}? Todas as sessões serão encerradas.`)) return; setBusy(user.publicId); setError(''); try { await blockAdminUser(user.publicId, csrfToken); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(''); } };

  return <main className="page admin-users-page">
    <section className="page-title"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Usuários da plataforma</h1><p>Aprove novos lojistas e bloqueie acessos com segurança.</p></div><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={17}/> Atualizar</button></section>
    {error && <div className="admin-users-error" role="alert">{error}</div>}
    <section className="card admin-users-card">
      <div className="admin-users-tabs">{tabs.map(([value, label]) => <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div>
      {loading ? <div className="admin-users-state"><LoaderCircle className="spin"/><span>Carregando usuários...</span></div> : !data?.users?.length ? <div className="admin-users-state"><Users/><b>Nenhum usuário nesta categoria</b><span>Os novos cadastros aparecerão aqui após confirmar o e-mail.</span></div> : <div className="table-wrap"><table className="admin-users-table"><thead><tr><th>Usuário</th><th>Loja</th><th>Cadastro</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.users.map(user => <tr key={user.publicId}><td><div className="admin-user"><span>{user.name.split(' ').slice(0,2).map(part => part[0]).join('').toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div>{user.platformAdmin && <em><ShieldCheck size={13}/> Admin SOLID</em>}</div></td><td>{user.memberships?.map(member => member.store.name).join(', ') || 'Sem loja'}</td><td>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td><td><span className={`admin-status ${user.accountStatus.toLowerCase()}`}>{statusLabel[user.accountStatus]}</span></td><td><div className="admin-user-actions">{user.accountStatus !== 'APPROVED' && <button className="approve" disabled={busy === user.publicId} onClick={() => approve(user)}><Check size={15}/> Aprovar</button>}{user.accountStatus !== 'REJECTED' && !user.platformAdmin && <button className="block" disabled={busy === user.publicId} onClick={() => block(user)}><UserX size={15}/> Bloquear</button>}</div></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
