import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { setPlatformAdmin } from './admin-support-api';

export default function PlatformAdminDialog({ user, csrfToken, onClose, onSaved }) {
  const dialog = useRef(null), errorRef = useRef(null), submitting = useRef(false);
  const [password, setPassword] = useState(''), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const enabled = !user.platformAdmin;
  useEffect(() => { const element = dialog.current, previous = document.activeElement; element.showModal(); return () => { element.close(); previous?.focus?.(); }; }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    if (!password) return setError('Confirme sua senha de administrador para continuar.');
    if (code && !/^\d{6}$/.test(code)) return setError('O código do autenticador deve ter 6 números.');
    submitting.current = true; setBusy(true); setError('');
    try {
      await setPlatformAdmin(user.publicId, { enabled, currentPassword: password, code }, csrfToken);
      onSaved(enabled);
    } catch (cause) { setError(cause.message || 'Não foi possível alterar o acesso.'); setPassword(''); setCode(''); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} className="platform-dialog" aria-labelledby="admin-access-title" onCancel={event => { if (submitting.current) event.preventDefault(); else onClose(); }}>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <header><div><p className="eyebrow">ACESSO À PLATAFORMA</p><h2 id="admin-access-title">{enabled ? 'Tornar administrador' : 'Remover administrador'}</h2></div><button type="button" className="icon-btn" aria-label="Fechar alteração de acesso" disabled={busy} onClick={onClose}><X size={20}/></button></header>
      <p><strong>{user.name}</strong><br/>{user.email}</p>
      <p>{enabled ? 'Esta pessoa terá acesso a todos os clientes, às configurações da plataforma e à gestão de outros administradores.' : 'Esta pessoa perderá o acesso à administração da plataforma. A conta de cliente será mantida.'}</p>
      <p>As sessões atuais dessa pessoa serão encerradas. A alteração ficará registrada no histórico.</p>
      {error && <p ref={errorRef} role="alert" tabIndex={-1} className="admin-users-error">{error}</p>}
      <label>Sua senha de administrador<input type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/></label>
      <label>Código do autenticador, se ativado<input inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)}/></label>
      <footer><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Confirmando...' : enabled ? 'Confirmar administrador' : 'Confirmar remoção'}</button></footer>
    </form>
  </dialog>;
}
