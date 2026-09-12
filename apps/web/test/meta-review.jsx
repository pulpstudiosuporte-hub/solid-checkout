import { createRoot } from 'react-dom/client';
import MetaIntegration from '../src/MetaIntegration';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';

window.fetch = async (input, init = {}) => {
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
  if (String(input).endsWith('/integrations/meta/status')) return json({ connected: false });
  if (init.method === 'PUT') {
    const body = JSON.parse(init.body);
    if (!body.testEventCode) return json({ error: { code: 'META_TEST_CODE_REQUIRED', message: 'Não foi possível consultar o cadastro deste Pixel. Para validar pelo envio de eventos, preencha o código da aba Eventos de teste na Meta e conecte novamente.' } }, 422);
    if (body.testEventCode !== 'TEST12345') return json({ error: { code: 'META_VALIDATION_FAILED', message: 'Confira o código de teste.' } }, 422);
    return json({ connected: true });
  }
  return json({});
};
createRoot(document.getElementById('root')).render(<div className="app solid-admin"><div style={{ width: '100%', maxWidth: 1250, margin: 'auto', padding: 20, boxSizing: 'border-box' }}><MetaIntegration csrfToken="local" storeKey="meta-review"/></div></div>);
