import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckoutProgress from '../src/CheckoutProgress';
const labels = { identification: 'Identificação', delivery: 'Entrega', payment: 'Pagamento' };
describe('shared checkout progress', () => {
  it('keeps delivery and the active step consistent across editor and buyer variants', () => {
    for (const preview of [true, false]) {
      const html = renderToStaticMarkup(<CheckoutProgress labels={labels} config={{ progressStyle: 'chevrons' }} step={2} preview={preview}/>);
      expect(html).toContain('style-chevrons');
      expect(html).toContain('aria-current="step"><i>2</i>Entrega');
      expect(html.match(/aria-current=/g)).toHaveLength(1);
    }
  });
  it('never adds a delivery stage to a digital purchase', () => {
    for (const preview of [true, false]) {
      const html = renderToStaticMarkup(<CheckoutProgress labels={labels} config={{}} requiresShipping={false} step={4} preview={preview}/>);
      expect(html).not.toContain('Entrega');
      expect(html).toContain('aria-current="step"><i>2</i>Pagamento');
    }
  });
});
