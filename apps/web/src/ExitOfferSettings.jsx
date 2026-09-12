import { useEffect, useState } from 'react';
import { getCoupons } from './api';
import { ExitOfferDialog } from './ExitOffer';
import { exitOfferDefaults } from './exit-offer-config';

export default function ExitOfferSettings({ config, update }) {
  const c = { ...exitOfferDefaults, ...config };
  const [coupons, setCoupons] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [preview, setPreview] = useState(null);
  useEffect(() => { let active = true; getCoupons().then(result => active && setCoupons(result.items || [])).catch(() => active && setError('Não foi possível carregar os cupons. Reabra esta seção para tentar novamente.')).finally(() => active && setLoading(false)); return () => { active = false; }; }, []);
  const needsCoupon = c.exitOfferEnabled && !c.exitOfferCouponCode?.trim();
  const selected = coupons.find(coupon => coupon.code === c.exitOfferCouponCode);
  const showPreview = () => { const value = selected?.value || 1000; const type = selected?.type || 'PERCENT'; setPreview({ type, value, couponDiscountCents: type === 'PERCENT' ? Math.floor(10000 * value / 10000) : Math.min(value, 9999), expiresAt: new Date(Date.now() + 300000).toISOString() }); };
  return <div className="exit-offer-settings"><h3>Oferta de saída</h3><p className="panel-help">Ofereça um cupom por tempo na página ou quando o comprador demonstrar intenção de sair. Aparece uma vez por sessão, antes de gerar o pagamento.</p>
    <label className="exit-offer-switch"><input type="checkbox" checked={c.exitOfferEnabled} onChange={event => update('exitOfferEnabled', event.target.checked)}/> Ativar oferta de saída</label>
    <label>Cupom da oferta<select aria-required={c.exitOfferEnabled} aria-invalid={needsCoupon} aria-describedby={needsCoupon ? "exit-offer-coupon-help" : undefined} disabled={loading} value={c.exitOfferCouponCode} onChange={event => update('exitOfferCouponCode', event.target.value)}><option value="">{loading ? 'Carregando cupons...' : 'Selecione um cupom'}</option>{c.exitOfferCouponCode && !selected && <option value={c.exitOfferCouponCode}>{c.exitOfferCouponCode} · não encontrado</option>}{coupons.map(coupon => <option key={coupon.publicId} value={coupon.code}>{coupon.code} · {coupon.type === 'PERCENT' ? `${coupon.value / 100}%` : `R$ ${(coupon.value / 100).toFixed(2)}`}{!coupon.active ? ' · inativo' : ''}</option>)}</select></label>
    <p className="panel-help">Crie o desconto em Marketing → Cupons. Validade, valor mínimo e limite de usos continuam valendo. Um cupom já aplicado não será substituído.</p>{error && <p role="alert">{error}</p>}{needsCoupon && <p id="exit-offer-coupon-help" role="status">Selecione um cupom antes de salvar a oferta ativa.</p>}
    {[['exitOfferTitle', 'Título', 100], ['exitOfferButtonText', 'Texto do botão', 60], ['exitOfferDismissText', 'Texto para recusar', 40]].map(([key, label, max]) => <label key={key}>{label}<input value={c[key]} maxLength={max} onChange={event => update(key, event.target.value)}/></label>)}
    <label className="exit-offer-switch"><input type="checkbox" checked={c.exitOfferTimedEnabled} onChange={event => update('exitOfferTimedEnabled', event.target.checked)}/> Mostrar também por tempo</label>
    {c.exitOfferTimedEnabled && <label>Abrir automaticamente após (segundos)<input type="number" min="5" max="300" value={c.exitOfferTimedSeconds} onChange={event => update('exitOfferTimedSeconds', Number(event.target.value))}/></label>}
    <p className="panel-help">O disparo por tempo funciona no computador e no celular, mesmo sem clique ou rolagem. Se outra janela estiver aberta, a oferta aguarda.</p>
    <label>Tempo mínimo para detectar saída (segundos)<input type="number" min="5" max="120" value={c.exitOfferDelaySeconds} onChange={event => update('exitOfferDelaySeconds', Number(event.target.value))}/></label>
    <label className="exit-offer-switch"><input type="checkbox" checked={c.exitOfferMobile} onChange={event => update('exitOfferMobile', event.target.checked)}/> No celular, mostrar ao rolar de volta ao topo</label>
    <label className="exit-offer-switch"><input type="checkbox" checked={c.exitOfferCountdown} onChange={event => update('exitOfferCountdown', event.target.checked)}/> Mostrar contagem da validade real</label>
    <p className="panel-help">No computador, a oferta abre ao aproximar o mouse do canto superior esquerdo, em direção ao botão Voltar, ou ao sair pelo topo. Respeita o tempo mínimo e aparece uma vez por sessão. A contagem da validade do desconto não reinicia ao recarregar.</p>
    <div className="exit-offer-colors">{[['exitOfferAccent', 'Destaque'], ['exitOfferBackground', 'Fundo'], ['exitOfferTextColor', 'Texto']].map(([key, label]) => <label key={key}>{label}<input type="color" value={c[key]} onChange={event => update(key, event.target.value)}/></label>)}</div>
    <button type="button" className="secondary" onClick={showPreview}>Visualizar popup</button><p className="panel-help">A prévia usa um pedido de R$ 100 e um contador demonstrativo de 5 minutos.</p>
    {preview && <ExitOfferDialog config={c} offer={preview} preview onAccept={() => setPreview(null)} onClose={() => setPreview(null)}/>}
  </div>;
}
