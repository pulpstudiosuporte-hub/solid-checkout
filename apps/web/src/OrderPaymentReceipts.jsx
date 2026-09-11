import { useEffect, useState } from 'react';
import { downloadOrderPaymentReceipt, getOrderPaymentReceipts } from './api';

export default function OrderPaymentReceipts({ orderId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getOrderPaymentReceipts(orderId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setItems(result.items); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orderId, revision]);
  const download = async item => {
    setDownloading(item.paymentId); setError('');
    try { await downloadOrderPaymentReceipt(orderId, item.paymentId, item.mimeType); }
    catch (reason) { setError(reason.message); }
    finally { setDownloading(''); }
  };
  return <section className="card ow-card-section">
    <header><div><h2>Comprovantes enviados</h2><span>Arquivos enviados pelo comprador, disponíveis por 30 dias. Não confirmam o pagamento.</span></div><button type="button" className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Atualizar comprovantes</button></header>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Carregando comprovantes...</p> : items.length ? <ul>{items.map(item => <li key={item.paymentId}><span>Pix {item.paymentId} · {new Date(item.createdAt).toLocaleString('pt-BR')} · {Math.ceil(item.sizeBytes / 1024)} KB </span><button type="button" className="secondary" disabled={Boolean(downloading)} onClick={() => download(item)}>{downloading === item.paymentId ? 'Baixando...' : 'Baixar comprovante'}</button></li>)}</ul> : !error && <p>Nenhum comprovante enviado.</p>}
  </section>;
}
