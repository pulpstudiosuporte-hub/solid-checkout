import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, KeyRound, Landmark, LoaderCircle, Save, ShieldCheck, WalletCards } from 'lucide-react';
import { getRoasStatus, getWestPayStatus, saveRoas, saveWestPay } from './api';
import './gateways-page.css';

const providers = {
  ROAS: { name: 'Roas', description: 'Pix com liquidação e reconciliação automática.', icon: Landmark, label: 'Recomendado', fields: ['Secret Key', 'Public Key'] },
  WESTPAY: { name: 'WestPay', description: 'Pix real com confirmação automática de pagamento.', icon: WalletCards, label: 'Alternativa', fields: ['API Key', 'Public Key'] },
};

export default function GatewaysPage({ csrfToken, storeKey }) {
  const [statuses, setStatuses] = useState({ ROAS: { loading: true, connected: false }, WESTPAY: { loading: true, connected: false } });
  const [selected, setSelected] = useState('ROAS');
  const [forms, setForms] = useState({ ROAS: { secretKey: '', publicKey: '' }, WESTPAY: { apiKey: '', publicKey: '' } });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const current = providers[selected]; const Icon = current.icon;
  const primaryActive = statuses.ROAS.connected;
  const load = async () => {
    const [roas, westpay] = await Promise.allSettled([getRoasStatus(), getWestPayStatus()]);
    setStatuses({
      ROAS: roas.status === 'fulfilled' ? { ...roas.value, loading: false } : { loading: false, connected: false },
      WESTPAY: westpay.status === 'fulfilled' ? { ...westpay.value, loading: false } : { loading: false, connected: false },
    });
    const error = [roas, westpay].find(value => value.status === 'rejected'); if (error?.status === 'rejected') setMessage(error.reason.message);
  };
  useEffect(() => { void load(); }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (selected === 'ROAS') await saveRoas(forms.ROAS, csrfToken); else await saveWestPay(forms.WESTPAY, csrfToken);
      setForms(currentForms => ({ ...currentForms, [selected]: selected === 'ROAS' ? { secretKey: '', publicKey: '' } : { apiKey: '', publicKey: '' } }));
      setMessage(`${current.name} conectada e validada com sucesso.${selected === 'ROAS' ? ' Ela agora é a prioridade para novos Pix.' : ''}`);
      await load();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const hasConnection = useMemo(() => Object.values(statuses).some(status => status.connected), [statuses]);
  return <main className="page gateways-page"><section className="page-title"><div><p className="eyebrow">CHECKOUT</p><h1>Gateways</h1><p>Escolha quem recebe os pagamentos desta loja.</p></div>{hasConnection && <span className="connection-pill connected"><CheckCircle2 size={15}/> {primaryActive ? 'Roas ativa' : 'Gateway ativo'}</span>}</section>
    {message && <div className="integration-alert" role="status">{message}</div>}
    <section className="gateway-picker card" aria-label="Gateways disponíveis"><div className="gateway-picker-copy"><h2>Escolha seu gateway Pix</h2><p>A Roas tem prioridade quando estiver conectada. Você pode manter a WestPay como alternativa.</p></div><div className="gateway-cards">{Object.entries(providers).map(([key, provider]) => { const ProviderIcon = provider.icon; const active = statuses[key].connected; return <button type="button" key={key} className={`gateway-choice ${selected === key ? 'selected' : ''}`} onClick={() => { setSelected(key); setMessage(''); }} aria-pressed={selected === key}><span className="gateway-choice-icon"><ProviderIcon size={21}/></span><span className="gateway-choice-content"><b>{provider.name}</b><small>{provider.description}</small></span><span className={`gateway-badge ${key === 'ROAS' ? 'recommended' : ''}`}>{active ? 'Conectada' : provider.label}</span><ChevronRight size={18}/></button>; })}</div></section>
    <section className="gateway-layout"><form className="card gateway-form" onSubmit={submit}><div className="gateway-heading"><span><Icon size={25}/></span><div><div className="gateway-title-line"><h2>{current.name}</h2>{selected === 'ROAS' && <span className="gateway-badge recommended">Principal</span>}</div><p>{current.description}</p></div></div>{statuses[selected].loading ? <div className="integration-loading"><LoaderCircle className="spin"/> Verificando...</div> : <><label>{current.fields[0]}<input type="password" autoComplete="new-password" value={selected === 'ROAS' ? forms.ROAS.secretKey : forms.WESTPAY.apiKey} onChange={event => setForms(value => ({ ...value, [selected]: { ...value[selected], [selected === 'ROAS' ? 'secretKey' : 'apiKey']: event.target.value } }))} placeholder={selected === 'ROAS' ? 'Cole a Secret Key da Roas' : 'live_...'} required/></label><label>{current.fields[1]}<input type="password" autoComplete="new-password" value={forms[selected].publicKey} onChange={event => setForms(value => ({ ...value, [selected]: { ...value[selected], publicKey: event.target.value } }))} placeholder={`Cole a Public Key da ${current.name}`} required/></label><small className="gateway-note"><KeyRound size={14}/> As chaves são validadas antes de serem armazenadas com criptografia AES-GCM.</small><button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Save size={17}/>} {statuses[selected].connected ? 'Atualizar credenciais' : `Conectar ${current.name}`}</button></>}</form><aside className="card gateway-security"><ShieldCheck size={25}/><h2>Pagamento protegido</h2><p>O checkout calcula o total no servidor e envia somente os dados necessários ao gateway selecionado.</p><ul><li>Credenciais nunca chegam ao navegador</li><li>Preço e frete são recalculados no servidor</li><li>Uma tentativa é identificada por sessão</li><li>O status é confirmado diretamente com o gateway</li></ul></aside></section></main>;
}
