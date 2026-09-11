// Schedule only after the previous request settles, including slow requests.
// Hidden tabs stop polling and resume immediately when visible again.
export function mergePaymentUpdate(current, incoming) {
  if (!incoming) return current;
  if (!current) return incoming;
  const status = String(current.status).toUpperCase();
  const nextStatus = String(incoming.status).toUpperCase();
  // Manual refresh and the background poll may finish out of order.
  if (status === 'REFUNDED' || (status === 'PAID' && nextStatus !== 'REFUNDED')) return current;
  return { ...current, ...incoming };
}

export function pollPaymentStatus({ fetchStatus, onPayment, visibility = document, intervalMs = 5000 }) {
  let stopped = false;
  let running = false;
  let timer;
  const controller = new AbortController();
  const poll = async () => {
    if (stopped || running || visibility.visibilityState === 'hidden') return;
    running = true;
    try {
      const result = await fetchStatus(controller.signal);
      if (!stopped) {
        onPayment(result.payment);
        if (String(result.payment?.status).toUpperCase() !== 'PENDING') stopped = true;
      }
    } catch { /* Retry on the next interval, unless the component unmounted. */ }
    finally {
      running = false;
      if (!stopped && visibility.visibilityState !== 'hidden') timer = setTimeout(() => void poll(), intervalMs);
    }
  };
  const onVisibility = () => { clearTimeout(timer); if (visibility.visibilityState !== 'hidden') void poll(); };
  visibility.addEventListener('visibilitychange', onVisibility);
  void poll();
  return () => { stopped = true; clearTimeout(timer); controller.abort(); visibility.removeEventListener('visibilitychange', onVisibility); };
}
