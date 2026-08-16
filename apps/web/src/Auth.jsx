import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function Login({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError(''); setLoading(true);
    try { await onSubmit(email.trim(), password); }
    catch (requestError) {
      if (requestError?.status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
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
      <p className="eyebrow">PAINEL ADMINISTRATIVO</p><h2>Bem-vindo de volta</h2><p className="login-subtitle">Entre com os dados cadastrados para acessar sua loja.</p>
      <label htmlFor="login-email">E-mail</label><input id="login-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@empresa.com" required disabled={loading}/>
      <div className="password-label"><label htmlFor="login-password">Senha</label></div><div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite sua senha" required disabled={loading}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="login-submit" type="submit" disabled={loading || !email || !password}>{loading ? <><LoaderCircle className="spin" size={19}/> Entrando...</> : <>Entrar no painel <ArrowRight size={19}/></>}</button>
      <p className="login-help">Problemas para acessar? Fale com o administrador da sua conta.</p>
    </form></section>
  </main>;
}

export function SessionLoading() { return <main className="session-loading" role="status"><img className="loading-symbol" src="/brand/solid-symbol.png" alt=""/><LoaderCircle className="spin" size={24}/><span>Validando acesso seguro...</span></main>; }
