import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ChevronDown, Clock3, Copy, Info, LoaderCircle, QrCode, RefreshCw, Upload } from 'lucide-react';
import { getPublicPaymentReceipt, uploadPublicPaymentReceipt } from './api';
import './pix-payment-feedback.css';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const terminalCopy = {
  EXPIRED: ['Este Pix expirou', 'Já pagou? Consulte a confirmação.', 'Volte à loja para iniciar uma nova compra.'],
  FAILED: ['Pix não concluído', 'Houve débito? Consulte a confirmação.', 'Volte à loja para tentar novamente.'],
  CANCELLED: ['Pix cancelado', 'Houve débito? Fale com a loja.'],
  REFUNDED: ['Pagamento estornado', 'Confira o estorno no seu banco.'],
};

export function pixPresentation(payment, remaining) {
  const status = String(payment.status || '').toUpperCase();
  if (status === 'PAID') return { payable: false, title: 'Pagamento confirmado', message: 'Recebemos a confirmação do seu pagamento.' };
  const effectiveStatus = status === 'PENDING' && Number.isFinite(remaining) && remaining <= 0 ? 'EXPIRED' : status;
  if (terminalCopy[effectiveStatus]) return { payable: false, title: terminalCopy[effectiveStatus][0], message: terminalCopy[effectiveStatus][1], help: terminalCopy[effectiveStatus][2] };
  if (effectiveStatus !== 'PENDING' || !payment.pixCode) return { payable: false, title: 'Conferindo pagamento', message: 'Consulte a confirmação antes de tentar pagar novamente.' };
  return { payable: true, title: 'Quase lá...' };
}

function ReceiptUpload({ sessionId, paymentId, token }) {
  const [file, setFile] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getPublicPaymentReceipt(sessionId, paymentId, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setReceipt(result.receipt); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sessionId, paymentId, token]);
  const selectFile = event => {
    const selected = event.target.files?.[0];
    setError(''); setFile(null);
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selected.type) || !selected.size || selected.size > 3 * 1024 * 1024) {
      setError('Escolha uma imagem JPG, PNG, WebP ou um PDF de até 3 MB.');
      event.target.value = '';
      return;
    }
    setFile(selected);
  };
  const submit = async () => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const result = await uploadPublicPaymentReceipt(sessionId, paymentId, token, file);
      setReceipt(result.receipt); setFile(null);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <details className="pix-receipt">
    <summary>Já pagou o Pix? <span><Upload size={16} /> Enviar comprovante</span></summary>
    <div className="pix-receipt-content">
      <p className="pix-receipt-note"><Info size={15} aria-hidden="true" /><span>A loja recebe o comprovante. A confirmação do Pix é automática.</span></p>
      {loading ? <p role="status">Consultando comprovante...</p> : receipt ? <p className="pix-receipt-success" role="status"><Check size={18} /> Comprovante recebido pela loja.</p> : <>
        <label htmlFor="pix-receipt-file">Comprovante em JPG, PNG, WebP ou PDF · até 3 MB</label>
        <input id="pix-receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={selectFile} />
        {file && <span className="pix-receipt-filename">{file.name}</span>}
        <button className="customer-continue" type="button" disabled={!file || busy} onClick={submit}>{busy ? <><LoaderCircle size={18} className="spin" /> Enviando...</> : 'Enviar comprovante'}</button>
      </>}
      {error && <p role="alert" className="public-error">{error}</p>}
    </div>
  </details>;
}

export default function PixPaymentPanel({ payment, expiry, copy, sessionId, token, onRefresh }) {
  const presentation = pixPresentation(payment, expiry.remaining);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const manualInput = useRef(null);
  const copiedTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  useEffect(() => { if (manualCopy) { manualInput.current?.focus(); manualInput.current?.select(); } }, [manualCopy]);
  const copyPix = async () => {
    if (!presentation.payable) return;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(payment.pixCode);
      setManualCopy(false); setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setManualCopy(true);
      manualInput.current?.focus(); manualInput.current?.select();
    }
  };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setRefreshError(''); setRefreshMessage('');
    try {
      const result = await onRefresh();
      setRefreshMessage(result?.status?.toUpperCase() === 'PAID' ? 'Pagamento confirmado.' : 'Consulta atualizada.');
    } catch (reason) { setRefreshError(reason.message || 'Não foi possível consultar agora. Tente novamente.'); }
    finally { setRefreshing(false); }
  };
  return <div className={`pix-payment-panel${presentation.payable ? '' : ' pix-payment-panel-terminal'}`}>
    {presentation.payable ? <section className="pix-payment-intro">
      <h1>{presentation.title}</h1>
      <p>Pague seu Pix dentro de <strong>{expiry.label}</strong><br />para garantir sua compra.</p><span className="pix-status-pill">Aguardando pagamento <i /><i /><i /></span>
    </section> : <section className="pix-status-card" aria-labelledby="pix-status-title">
      <div className="pix-status-heading">
        <span className="pix-status-icon"><Clock3 size={21} aria-hidden="true" /></span>
        <div><h1 id="pix-status-title">{presentation.title}</h1><p role="status">{presentation.message}</p></div>
      </div>
      <button className="customer-continue" type="button" disabled={refreshing} onClick={refresh}><RefreshCw size={16} className={refreshing ? 'spin' : ''} aria-hidden="true" />{refreshing ? 'Consultando...' : 'Verificar pagamento'}</button>
      {refreshMessage && <p className="pix-status-feedback" role="status">{refreshMessage}</p>}
      {refreshError && <p role="alert" className="public-error">{refreshError}</p>}
      {presentation.help && <details className="pix-status-help"><summary>Ainda não pagou? <ChevronDown size={14} aria-hidden="true" /></summary><p>{presentation.help}</p></details>}
    </section>}
    {presentation.payable && <section className="pix-payment-card">
      <div className="pix-desktop-qr">
        <p>Abra seu aplicativo de pagamento e escolha <b>Ler QR Code</b></p>
        <span><QrCode size={16} /> Aponte a câmera do seu celular</span>
        <div className="pix-qr-code"><QRCodeSVG value={payment.pixCode} size={226} level="M" includeMargin aria-label="QR Code para pagamento Pix" /></div>
      </div>
      <p className="pix-payment-value">Valor do Pix: <strong>{money.format(payment.amountCents / 100)}</strong></p>
      <div className="pix-mobile-instructions">
        <button type="button" className="customer-continue pix-copy-button" onClick={copyPix}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? copy.copied : copy.copyPix}</button>
        <div className="pix-how-to"><h2>Como pagar o Pix:</h2><ol><li><b>1</b> Copie o código Pix</li><li><b>2</b> Abra seu banco e escolha Pix Copia e Cola</li><li><b>3</b> Cole o código e confirme o pagamento de {money.format(payment.amountCents / 100)}</li></ol></div>
      </div>
      <div className="pix-processor"><small>Pix processado por</small><strong>Pagamento seguro</strong></div>
    </section>}
    {presentation.payable && <section className="pix-copy-alternative">
      <p>Você também pode pagar escolhendo a opção <b>Pix Copia e Cola</b> no seu aplicativo de pagamento ou Internet Banking.</p>
      <button type="button" onClick={copyPix}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? copy.copied : 'Copiar código'}</button>
    </section>}
    {presentation.payable && copied && <p className="pix-copy-feedback" role="status">Código Pix copiado.</p>}
    {presentation.payable && manualCopy && <section className="pix-manual-copy">
      <p role="alert">Não foi possível copiar automaticamente. Selecione o código abaixo e use a opção Copiar do seu dispositivo.</p>
      <label htmlFor="pix-manual-code">Código Pix para copiar manualmente</label>
      <textarea ref={manualInput} id="pix-manual-code" readOnly value={payment.pixCode} onFocus={event => event.target.select()} />
    </section>}
    <ReceiptUpload key={payment.publicId} sessionId={sessionId} paymentId={payment.publicId} token={token} />
  </div>;
}
