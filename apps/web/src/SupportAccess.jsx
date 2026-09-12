import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { startSupport, endSupport } from './admin-support-api';
import { bindSupportSession, clearSupportSession } from './api-request';
import { canPlatform } from './platform-access';
import './platform-team.css';

export function returnToAdministration() {
  clearSupportSession();
  window.location.hash = '/admin/users';
  window.location.reload();
}

export function SupportStartModal({ user, operator, csrfToken, onClose }) {
  const dialog = useRef(null);
  const [mode, setMode] = useState('READ_ONLY');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await startSupport(user.publicId, { mode, reason, currentPassword: password, code }, csrfToken);
      bindSupportSession(result.supportToken, result.targetUserId);
      window.location.hash = '';
      window.location.reload();
    } catch (cause) { setError(cause.message); setPassword(''); setCode(''); setBusy(false); }
  };
  return <dialog ref={dialog} className="platform-dialog" aria-labelledby="support-title" onCancel={onClose}>
    <form onSubmit={submit}>
      <header><div><p className="eyebrow">ACESSO DE SUPORTE</p><h2 id="support-title">Ajudar {user.name}</h2><small>{user.email}</small></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar suporte"><X size={20}/></button></header>
      <p>O acesso dura até 30 minutos. Seu nome, o motivo e as ações ficam registrados no histórico.</p>
      <fieldset className="support-modes"><legend>Modo de acesso</legend>
        <label><input type="radio" name="mode" value="READ_ONLY" checked={mode === 'READ_ONLY'} onChange={() => setMode('READ_ONLY')}/><span><b>Consulta</b><small>Visualizar dados e investigar problemas.</small></span></label>
        {canPlatform(operator, 'support.write') && <label><input type="radio" name="mode" value="MAINTENANCE" checked={mode === 'MAINTENANCE'} onChange={() => setMode('MAINTENANCE')}/><span><b>Manutenção</b><small>Editar catálogo, checkouts, fretes e cupons.</small></span></label>}
      </fieldset>
      <label>Motivo do acesso<textarea required minLength={10} maxLength={240} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: chamado 123 — revisar configuração de frete"/></label>
      <label>Sua senha de administrador<input required type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/></label>
      <label>Código do autenticador, se ativado<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value)}/></label>
      {error && <p className="admin-users-error" role="alert">{error}</p>}
      <footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy || reason.trim().length < 10}>{busy ? 'Validando acesso...' : 'Entrar na dashboard'}</button></footer>
    </form>
  </dialog>;
}

export function SupportBanner({ support, user, csrfToken }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stop = async () => {
    setBusy(true); setError('');
    try { await endSupport(csrfToken); returnToAdministration(); }
    catch (cause) { setError(cause.message); setBusy(false); }
  };
  return <aside className="support-banner" aria-label="Acesso de suporte ativo">
    <ShieldCheck size={21}/><div><b>{support.mode === 'MAINTENANCE' ? 'Manutenção' : 'Somente consulta'} · {user.name}</b><small>{support.actorName} · até {new Date(support.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>{error && <span role="alert">{error}</span>}</div>
    <button type="button" onClick={stop} disabled={busy}>{busy ? 'Encerrando...' : 'Encerrar suporte'}</button>
  </aside>;
}

export function SupportExpired() {
  return <main className="first-store-page"><section className="first-store-card"><ShieldCheck size={32}/><h1>Acesso de suporte encerrado</h1><p>O acesso expirou ou deixou de estar disponível. Volte à sua conta para continuar.</p><button className="primary" onClick={returnToAdministration}>Voltar à administração</button></section></main>;
}
