import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, CreditCard, LoaderCircle, QrCode, ReceiptText, ShieldCheck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getBilling, getBillingPix, openBillingPortal, startBillingCheckout, startBillingPix } from './api';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const planBenefits = {
  START: ['1 loja e 1 checkout', 'Domínio próprio', 'Checkout personalizado', 'Integração Pix pela Roas'],
  PRIME: ['Tudo do plano Start', 'Até 5 lojas e checkouts', 'Order bumps e cupons', 'Relatórios avançados'],
  ELITE: ['Tudo do plano Prime', 'Limites ampliados', 'Equipe e integrações avançadas', 'Suporte prioritário'],
};

function PixForm({ form, setForm, busy, submit }) {
  return <form className="billing-pix-form" onSubmit={submit}>
    <h3>Dados para gerar o Pix</h3>
    <label>Nome completo<input required minLength="3" value={form.name} onChange={event => setForm({...form,name:event.target.value})}/></label>
    <label>CPF ou CNPJ<input required inputMode="numeric" value={form.document} onChange={event => setForm({...form,document:event.target.value})}/></label>
    <label>Celular / WhatsApp<input required inputMode="tel" value={form.phone} onChange={event => setForm({...form,phone:event.target.value})}/></label>
    <button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <QrCode/>} Gerar Pix</button>
  </form>;
}

export default function BillingPage({ csrfToken }) {
  const [data, setData] = useState(null); const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null); const [method, setMethod] = useState(''); const [pix, setPix] = useState(null);
  const [pixForm, setPixForm] = useState({ name: '', document: '', phone: '' });
  const load = () => getBilling().then(setData).catch(error => setMessage(error.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!pix?.invoiceId || pix.status !== 'PENDING') return undefined;
    const timer = setInterval(async () => { try { const current = await getBillingPix(pix.invoiceId); setPix(value => ({ ...value, ...current })); if (current.status === 'PAID') { clearInterval(timer); await load(); } } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o pagamento Pix.'); } }, 5000);
    return () => clearInterval(timer);
  }, [pix?.invoiceId, pix?.status]);
  const closeModal = () => { setSelectedPlan(null); setMethod(''); setPix(null); };
  const chooseCard = async () => { try { setBusy('card'); setMessage(''); const result = await startBillingCheckout(selectedPlan, csrfToken); window.location.assign(result.url); } catch (error) { setMessage(error.message); setBusy(''); closeModal(); } };
  const choosePix = async event => { event.preventDefault(); try { setBusy('pix'); setMessage(''); const result = await startBillingPix(selectedPlan, pixForm, csrfToken); if (result.activated) { closeModal(); await load(); } else setPix(result); } catch (error) { setMessage(error.message); } finally { setBusy(''); } };
  const portal = async () => { try { setBusy('portal'); const result = await openBillingPortal(csrfToken); window.location.assign(result.url); } catch (error) { setMessage(error.message); setBusy(''); } };
  if (!data) return <main className="page billing-page"><div className="billing-loading"><LoaderCircle className="spin"/> Carregando seu plano...</div></main>;
  const subscription = data.subscription;
  return <main className="page billing-page">
    <section className="page-title billing-title"><div><p className="eyebrow">CONTA E COBRANÇA</p><h1>Meu plano</h1><p>Escolha entre cobrança automática no cartão ou pagamento mensal via Pix.</p></div>{subscription.cardConfigured && <button className="secondary" onClick={portal} disabled={busy === 'portal'}><CreditCard size={17}/> Gerenciar cartão</button>}</section>
    {message && <p className="settings-alert error">{message}</p>}
    {!data.configured && <div className="billing-warning"><ShieldCheck size={19}/><span>Os meios de cobrança ainda precisam ser configurados no servidor.</span></div>}
    <section className="billing-summary card"><div><span>Plano atual</span><strong>{data.plans.find(plan => plan.id === subscription.plan)?.name}</strong><small className={`billing-status ${subscription.status.toLowerCase()}`}>{subscription.status.replace('_', ' ')}</small></div><div><span>Vendas no ciclo</span><strong>{money.format(data.usage.grossAmountCents / 100)}</strong><small>{data.usage.transactions} pagamentos confirmados</small></div><div><span>Tarifa acumulada</span><strong>{money.format(data.usage.feeAmountCents / 100)}</strong><small>{(subscription.feeBasisPoints / 100).toLocaleString('pt-BR')}% sobre vendas pagas</small></div><div><span>Próxima cobrança</span><strong>{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR') : 'Após ativar'}</strong><small>{subscription.blocked ? 'Conta suspensa por inadimplência' : subscription.paymentProvider === 'ROAS' ? 'Pagamento mensal via Pix' : 'Cobrança automática no cartão'}</small></div></section>
    <section className="billing-plans">{data.plans.map(plan => <article className={`billing-plan card ${plan.id === 'ELITE' ? 'featured' : ''}`} key={plan.id}>{plan.id === 'ELITE' && <em>Recomendado</em>}<h2>{plan.name}</h2><p>{plan.id === 'START' ? 'Comece a vender sem mensalidade.' : plan.id === 'PRIME' ? 'Para operações em crescimento.' : 'Para escalar com mais controle.'}</p><div className="billing-price">{plan.monthlyPriceCents ? <><small>R$</small><strong>{plan.monthlyPriceCents / 100}</strong><span>/mês</span></> : <strong>Grátis</strong>}</div><b className="billing-rate">{(plan.feeBasisPoints / 100).toLocaleString('pt-BR')}% por venda paga</b><ul>{planBenefits[plan.id].map(item => <li key={item}><Check size={16}/>{item}</li>)}</ul><button className={subscription.plan === plan.id && subscription.status === 'ACTIVE' ? 'secondary' : 'primary'} disabled={busy || (subscription.plan === plan.id && subscription.status === 'ACTIVE') || !data.configured} onClick={() => setSelectedPlan(plan.id)}>{subscription.plan === plan.id && subscription.status === 'ACTIVE' ? 'Plano atual' : <>Escolher plano <ArrowRight size={17}/></>}</button></article>)}</section>
    <section className="billing-explainer card"><ReceiptText size={22}/><div><h2>Como a cobrança funciona</h2><p>Registramos somente pagamentos confirmados. No cartão, a Stripe faz a recorrência automática. No Pix, você paga mensalmente pela Roas. Reembolsos viram crédito.</p></div></section>
    {selectedPlan && <div className="billing-modal-backdrop"><section className="billing-modal card" role="dialog" aria-modal="true" aria-labelledby="billing-method-title"><button className="billing-modal-close" onClick={closeModal} aria-label="Fechar"><X/></button><h2 id="billing-method-title">Como deseja pagar?</h2><p>Plano {data.plans.find(plan => plan.id === selectedPlan)?.name}</p>{!method && !pix && <div className="billing-methods"><button type="button" onClick={chooseCard} disabled={!data.paymentMethods?.card || busy}><CreditCard/><strong>Cartão</strong><span>Recorrência automática pela Stripe</span></button><button type="button" onClick={() => setMethod('pix')} disabled={!data.paymentMethods?.pix || busy}><QrCode/><strong>Pix</strong><span>Pagamento mensal pela Roas</span></button></div>}{method === 'pix' && !pix && <PixForm form={pixForm} setForm={setPixForm} busy={busy === 'pix'} submit={choosePix}/>} {pix && <div className={`billing-pix-result ${pix.status?.toLowerCase()}`}>{pix.status === 'PENDING' && <QRCodeSVG value={pix.pixCode} size={190} level="M" includeMargin/>}<strong>{money.format(pix.amountCents / 100)}</strong>{pix.status === 'PENDING' && <button className="secondary" onClick={() => navigator.clipboard.writeText(pix.pixCode)}><Copy size={17}/> Copiar código Pix</button>}<small>{pix.status === 'PAID' ? 'Pagamento confirmado. Plano ativado!' : pix.status === 'PENDING' ? 'Aguardando a confirmação do pagamento...' : 'Esta cobrança não está mais disponível.'}</small></div>}</section></div>}
  </main>;
}
