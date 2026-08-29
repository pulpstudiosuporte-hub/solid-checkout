import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import Turnstile, { turnstileEnabled } from './Turnstile';

export default function Login({ onSubmit, onMfaSubmit, onRegister, onVerify, onForgot, onReset }) {
  const urlToken = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token');
  const resetRoute = window.location.hash.startsWith('#/redefinir-senha');
  const verificationToken = resetRoute ? null : urlToken;
  const [mode, setMode] = useState(resetRoute ? 'reset' : verificationToken ? 'verify' : window.location.hash.startsWith('#/cadastro') ? 'register' : 'login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [terms, setTerms] = useState(false);
  const [mfaCode, setMfaCode] = useState(''); const [mfaChallenge, setMfaChallenge] = useState(null); const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(''); const [turnstileReset, setTurnstileReset] = useState(0);

  React.useEffect(() => { if (mode !== 'verify' || !verificationToken) return; setLoading(true); onVerify(verificationToken).then(() => { setNotice('E-mail confirmado. Seu cadastro foi enviado para aprovação.'); setMode('login'); window.history.replaceState({}, '', '/#/login'); }).catch(requestError => setError(requestError?.message || 'O link é inválido ou expirou.')).finally(() => setLoading(false)); }, []);

  async function submit(event) {
    event.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      if (mode === 'register') { await onRegister(name.trim(), email.trim(), password, turnstileToken); setNotice('Enviamos um link de confirmação para o seu e-mail. Ele é válido por 30 minutos.'); return; }
      if (mode === 'forgot') { await onForgot(email.trim()); setNotice('Se o e-mail estiver cadastrado, enviaremos um link válido por 20 minutos.'); return; }
      if (mode === 'reset') { if (password !== confirmPassword) throw new Error('As senhas não coincidem.'); await onReset(urlToken, password); setNotice('Senha redefinida. Entre com sua nova senha.'); setPassword(''); setConfirmPassword(''); setMode('login'); window.history.replaceState({}, '', '/#/login'); return; }
      if (mode === 'mfa') { await onMfaSubmit(mfaChallenge.challengeToken, mfaCode, mfaChallenge.authCsrfToken); return; }
      const result = await onSubmit(email.trim(), password);
      if (result?.mfaRequired) { setMfaChallenge(result); setPassword(''); setMode('mfa'); }
    } catch (requestError) {
      if (requestError?.status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
      else if (requestError?.code === 'ACCOUNT_PENDING') setError('Sua conta está aguardando aprovação da equipe SOLID.');
      else if (requestError?.code === 'MFA_CODE_INVALID') setError('Código inválido. Confira o autenticador ou use um código de recuperação.');
      else if (requestError?.code === 'MFA_CHALLENGE_INVALID') { setError('O acesso expirou. Digite sua senha novamente.'); setMode('login'); setMfaChallenge(null); }
      else if (requestError?.status === 401) setError(mode === 'mfa' ? 'Código inválido.' : 'E-mail ou senha inválidos.');
      else if (requestError?.code === 'BOT_CHALLENGE_FAILED') setError(requestError.message);
      else setError('Não foi possível entrar agora. Verifique sua conexão e tente novamente.');
      if (mode === 'register') { setTurnstileToken(''); setTurnstileReset(value => value + 1); }
    } finally { setLoading(false); }
  }

  const changeMode = next => { setMode(next); setError(''); setNotice(''); setMfaChallenge(null); setMfaCode(''); setPassword(''); setConfirmPassword(''); window.history.replaceState({}, '', next === 'register' ? '/#/cadastro' : next === 'forgot' ? '/#/esqueci-senha' : '/#/login'); };
  return <main className="login-page">
    <section className="login-brand-panel" aria-label="SOLID Checkout">
      <div className="login-brand"><img src="/brand/solid-wordmark-light.png" alt="SOLID"/></div>
      <div className="login-message"><span className="login-kicker"><ShieldCheck size={16}/> Operação protegida</span><h1>Seu checkout.<br/>Sua operação.<br/><em>Sob controle.</em></h1><p>Acompanhe pedidos, personalize sua experiência e gerencie suas vendas em um só lugar.</p></div>
      <div className="login-security"><LockKeyhole size={18}/><span><strong>Acesso seguro</strong><small>Sessão criptografada e protegida</small></span></div>
    </section>
    <section className="login-form-panel"><form className="login-card" onSubmit={submit} noValidate>
      <div className="login-mobile-brand"><img src="/brand/solid-wordmark-dark.png" alt="SOLID"/></div>
      <p className="eyebrow">{mode === 'register' ? 'COMECE AGORA' : mode === 'verify' ? 'VALIDAÇÃO SEGURA' : mode === 'mfa' ? 'SEGUNDO FATOR' : mode === 'forgot' || mode === 'reset' ? 'RECUPERAÇÃO SEGURA' : 'PAINEL ADMINISTRATIVO'}</p>
      <h2>{mode === 'register' ? 'Crie sua conta' : mode === 'verify' ? 'Confirmando seu e-mail' : mode === 'mfa' ? 'Confirme que é você' : mode === 'forgot' ? 'Recupere seu acesso' : mode === 'reset' ? 'Crie uma nova senha' : 'Bem-vindo de volta'}</h2>
      <p className="login-subtitle">{mode === 'forgot' ? 'Informe seu e-mail. A resposta não revela se ele está cadastrado.' : mode === 'reset' ? 'O link só pode ser usado uma vez e expira em 20 minutos.' : mode === 'register' ? 'Sua primeira loja será criada após confirmar o e-mail.' : mode === 'verify' ? 'Aguarde enquanto validamos seu acesso.' : mode === 'mfa' ? 'Digite o código do aplicativo autenticador ou um código de recuperação.' : 'Entre com os dados cadastrados para acessar sua loja.'}</p>
      {mode === 'register' && <><label htmlFor="register-name">Nome completo</label><input id="register-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" required disabled={loading}/></>}
      {(mode === 'login' || mode === 'register' || mode === 'forgot') && <>
        <label htmlFor="login-email">E-mail</label><input id="login-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@empresa.com" required disabled={loading}/>
        {mode !== 'forgot' && <><div className="password-label"><label htmlFor="login-password">Senha</label>{mode === 'login' && <button className="login-help" type="button" onClick={() => changeMode('forgot')}>Esqueci minha senha</button>}</div><div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite sua senha" required disabled={loading}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></>}
        {mode === 'register' && <p className={`password-requirement ${password.length >= 14 ? 'valid' : ''}`}>{password.length >= 14 ? <CheckCircle2 size={15}/> : <LockKeyhole size={15}/>} {password.length >= 14 ? 'Senha segura para continuar' : `Use pelo menos 14 caracteres (${password.length}/14)`}</p>}
        {mode === 'register' && <label className="signup-terms"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)}/><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label>}
        {mode === 'register' && <Turnstile action="register" onToken={setTurnstileToken} resetKey={turnstileReset}/>}
      </>}
      {mode === 'reset' && <><label htmlFor="reset-password">Nova senha</label><div className="password-field"><input id="reset-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={14}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Mostrar ou ocultar senha">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div><label htmlFor="reset-confirm">Confirmar nova senha</label><input id="reset-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={14}/></>}
      {mode === 'mfa' && <><label htmlFor="mfa-code">Código de segurança</label><input id="mfa-code" autoFocus autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value.toUpperCase())} placeholder="000000 ou código de recuperação" required disabled={loading}/><button className="login-help" type="button" onClick={() => changeMode('login')}>Voltar para o login</button></>}
      {error && <div className="login-error" role="alert">{error}</div>}{notice && <div className="login-notice" role="status"><CheckCircle2 size={18}/>{notice}</div>}
      {mode !== 'verify' && <button className="login-submit" type="submit" disabled={loading || (mode === 'mfa' ? mfaCode.trim().length < 6 : mode === 'reset' ? password.length < 14 || password !== confirmPassword : !email || (mode !== 'forgot' && password.length < (mode === 'register' ? 14 : 1)) || mode === 'register' && (!name || !terms || turnstileEnabled && !turnstileToken))}>{loading ? <><LoaderCircle className="spin" size={19}/> Aguarde...</> : <>{mode === 'register' ? 'Criar minha conta' : mode === 'mfa' ? 'Validar e entrar' : mode === 'forgot' ? 'Enviar link seguro' : mode === 'reset' ? 'Salvar nova senha' : 'Entrar no painel'} <ArrowRight size={19}/></>}</button>}
      {mode === 'verify' && loading && <div className="login-help"><LoaderCircle className="spin" size={20}/> Validando...</div>}
      {mode !== 'mfa' && mode !== 'verify' && <p className="login-help">{mode === 'register' ? <>Já possui uma conta? <button type="button" onClick={() => changeMode('login')}>Entrar</button></> : mode === 'forgot' || mode === 'reset' ? <button type="button" onClick={() => changeMode('login')}>Voltar para o login</button> : <>Ainda não possui conta? <button type="button" onClick={() => changeMode('register')}>Criar conta</button></>}</p>}
    </form></section>
  </main>;
}

export function SessionLoading() { return <main className="session-loading" role="status"><img className="loading-symbol" src="/brand/solid-symbol.png" alt=""/><LoaderCircle className="spin" size={24}/><span>Validando acesso seguro...</span></main>; }
