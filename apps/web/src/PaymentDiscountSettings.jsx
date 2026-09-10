import { useEffect, useState } from 'react';
import { getPixDiscount, savePixDiscount } from './api';

export default function PaymentDiscountSettings({ csrfToken }) {
  const [form, setForm] = useState({ percentage: '5', minimum: '0', maximum: '', active: false });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    getPixDiscount().then(({ discount }) => {
      if (live) setReady(true);
      if (live && discount) setForm({ percentage: String(discount.percentageBps / 100), minimum: String(discount.minimumAmountCents / 100), maximum: discount.maximumAmountCents === null ? '' : String(discount.maximumAmountCents / 100), active: discount.active });
    }).catch(error => { if (live) setError(error.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const change = (key, value) => { setForm(current => ({ ...current, [key]: value })); setMessage(''); };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await savePixDiscount({ percentageBps: Math.round(Number(form.percentage) * 100), minimumAmountCents: Math.round(Number(form.minimum) * 100), maximumAmountCents: form.maximum === '' ? null : Math.round(Number(form.maximum) * 100), active: form.active }, csrfToken);
      setMessage('Configuração salva. Será aplicada aos novos checkouts iniciados pelos clientes.');
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <section className="coupon-form-section" aria-labelledby="pix-discount-heading">
    <h2 id="pix-discount-heading">Desconto no Pix</h2>
    <p>Aplicado automaticamente nos produtos após o cupom, sem incluir o frete. Compras já iniciadas mantêm a regra anterior.</p>
    {loading ? <p role="status">Carregando configuração…</p> : <form onSubmit={submit}>
      <fieldset disabled={busy || !csrfToken || !ready} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="coupon-form-grid three-columns">
          <div className="coupon-field"><label id="pix-percentage-label" htmlFor="pix-percentage">Desconto (%)</label><input aria-labelledby="pix-percentage-label" id="pix-percentage" type="number" min="0.01" max="100" step="0.01" required value={form.percentage} onChange={event => change('percentage', event.target.value)} /></div>
          <div className="coupon-field"><label id="pix-minimum-label" htmlFor="pix-minimum">Compra mínima após cupom (R$)</label><input aria-labelledby="pix-minimum-label" id="pix-minimum" type="number" min="0" max="21474836.47" step="0.01" required value={form.minimum} onChange={event => change('minimum', event.target.value)} /></div>
          <div className="coupon-field"><label id="pix-maximum-label" htmlFor="pix-maximum">Desconto máximo (R$)</label><input aria-labelledby="pix-maximum-label" id="pix-maximum" type="number" min="0.01" max="21474836.47" step="0.01" value={form.maximum} onChange={event => change('maximum', event.target.value)} aria-describedby="pix-maximum-help" /><small id="pix-maximum-help">Deixe vazio para não limitar.</small></div>
        </div>
        <label className="coupon-switch-row"><span id="pix-active-label"><b>Desconto Pix ativo</b></span><input aria-labelledby="pix-active-label" type="checkbox" checked={form.active} onChange={event => change('active', event.target.checked)} /><i aria-hidden="true" /></label>
        <button className="primary" type="submit">{busy ? 'Salvando…' : 'Salvar desconto Pix'}</button>
      </fieldset>
    </form>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
