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
  const reasonInput = useRef(null), passwordInput = useRef(null), codeInput = useRef(null), errorMessage = useRef(null);
  const submitting = useRef(false);
  const [mode, setMode] = useState('READ_ONLY');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState('');
  const normalizedReason = reason.trim().replace(/\s+/g, ' ');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  useEffect(() => {
    if (!error) return;
    const target = { reason: reasonInput, password: passwordInput, code: codeInput }[invalidField] || errorMessage;
    target.current?.focus();
  }, [error, invalidField]);
  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    const reject = (field, message) => { setInvalidField(field); setError(message); };
    if (normalizedReason.length < 10 || normalizedReason.length > 240) return reject('reason', 'Descreva o motivo do acesso com 10 a 240 caracteres. Ex.: revisar configuração da loja.');
    if (!password || password.length > 128) return reject('password', 'Informe sua senha de administrador para entrar na dashboard do cliente.');
    if (code && !/^\d{6}$/.test(code.trim())) return reject('code', 'Informe os 6 números do autenticador ou deixe vazio se ele não estiver ativado.');
    submitting.current = true; setBusy(true); setError(''); setInvalidField('');
    try {
      const result = await startSupport(user.publicId, { mode, reason: normalizedReason, currentPassword: password, code: code.trim() }, csrfToken);
      if (typeof result?.supportToken !== 'string' || !result.supportToken || typeof result?.targetUserId !== 'string' || !result.targetUserId) throw new Error('A API não confirmou o acesso de suporte. Tente novamente.');
      bindSupportSession(result.supportToken, result.targetUserId);
      window.location.hash = '';
      window.location.reload();
    } catch (cause) { setError(cause.message || 'Não foi possível iniciar o suporte. Tente novamente.'); setPassword(''); setCode(''); setBusy(false); submitting.current = false; }
  };
  return <dialog ref={dialog} className="platform-dialog" aria-labelledby="support-title" onCancel={event => { if (submitting.current) event.preventDefault(); else onClose(); }}>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <header><div><p className="eyebrow">ACESSO DE SUPORTE</p><h2 id="support-title">Ajudar {user.name}</h2><small>{user.email}</small></div><button type="button" className="icon-btn" disabled={busy} onClick={onClose} aria-label="Fechar suporte"><X size={20}/></button></header>
      <p>O acesso dura até 30 minutos. Seu nome, o motivo e as ações ficam registrados no histórico.</p>
      {error && <p ref={errorMessage} id="support-error" className="admin-users-error" role="alert" tabIndex={-1}>{error}</p>}
      <fieldset className="support-modes"><legend>Modo de acesso</legend>
        {operator?.platformAdmin && <label><input type="radio" name="mode" value="FULL_ACCESS" checked={mode === 'FULL_ACCESS'} onChange={() => setMode('FULL_ACCESS')}/><span><b>Acesso completo</b><small>Configurações, pedidos, gateways, integrações, domínios e plano da loja. Ações registradas no histórico.</small></span></label>}
        <label><input type="radio" name="mode" value="READ_ONLY" checked={mode === 'READ_ONLY'} onChange={() => setMode('READ_ONLY')}/><span><b>Consulta</b><small>Visualizar dados e investigar problemas.</small></span></label>
        {canPlatform(operator, 'support.write') && <label><input type="radio" name="mode" value="MAINTENANCE" checked={mode === 'MAINTENANCE'} onChange={() => setMode('MAINTENANCE')}/><span><b>Manutenção</b><small>Editar catálogo, checkouts, fretes e cupons.</small></span></label>}
      </fieldset>
      <label>Motivo do acesso<textarea ref={reasonInput} required minLength={10} maxLength={240} aria-invalid={invalidField === 'reason'} aria-describedby={invalidField === 'reason' ? 'support-reason-help support-error' : 'support-reason-help'} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: chamado 123 — revisar configuração de frete"/></label>
      <small id="support-reason-help">Obrigatório: 10 a 240 caracteres. {normalizedReason.length}/240 preenchidos.</small>
      <label>Sua senha de administrador<input ref={passwordInput} required type="password" autoComplete="current-password" maxLength={128} aria-invalid={invalidField === 'password'} aria-describedby={invalidField === 'password' ? 'support-error' : undefined} value={password} onChange={event => setPassword(event.target.value)}/></label>
      <label>Código do autenticador, se ativado<input ref={codeInput} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={invalidField === 'code'} aria-describedby={invalidField === 'code' ? 'support-error' : undefined} value={code} onChange={event => setCode(event.target.value)}/></label>
      <footer><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Validando acesso...' : 'Entrar na dashboard'}</button></footer>
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
    <ShieldCheck size={21}/><div><b>{support.mode === 'FULL_ACCESS' ? 'Acesso completo' : support.mode === 'MAINTENANCE' ? 'Manutenção' : 'Somente consulta'} · {user.name}</b><small>{support.actorName} · até {new Date(support.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>{error && <span role="alert">{error}</span>}</div>
    <button type="button" onClick={stop} disabled={busy}>{busy ? 'Encerrando...' : 'Encerrar suporte'}</button>
  </aside>;
}

export function SupportExpired() {
  return <main className="first-store-page"><section className="first-store-card"><ShieldCheck size={32}/><h1>Acesso de suporte encerrado</h1><p>O acesso expirou ou deixou de estar disponível. Volte à sua conta para continuar.</p><button className="primary" onClick={returnToAdministration}>Voltar à administração</button></section></main>;
}
