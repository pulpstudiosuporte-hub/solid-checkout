import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CreditCard, LoaderCircle, ReceiptText, ShieldCheck } from 'lucide-react';
import { getBilling, openBillingPortal, startBillingCheckout } from './api';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const planBenefits = {
  START: ['1 loja e 1 checkout', 'Domínio próprio', 'Checkout personalizado', 'Integração Pix pela Roas'],
  PRIME: ['Tudo do plano Start', 'Até 5 lojas e checkouts', 'Order bumps e cupons', 'Relatórios avançados'],
  ELITE: ['Tudo do plano Prime', 'Limites ampliados', 'Equipe e integrações avançadas', 'Suporte prioritário'],
};

export default function BillingPage({ csrfToken }) {
  const [data, setData] = useState(null); const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  const load = () => getBilling().then(setData).catch(error => setMessage(error.message));
  useEffect(() => { load(); }, []);
  const choose = async plan => { try { setBusy(plan); setMessage(''); const result = await startBillingCheckout(plan, csrfToken); window.location.assign(result.url); } catch (error) { setMessage(error.message); setBusy(''); } };
  const portal = async () => { try { setBusy('portal'); const result = await openBillingPortal(csrfToken); window.location.assign(result.url); } catch (error) { setMessage(error.message); setBusy(''); } };
  if (!data) return <main className="page billing-page"><div className="billing-loading"><LoaderCircle className="spin"/> Carregando seu plano...</div></main>;
  const subscription = data.subscription;
  return <main className="page billing-page">
    <section className="page-title billing-title"><div><p className="eyebrow">CONTA E COBRANÇA</p><h1>Meu plano</h1><p>O Pix das suas vendas continua na Roas. A SOLID cobra mensalidade e uso no cartão pela Stripe.</p></div>{subscription.cardConfigured && <button className="secondary" onClick={portal} disabled={busy === 'portal'}><CreditCard size={17}/> Gerenciar cartão</button>}</section>
    {message && <p className="settings-alert error">{message}</p>}
    {!data.configured && <div className="billing-warning"><ShieldCheck size={19}/><span>A integração Stripe ainda precisa ser configurada no servidor. Você já pode revisar os planos.</span></div>}
    <section className="billing-summary card"><div><span>Plano atual</span><strong>{data.plans.find(plan => plan.id === subscription.plan)?.name}</strong><small className={`billing-status ${subscription.status.toLowerCase()}`}>{subscription.status.replace('_', ' ')}</small></div><div><span>Vendas no ciclo</span><strong>{money.format(data.usage.grossAmountCents / 100)}</strong><small>{data.usage.transactions} pagamentos confirmados</small></div><div><span>Tarifa acumulada</span><strong>{money.format(data.usage.feeAmountCents / 100)}</strong><small>{(subscription.feeBasisPoints / 100).toLocaleString('pt-BR')}% sobre vendas pagas</small></div><div><span>Próxima cobrança</span><strong>{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR') : 'Após ativar'}</strong><small>{subscription.blocked ? 'Conta suspensa por inadimplência' : 'Cobrança automática no cartão'}</small></div></section>
    <section className="billing-plans">{data.plans.map(plan => <article className={`billing-plan card ${plan.id === 'ELITE' ? 'featured' : ''}`} key={plan.id}>{plan.id === 'ELITE' && <em>Recomendado</em>}<h2>{plan.name}</h2><p>{plan.id === 'START' ? 'Comece a vender sem mensalidade.' : plan.id === 'PRIME' ? 'Para operações em crescimento.' : 'Para escalar com mais controle.'}</p><div className="billing-price">{plan.monthlyPriceCents ? <><small>R$</small><strong>{plan.monthlyPriceCents / 100}</strong><span>/mês</span></> : <strong>Grátis</strong>}</div><b className="billing-rate">{(plan.feeBasisPoints / 100).toLocaleString('pt-BR')}% por venda paga</b><ul>{planBenefits[plan.id].map(item => <li key={item}><Check size={16}/>{item}</li>)}</ul><button className={subscription.plan === plan.id && subscription.cardConfigured ? 'secondary' : 'primary'} disabled={busy || (subscription.plan === plan.id && subscription.cardConfigured) || !data.configured} onClick={() => choose(plan.id)}>{busy === plan.id ? <LoaderCircle className="spin" size={17}/> : subscription.plan === plan.id && subscription.cardConfigured ? 'Plano atual' : <>Escolher plano <ArrowRight size={17}/></>}</button></article>)}</section>
    <section className="billing-explainer card"><ReceiptText size={22}/><div><h2>Como a cobrança funciona</h2><p>Registramos somente pagamentos confirmados. No fechamento, a Stripe cobra a mensalidade somada à tarifa acumulada. Pix pendente, recusado ou expirado não gera cobrança; reembolsos viram crédito.</p></div></section>
  </main>;
}
