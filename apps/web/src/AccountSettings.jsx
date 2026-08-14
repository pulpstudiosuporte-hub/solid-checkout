import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { changePassword } from './api';

function PasswordInput({ id, label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return <label className="settings-field" htmlFor={id}><span>{label}</span><div className="settings-password"><input id={id} type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} required/><button type="button" onClick={() => setVisible(current => !current)} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>;
}

export default function AccountSettings({ csrfToken }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const valid = form.current && form.next.length >= 14 && form.next === form.confirm;

  async function submit(event) {
    event.preventDefault();
    if (!valid || status.type === 'loading') return;
    setStatus({ type: 'loading', message: '' });
    try {
      await changePassword(form.current, form.next, csrfToken);
      setForm({ current: '', next: '', confirm: '' });
      setStatus({ type: 'success', message: 'Senha alterada. As outras sessões foram desconectadas.' });
    } catch (error) {
      const messages = {
        CURRENT_PASSWORD_INVALID: 'A senha atual está incorreta.',
        PASSWORD_UNCHANGED: 'Escolha uma senha diferente da atual.',
        PASSWORD_INVALID: 'A nova senha deve ter entre 14 e 128 caracteres.',
      };
      setStatus({ type: 'error', message: messages[error?.code] || 'Não foi possível alterar a senha. Tente novamente.' });
    }
  }

  return <main className="page settings-page">
    <section className="page-title"><div><p className="eyebrow">MINHA CONTA</p><h1>Configurações</h1><p>Gerencie a segurança do seu acesso ao SOLID.</p></div></section>
    <section className="settings-grid">
      <form className="card password-card" onSubmit={submit}>
        <div className="settings-heading"><span><KeyRound size={22}/></span><div><h2>Alterar senha</h2><p>Use uma senha exclusiva que você não utiliza em outros serviços.</p></div></div>
        <PasswordInput id="current-password" label="Senha atual" value={form.current} onChange={current => setForm({...form,current})} autoComplete="current-password"/>
        <PasswordInput id="new-password" label="Nova senha" value={form.next} onChange={next => setForm({...form,next})} autoComplete="new-password"/>
        <small className={form.next && form.next.length < 14 ? 'password-rule invalid' : 'password-rule'}>Mínimo de 14 caracteres</small>
        <PasswordInput id="confirm-password" label="Confirmar nova senha" value={form.confirm} onChange={confirm => setForm({...form,confirm})} autoComplete="new-password"/>
        {form.confirm && form.next !== form.confirm && <p className="settings-alert error" role="alert">As senhas não coincidem.</p>}
        {status.message && <p className={`settings-alert ${status.type}`} role="status">{status.type === 'success' && <CheckCircle2 size={17}/>} {status.message}</p>}
        <button className="primary settings-submit" type="submit" disabled={!valid || status.type === 'loading'}>{status.type === 'loading' ? <><LoaderCircle className="spin" size={18}/> Alterando...</> : 'Salvar nova senha'}</button>
      </form>
      <aside className="card security-note"><span><ShieldCheck size={25}/></span><h2>Proteção da conta</h2><p>Ao alterar sua senha, todas as outras sessões abertas serão encerradas. Este dispositivo continuará conectado.</p><ul><li>Não reutilize senhas</li><li>Evite dados pessoais</li><li>Prefira um gerenciador de senhas</li></ul></aside>
    </section>
  </main>;
}
