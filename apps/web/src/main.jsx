import { Component, lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { resolvePublicRoute } from './public-route';

const AdminApp = lazy(() => import('./AdminApp'));
const PublicApp = lazy(() => import('./PublicApp'));

class AppLoadBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main role="alert"><p>Falha ao carregar a página.</p><button onClick={() => window.location.reload()}>Tentar novamente</button></main>;
    return this.props.children;
  }
}
function Root() {
  const [route, setRoute] = useState(() => resolvePublicRoute(window.location));
  useEffect(() => {
    const navigate = () => setRoute(resolvePublicRoute(window.location));
    window.addEventListener('hashchange', navigate);
    window.addEventListener('popstate', navigate);
    return () => { window.removeEventListener('hashchange', navigate); window.removeEventListener('popstate', navigate); };
  }, []);
  return <AppLoadBoundary><Suspense fallback={<div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>Carregando...</div>}>
    {route ? <PublicApp route={route} /> : <AdminApp />}
  </Suspense></AppLoadBoundary>;
}
createRoot(document.getElementById('root')).render(<Root />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let reloadingForServiceWorker = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${__SOLID_BUILD_VERSION__}`, {
        updateViaCache: 'none',
      });

      await registration.update();
    } catch {
      // O painel continua utilizável mesmo quando o navegador bloqueia PWA.
    }
  });
}
