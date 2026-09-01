import React, { useEffect, useState } from 'react';
import { BadgePercent, Check, LoaderCircle, RefreshCw, ShieldCheck, UserX, Users, X } from 'lucide-react';
import { approveAdminUser, blockAdminUser, getAdminUsers, updateAdminBillingOverride } from './api';

const tabs = [['APPROVED', 'Ativos'], ['REJECTED', 'Bloqueados']];
const statusLabel = { PENDING: 'Verificação pendente', APPROVED: 'Ativo', REJECTED: 'Bloqueado' };
const planLabel = { START: 'Start', PRIME: 'Prime', ELITE: 'Elite' };
const localDateTime = value => value ? new Date(value).toISOString().slice(0, 16) : '';

function BillingOverrideModal({ user, csrfToken, onClose, onSaved }) {
  const current = user.billing?.override;
  const [form, setForm] = useState({ plan: current?.plan ?? '', feePercent: current?.feeBasisPoints == null ? '' : String(current.feeBasisPoints / 100), monthlyWaived: Boolean(current?.monthlyWaived), expiresAt: localDateTime(current?.expiresAt), reason: current?.reason ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const save = async input => { setSaving(true); setError(''); try { await updateAdminBillingOverride(user.publicId, input, csrfToken); await onSaved(); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSaving(false); } };
  const submit = event => { event.preventDefault(); void save({ plan: form.plan || null, feeBasisPoints: form.feePercent === '' ? null : Math.round(Number(form.feePercent.replace(',', '.')) * 100), monthlyWaived: form.monthlyWaived, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null, reason: form.reason }); };
  const remove = () => { if (window.confirm(`Remover o benefício administrativo de ${user.name}?`)) void save({ plan: null, feeBasisPoints: null, monthlyWaived: false, expiresAt: null, reason: '' }); };
  return <div className="admin-benefit-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="admin-benefit-modal" onSubmit={submit}>
      <header><div><span><BadgePercent size={20}/></span><div><p>BENEFÍCIO ADMINISTRATIVO</p><h2>{user.name}</h2><small>{user.email}</small></div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19}/></button></header>
      <div className="admin-benefit-note">A configuração tem prioridade enquanto estiver válida. A assinatura Stripe não será alterada.</div>
      {error && <div className="admin-users-error" role="alert">{error}</div>}
      <div className="admin-benefit-grid">
        <label>Plano liberado<select name="plan" value={form.plan} onChange={change}><option value="">Manter plano atual</option><option value="START">Start</option><option value="PRIME">Prime</option><option value="ELITE">Elite</option></select></label>
        <label>Taxa por venda (%)<input name="feePercent" value={form.feePercent} onChange={change} inputMode="decimal" placeholder="Ex.: 0 ou 1,5"/></label>
        <label>Validade (opcional)<input type="datetime-local" name="expiresAt" value={form.expiresAt} onChange={change}/></label>
        <label className="admin-benefit-check"><input type="checkbox" name="monthlyWaived" checked={form.monthlyWaived} onChange={change}/><span><b>Isentar mensalidade</b><small>Exige não ter assinatura Stripe ativa.</small></span></label>
      </div>
      <label>Motivo da concessão<textarea name="reason" value={form.reason} onChange={change} maxLength={240} placeholder="Ex.: Parceria com influenciador — contrato 2026"/></label>
      <footer>{user.billing?.sponsored ? <button type="button" className="danger-text" onClick={remove} disabled={saving}>Remover benefício</button> : <span/>}<div><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving && <LoaderCircle size={16} className="spin"/>} Salvar benefício</button></div></footer>
    </form>
  </div>;
}

export default function AdminUsersPage({ csrfToken }) {
  const [status, setStatus] = useState('APPROVED'); const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [benefitUser, setBenefitUser] = useState(null);
  const load = async () => { setLoading(true); setError(''); try { setData(await getAdminUsers(status)); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [status]);
  const approve = async user => { setBusy(user.publicId); setError(''); try { await approveAdminUser(user.publicId, csrfToken); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(''); } };
  const block = async user => { if (!window.confirm(`Bloquear a conta de ${user.name}? Todas as sessões serão encerradas.`)) return; setBusy(user.publicId); setError(''); try { await blockAdminUser(user.publicId, csrfToken); await load(); } catch (requestError) { setError(requestError.message); } finally { setBusy(''); } };
  return <main className="page admin-users-page">
    <section className="page-title"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Usuários da plataforma</h1><p>Gerencie acessos ativos, bloqueios e benefícios comerciais. Novas contas são liberadas ao confirmar o e-mail.</p></div><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={17}/> Atualizar</button></section>
    {error && <div className="admin-users-error" role="alert">{error}</div>}
    <section className="card admin-users-card"><div className="admin-users-tabs">{tabs.map(([value, label]) => <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div>
      {loading ? <div className="admin-users-state"><LoaderCircle className="spin"/><span>Carregando usuários...</span></div> : !data?.users?.length ? <div className="admin-users-state"><Users/><b>Nenhum usuário nesta categoria</b><span>Os novos cadastros aparecerão aqui após confirmar o e-mail.</span></div> : <div className="table-wrap"><table className="admin-users-table"><thead><tr><th>Usuário</th><th>Loja</th><th>Plano e taxa</th><th>Cadastro</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.users.map(user => <tr key={user.publicId}><td><div className="admin-user"><span>{user.name.split(' ').slice(0,2).map(part => part[0]).join('').toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div>{user.platformAdmin && <em><ShieldCheck size={13}/> Admin SOLID</em>}</div></td><td>{user.memberships?.map(member => member.store.name).join(', ') || 'Sem loja'}</td><td><div className="admin-billing-cell"><b>{planLabel[user.billing?.plan] ?? 'Start'} · {((user.billing?.feeBasisPoints ?? 200) / 100).toLocaleString('pt-BR')}%</b>{user.billing?.sponsored && <span>Patrocinado{user.billing.expiresAt ? ` até ${new Date(user.billing.expiresAt).toLocaleDateString('pt-BR')}` : ''}</span>}</div></td><td>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td><td><span className={`admin-status ${user.accountStatus.toLowerCase()}`}>{statusLabel[user.accountStatus]}</span></td><td><div className="admin-user-actions">{!user.platformAdmin && <button className="benefit" onClick={() => setBenefitUser(user)}><BadgePercent size={15}/> Benefício</button>}{user.accountStatus === 'REJECTED' && <button className="approve" disabled={busy === user.publicId} onClick={() => approve(user)}><Check size={15}/> Reativar</button>}{user.accountStatus !== 'REJECTED' && !user.platformAdmin && <button className="block" disabled={busy === user.publicId} onClick={() => block(user)}><UserX size={15}/> Bloquear</button>}</div></td></tr>)}</tbody></table></div>}
    </section>{benefitUser && <BillingOverrideModal user={benefitUser} csrfToken={csrfToken} onClose={() => setBenefitUser(null)} onSaved={load}/>}
  </main>;
}
