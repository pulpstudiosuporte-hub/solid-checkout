import { Fragment } from 'react';
import { CreditCard, MapPin, UserRound } from 'lucide-react';

// Shared visual block. The checkout owns navigation and payment state.
export default function CheckoutProgress({ config, labels, requiresShipping = true, step = 1, preview = false }) {
  const stages = [
    { id: 'identification', label: labels.identification, Icon: UserRound, reached: true, current: step === 1 },
    ...(requiresShipping ? [{ id: 'delivery', label: labels.delivery, Icon: MapPin, reached: step >= 2, current: step === 2 || step === 3 }] : []),
    { id: 'payment', label: labels.payment, Icon: CreditCard, reached: step >= 4, current: step >= 4 },
  ];
  return <nav className={`${preview ? 'ep-steps' : 'checkout-progress'} style-${config.progressStyle || 'outline'}${preview ? '' : ` checkout-device-${config.progressDevice || 'all'}`}`} aria-label="Etapas do checkout">
    {stages.map(({ id, label, Icon, reached, current }, index) => <Fragment key={id}>
      {index > 0 && !preview && <b aria-hidden="true"/>}
      <span className={reached ? 'active' : ''} aria-current={current ? 'step' : undefined}>
        <i>{config.progressStyle === 'icons' ? <Icon size={16} aria-hidden="true"/> : index + 1}</i>{label}
      </span>
    </Fragment>)}
  </nav>;
}
