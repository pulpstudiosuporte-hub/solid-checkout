import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import Turnstile, { turnstileEnabled } from './Turnstile';

export default function Login({ onSubmit, onMfaSubmit, onRegister, onVerify, onForgot, onReset }) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const urlToken = urlParams.get('token'); const urlVerificationEmail = urlParams.get('email'); const urlVerificationCode = urlParams.get('code');
  const resetRoute = window.location.hash.startsWith('#/redefinir-senha');
  const automaticVerification = React.useMemo(() => resetRoute ? null : urlToken ? { token: urlToken } : urlVerificationEmail && urlVerificationCode ? { email: urlVerificationEmail, code: urlVerificationCode } : null, [resetRoute, urlToken, urlVerificationEmail, urlVerificationCode]);
  const [mode, setMode] = useState(resetRoute ? 'reset' : automaticVerification ? 'verify' : window.location.hash.startsWith('#/cadastro') ? 'register' : 'login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [terms, setTerms] = useState(false);
  const [mfaCode, setMfaCode] = useState(''); const [mfaChallenge, setMfaChallenge] = useState(null); const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationEmail, setVerificationEmail] = useState(urlVerificationEmail || ''); const [emailCode, setEmailCode] = useState((urlVerificationCode || '').replace(/\D/g, '').slice(0, 6));
  const [turnstileToken, setTurnstileToken] = useState(''); const [turnstileReset, setTurnstileReset] = useState(0);
  const verificationStarted = React.useRef(false);

  React.useEffect(() => { if (mode !== 'verify' || !automaticVerification || verificationStarted.current) return; verificationStarted.current = true; setLoading(true); onVerify(automaticVerification).then(() => { setEmail(urlVerificationEmail || ''); setNotice('E-mail confirmado. Sua conta e sua loja já estão liberadas para entrar.'); setMode('login'); window.history.replaceState({}, '', '/#/login'); }).catch(requestError => setError(requestError?.message || 'O código é inválido ou expirou.')).finally(() => setLoading(false)); }, [automaticVerification, mode, onVerify, urlVerificationEmail]);

  async function submit(event) {
    event.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      if (mode === 'register') { await onRegister(name.trim(), email.trim(), password, turnstileToken); setVerificationEmail(email.trim()); setEmailCode(''); setPassword(''); setMode('verify'); setNotice('Enviamos um código de 6 dígitos para o seu e-mail. Ele é válido por 30 minutos.'); window.history.replaceState({}, '', '/#/verificar-email'); return; }
      if (mode === 'verify') { await onVerify({ email: verificationEmail.trim(), code: emailCode }); setEmail(verificationEmail.trim()); setNotice('E-mail confirmado. Sua conta e sua loja já estão liberadas para entrar.'); setMode('login'); setEmailCode(''); window.history.replaceState({}, '', '/#/login'); return; }
      if (mode === 'forgot') { await onForgot(email.trim()); setNotice('Se o e-mail estiver cadastrado, enviaremos um link válido por 20 minutos.'); return; }
      if (mode === 'reset') { if (password !== confirmPassword) throw new Error('As senhas não coincidem.'); await onReset(urlToken, password); setNotice('Senha redefinida. Entre com sua nova senha.'); setPassword(''); setConfirmPassword(''); setMode('login'); window.history.replaceState({}, '', '/#/login'); return; }
      if (mode === 'mfa') { await onMfaSubmit(mfaChallenge.challengeToken, mfaCode, mfaChallenge.authCsrfToken); return; }
      const result = await onSubmit(email.trim(), password);
      if (result?.mfaRequired) { setMfaChallenge(result); setPassword(''); setMode('mfa'); }
    } catch (requestError) {
      if (requestError?.status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
      else if (requestError?.code === 'ACCOUNT_PENDING') setError('Confirme seu e-mail para liberar a conta.');
      else if (requestError?.code === 'CODE_INVALID') setError('Código inválido ou expirado. Solicite um novo cadastro para receber outro código.');
      else if (requestError?.code === 'MFA_CODE_INVALID') setError('Código inválido. Confira o autenticador ou use um código de recuperação.');
      else if (requestError?.code === 'MFA_CHALLENGE_INVALID') { setError('O acesso expirou. Digite sua senha novamente.'); setMode('login'); setMfaChallenge(null); }
      else if (requestError?.status === 401) setError(mode === 'mfa' ? 'Código inválido.' : 'E-mail ou senha inválidos.');
      else if (requestError?.code === 'BOT_CHALLENGE_FAILED') setError(requestError.message);
      else setError('Não foi possível entrar agora. Verifique sua conexão e tente novamente.');
      if (mode === 'register') { setTurnstileToken(''); setTurnstileReset(value => value + 1); }
    } finally { setLoading(false); }
  }

  const changeMode = next => { setMode(next); setError(''); setNotice(''); setMfaChallenge(null); setMfaCode(''); setEmailCode(''); setPassword(''); setConfirmPassword(''); if (next === 'register') { setTurnstileToken(''); setTurnstileReset(value => value + 1); } window.history.replaceState({}, '', next === 'register' ? '/#/cadastro' : next === 'forgot' ? '/#/esqueci-senha' : '/#/login'); };
  return <main className="login-page">
    <section className="login-brand-panel" aria-label="SOLID Checkout">
      <div className="login-brand"><img src="/brand/solid-wordmark-light.png" alt="SOLID"/></div>
      <div className="login-message"><span className="login-kicker"><ShieldCheck size={16}/> Operação protegida</span><h1>Seu checkout.<br/>Sua operação.<br/><em>Sob controle.</em></h1><p>Acompanhe pedidos, personalize sua experiência e gerencie suas vendas em um só lugar.</p></div>
      <div className="login-security"><LockKeyhole size={18}/><span><strong>Acesso seguro</strong><small>Sessão criptografada e protegida</small></span></div>
    </section>
    <section className="login-form-panel"><form className="login-card" onSubmit={submit} noValidate>
      <div className="login-mobile-brand"><img src="/brand/solid-wordmark-dark.png" alt="SOLID"/></div>
      <p className="eyebrow">{mode === 'register' ? 'COMECE AGORA' : mode === 'verify' ? 'VALIDAÇÃO SEGURA' : mode === 'mfa' ? 'SEGUNDO FATOR' : mode === 'forgot' || mode === 'reset' ? 'RECUPERAÇÃO SEGURA' : 'PAINEL ADMINISTRATIVO'}</p>
      <h2>{mode === 'register' ? 'Crie sua conta' : mode === 'verify' ? 'Confirme seu e-mail' : mode === 'mfa' ? 'Confirme que é você' : mode === 'forgot' ? 'Recupere seu acesso' : mode === 'reset' ? 'Crie uma nova senha' : 'Bem-vindo de volta'}</h2>
      <p className="login-subtitle">{mode === 'forgot' ? 'Informe seu e-mail. A resposta não revela se ele está cadastrado.' : mode === 'reset' ? 'O link só pode ser usado uma vez e expira em 20 minutos.' : mode === 'register' ? 'Confirme seu e-mail e entre imediatamente, sem aprovação manual.' : mode === 'verify' ? 'Digite o código de 6 dígitos enviado ao seu e-mail.' : mode === 'mfa' ? 'Digite o código do aplicativo autenticador ou um código de recuperação.' : 'Entre com os dados cadastrados para acessar sua loja.'}</p>
      {mode === 'register' && <><label htmlFor="register-name">Nome completo</label><input id="register-name" aria-label="Nome completo" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" required disabled={loading}/></>}
      {(mode === 'login' || mode === 'register' || mode === 'forgot') && <>
        <label htmlFor="login-email">E-mail</label><input id="login-email" aria-label="E-mail" type="email" inputMode="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@empresa.com" required disabled={loading}/>
        {mode !== 'forgot' && <><div className="password-label"><label htmlFor="login-password">Senha</label>{mode === 'login' && <button className="login-help" type="button" onClick={() => changeMode('forgot')}>Esqueci minha senha</button>}</div><div className="password-field"><input id="login-password" aria-label="Senha" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite sua senha" required disabled={loading}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></>}
        {mode === 'register' && <p className={`password-requirement ${password.length >= 14 ? 'valid' : ''}`}>{password.length >= 14 ? <CheckCircle2 size={15}/> : <LockKeyhole size={15}/>} {password.length >= 14 ? 'Senha segura para continuar' : `Use pelo menos 14 caracteres (${password.length}/14)`}</p>}
        {mode === 'register' && <label className="signup-terms"><input type="checkbox" aria-label="Aceitar os Termos de Uso e a Política de Privacidade" checked={terms} onChange={event => setTerms(event.target.checked)}/><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label>}
        {mode === 'register' && <Turnstile action="register" onToken={setTurnstileToken} resetKey={turnstileReset}/>}
      </>}
      {mode === 'reset' && <><label htmlFor="reset-password">Nova senha</label><div className="password-field"><input id="reset-password" aria-label="Nova senha" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={14}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Mostrar ou ocultar senha">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div><label htmlFor="reset-confirm">Confirmar nova senha</label><input id="reset-confirm" aria-label="Confirmar nova senha" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={14}/></>}
      {mode === 'verify' && !automaticVerification && <><label htmlFor="verification-email">E-mail</label><input id="verification-email" aria-label="E-mail de verificação" type="email" inputMode="email" autoComplete="email" value={verificationEmail} onChange={event => setVerificationEmail(event.target.value)} placeholder="voce@empresa.com" required disabled={loading}/><label htmlFor="verification-code">Código de confirmação</label><input id="verification-code" aria-label="Código de confirmação" className="mfa-code-input" inputMode="numeric" autoComplete="one-time-code" value={emailCode} onChange={event => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required disabled={loading}/></>}
      {mode === 'mfa' && <><label htmlFor="mfa-code">Código de segurança</label><input id="mfa-code" aria-label="Código de segurança" autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value.toUpperCase())} placeholder="000000 ou código de recuperação" required disabled={loading}/><button className="login-help" type="button" onClick={() => changeMode('login')}>Voltar para o login</button></>}
      {error && <div className="login-error" role="alert">{error}</div>}{notice && <div className="login-notice" role="status"><CheckCircle2 size={18}/>{notice}</div>}
      {(!automaticVerification || mode !== 'verify') && <button className="login-submit" type="submit" disabled={loading || (mode === 'verify' ? !verificationEmail || emailCode.length !== 6 : mode === 'mfa' ? mfaCode.trim().length < 6 : mode === 'reset' ? password.length < 14 || password !== confirmPassword : !email || (mode !== 'forgot' && password.length < (mode === 'register' ? 14 : 1)) || mode === 'register' && (!name || !terms || turnstileEnabled && !turnstileToken))}>{loading ? <><LoaderCircle className="spin" size={19}/> Aguarde...</> : <>{mode === 'register' ? 'Criar minha conta' : mode === 'verify' ? 'Confirmar e liberar acesso' : mode === 'mfa' ? 'Validar e entrar' : mode === 'forgot' ? 'Enviar link seguro' : mode === 'reset' ? 'Salvar nova senha' : 'Entrar no painel'} <ArrowRight size={19}/></>}</button>}
      {mode === 'verify' && automaticVerification && loading && <div className="login-help"><LoaderCircle className="spin" size={20}/> Validando...</div>}
      {mode === 'verify' && !automaticVerification && <p className="login-help">Não recebeu ou digitou o e-mail errado? <button type="button" onClick={() => changeMode('register')}>Voltar e reenviar</button></p>}
      {mode !== 'mfa' && mode !== 'verify' && <p className="login-help">{mode === 'register' ? <>Já possui uma conta? <button type="button" onClick={() => changeMode('login')}>Entrar</button></> : mode === 'forgot' || mode === 'reset' ? <button type="button" onClick={() => changeMode('login')}>Voltar para o login</button> : <>Ainda não possui conta? <button type="button" onClick={() => changeMode('register')}>Criar conta</button></>}</p>}
    </form></section>
  </main>;
}

export function SessionLoading() { return <main className="session-loading" role="status"><img className="loading-symbol" src="/brand/solid-symbol.png" alt=""/><LoaderCircle className="spin" size={24}/><span>Validando acesso seguro...</span></main>; }
