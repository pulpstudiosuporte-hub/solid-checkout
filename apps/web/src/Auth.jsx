import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function Login({ onSubmit, onRegister, onVerify }) {
  const verificationToken = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token');
  const [mode, setMode] = useState(verificationToken ? 'verify' : window.location.hash.startsWith('#/cadastro') ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [terms, setTerms] = useState(false);

  React.useEffect(() => { if (mode !== 'verify' || !verificationToken) return; setLoading(true); onVerify(verificationToken).then(() => { setNotice('E-mail confirmado. Seu cadastro foi enviado para aprovação.'); setMode('login'); window.history.replaceState({}, '', '/#/login'); }).catch(requestError => setError(requestError?.message || 'O link é inválido ou expirou.')).finally(() => setLoading(false)); }, []);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError(''); setLoading(true);
    try {
      if (mode === 'register') { await onRegister(name.trim(), email.trim(), password); setNotice('Enviamos um link de confirmação para o seu e-mail. Ele é válido por 30 minutos.'); return; }
      await onSubmit(email.trim(), password);
    } catch (requestError) {
      if (requestError?.status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
      else if (requestError?.code === 'ACCOUNT_PENDING') setError('Sua conta está aguardando aprovação da equipe SOLID.');
      else if (requestError?.status === 401) setError('E-mail ou senha inválidos.');
      else setError('Não foi possível entrar agora. Verifique sua conexão e tente novamente.');
    } finally { setLoading(false); }
  }

  return <main className="login-page">
    <section className="login-brand-panel" aria-label="SOLID Checkout">
      <div className="login-brand"><img src="/brand/solid-wordmark-light.png" alt="SOLID"/></div>
      <div className="login-message"><span className="login-kicker"><ShieldCheck size={16}/> Operação protegida</span><h1>Seu checkout.<br/>Sua operação.<br/><em>Sob controle.</em></h1><p>Acompanhe pedidos, personalize sua experiência e gerencie suas vendas em um só lugar.</p></div>
      <div className="login-security"><LockKeyhole size={18}/><span><strong>Acesso seguro</strong><small>Sessão criptografada e protegida</small></span></div>
    </section>
    <section className="login-form-panel"><form className="login-card" onSubmit={submit} noValidate>
      <div className="login-mobile-brand"><img src="/brand/solid-wordmark-dark.png" alt="SOLID"/></div>
      <p className="eyebrow">{mode === 'register' ? 'COMECE AGORA' : mode === 'verify' ? 'VALIDAÇÃO SEGURA' : 'PAINEL ADMINISTRATIVO'}</p><h2>{mode === 'register' ? 'Crie sua conta' : mode === 'verify' ? 'Confirmando seu e-mail' : 'Bem-vindo de volta'}</h2><p className="login-subtitle">{mode === 'register' ? 'Sua primeira loja será criada após confirmar o e-mail.' : mode === 'verify' ? 'Aguarde enquanto validamos seu acesso.' : 'Entre com os dados cadastrados para acessar sua loja.'}</p>
      {mode === 'register' && <><label htmlFor="register-name">Nome completo</label><input id="register-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" required disabled={loading}/></>}
      {mode !== 'verify' && <>
      <label htmlFor="login-email">E-mail</label><input id="login-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@empresa.com" required disabled={loading}/>
      <div className="password-label"><label htmlFor="login-password">Senha</label></div><div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite sua senha" required disabled={loading}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>
      {mode === 'register' && <p className={`password-requirement ${password.length >= 14 ? 'valid' : ''}`} aria-live="polite">{password.length >= 14 ? <CheckCircle2 size={15}/> : <LockKeyhole size={15}/>} {password.length >= 14 ? 'Senha segura para continuar' : `Use pelo menos 14 caracteres (${password.length}/14)`}</p>}
      {mode === 'register' && <label className="signup-terms"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)}/><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label>}
      </>}
      {error && <div className="login-error" role="alert">{error}</div>}
      {notice && <div className="login-notice" role="status"><CheckCircle2 size={18}/>{notice}</div>}
      {mode !== 'verify' && <button className="login-submit" type="submit" disabled={loading || !email || password.length < (mode === 'register' ? 14 : 1) || mode === 'register' && (!name || !terms)}>{loading ? <><LoaderCircle className="spin" size={19}/> Aguarde...</> : <>{mode === 'register' ? 'Criar minha conta' : 'Entrar no painel'} <ArrowRight size={19}/></>}</button>}
      {mode === 'verify' && loading && <div className="login-help"><LoaderCircle className="spin" size={20}/> Validando...</div>}
      <p className="login-help">{mode === 'register' ? <>Já possui uma conta? <button type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); window.history.replaceState({},'', '/#/login'); }}>Entrar</button></> : <>Ainda não possui conta? <button type="button" onClick={() => { setMode('register'); setError(''); setNotice(''); window.history.replaceState({},'', '/#/cadastro'); }}>Criar conta</button></>}</p>
    </form></section>
  </main>;
}

export function SessionLoading() { return <main className="session-loading" role="status"><img className="loading-symbol" src="/brand/solid-symbol.png" alt=""/><LoaderCircle className="spin" size={24}/><span>Validando acesso seguro...</span></main>; }
