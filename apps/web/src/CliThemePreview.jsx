import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Preview, defaultCheckoutConfig } from './CheckoutEditor';
import './styles.css';
import '../../../scripts/connected-cli/preview.css';

function ThemePreview() {
  const [state, setState] = useState({ config: defaultCheckoutConfig, error: '', revision: '' });
  const [device, setDevice] = useState('desktop');
  useEffect(() => {
    let alive = true;
    const update = async () => {
      try { const response = await fetch('/config.json'); if (!response.ok) throw new Error('Servidor local indisponível.'); const next = await response.json(); if (alive) setState(previous => next.revision === previous.revision && next.error === previous.error ? previous : next); }
      catch (error) { if (alive) setState(previous => ({ ...previous, error: error.message })); }
    };
    void update(); const timer = setInterval(update, 1500);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  return <><header className="cli-preview-bar"><div><b>Pirat · seu tema local</b><p>Salve os arquivos na IDE para atualizar. A prévia não cria pedidos ou pagamentos.</p></div><div role="group" aria-label="Tamanho da prévia"><button onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'}>Computador</button><button onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'}>Celular</button></div></header>{state.error && <pre role="alert" className="cli-preview-error">{state.error}</pre>}<main className={`cli-preview-canvas ${device}`}><Preview c={state.config} device={device} readOnly /></main></>;
}
createRoot(document.getElementById('root')).render(<ThemePreview/>);
