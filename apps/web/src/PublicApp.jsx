import './public-checkout.css';
import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import PublicCheckout, { PublicCheckoutErrorBoundary, PublicSessionCheckout } from './PublicCheckout';

function PublicSessionRoute({ sessionId, urlToken }) {
  const [token] = useState(() => {
    const storageKey = `solid-checkout-session:${sessionId}`;
    if (urlToken) sessionStorage.setItem(storageKey, urlToken);
    return urlToken || sessionStorage.getItem(storageKey) || '';
  });
  useEffect(() => {
    if (urlToken) window.history.replaceState({}, '', `/#/session/${sessionId}`);
  }, [sessionId, urlToken]);
  if (!token) return <div className="public-checkout-state error" role="alert"><ShoppingBag/><b>Sessão indisponível</b><span>Abra novamente o link original do checkout para continuar.</span></div>;
  return <PublicSessionCheckout sessionId={sessionId} token={token}/>;
}

export default function PublicApp({ route }) {
  return <PublicCheckoutErrorBoundary>{route.kind === 'session'
    ? <PublicSessionRoute key={route.sessionId} sessionId={route.sessionId} urlToken={route.token} />
    : <PublicCheckout key={`${route.storeSlug}:${route.checkoutSlug}`} storeSlug={route.storeSlug} checkoutSlug={route.checkoutSlug} />}</PublicCheckoutErrorBoundary>;
}
