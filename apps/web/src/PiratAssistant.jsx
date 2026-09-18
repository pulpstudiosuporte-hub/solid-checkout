import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageCircle, RotateCcw, X } from 'lucide-react';
import { askPirat, getAssistantStatus } from './api';
import './pirat-assistant.css';

const defaultSuggestions = ['Como publico meu checkout?', 'Como configuro o Pixel?', 'Como configuro a oferta de saída?'];
const moods = new Set(['replying', 'happy', 'angry', 'sad']);
const captions = { greeting: 'Pode chegar, marujo.', idle: 'Manda a dúvida.', thinking: 'Consultando o mapa…', replying: 'Olha o mapa aí!', happy: 'Aí sim, marujo!', angry: 'Vamos desembolar essa bagunça.', sad: 'Calma, vamos por partes.' };

export function helpHistory(messages, question) {
  const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
  while (history.length && history.reduce((size, item) => size + item.text.length, question.length) > 14000) history.splice(0, 2);
  return [...history, { role: 'user', text: question }];
}

export default function PiratAssistant({ csrfToken }) {
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState('loading');
  const [suggestions, setSuggestions] = useState(defaultSuggestions);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [mood, setMood] = useState('greeting');
  const dialog = useRef(null);
  const title = useRef(null);
  const input = useRef(null);
  const transcript = useRef(null);
  const request = useRef(null);
  const emotionTimer = useRef(null);

  useEffect(() => () => { request.current?.abort(); clearTimeout(emotionTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    dialog.current.showModal();
    title.current?.focus();
    const controller = new AbortController();
    setAvailability('loading');
    getAssistantStatus(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setAvailability(result.available ? 'ready' : 'unconfigured');
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions.slice(0, 3).filter(item => typeof item === 'string' && item.length <= 100) : defaultSuggestions);
    }).catch(() => { if (!controller.signal.aborted) setAvailability('error'); });
    return () => controller.abort();
  }, [open]);
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [messages, pending, error]);

  function close() {
    request.current?.abort(); request.current = null;
    clearTimeout(emotionTimer.current);
    setPending(''); setOpen(false);
    dialog.current?.close();
  }
  function reset() { setMessages([]); setDraft(''); setError(''); setMood('greeting'); input.current?.focus(); }
  async function send(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || question.length > 2000 || request.current || availability !== 'ready') return;
    clearTimeout(emotionTimer.current);
    const controller = new AbortController(); request.current = controller;
    setPending(question); setError(''); setMood('thinking');
    try {
      const answer = await askPirat(helpHistory(messages, question), csrfToken, controller.signal);
      if (controller.signal.aborted) return;
      if (!answer || typeof answer.text !== 'string' || !answer.text.trim() || answer.text.length > 4000) throw new Error('invalid response');
      setMessages(previous => [...previous, { role: 'user', text: question }, { role: 'assistant', text: answer.text }].slice(-40));
      setDraft(''); setMood('replying');
      emotionTimer.current = setTimeout(() => setMood(moods.has(answer.mood) ? answer.mood : 'idle'), 1400);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setMood('sad');
      if (cause?.code === 'ASSISTANT_NOT_CONFIGURED') setAvailability('unconfigured');
      const preserved = ' Sua pergunta continua aqui para tentar novamente.';
      setError(cause?.status === 401 || cause?.status === 403 ? 'Sua sessão precisa ser atualizada. Recarregue o painel para continuar.' : cause?.status === 429 ? 'Vamos dar um descanso ao bico. O limite é de 20 perguntas por hora; tente mais tarde.' : cause?.code === 'ASSISTANT_BUSY' ? `O serviço de IA atingiu o limite de uso. Tente mais tarde.${preserved}` : cause?.code === 'ASSISTANT_TIMEOUT' ? `O serviço de IA demorou para responder.${preserved}` : cause?.code === 'ASSISTANT_UNAVAILABLE' ? `O serviço de IA está temporariamente indisponível.${preserved}` : `Não consegui concluir a resposta.${preserved}`);
    } finally {
      if (request.current === controller) { request.current = null; setPending(''); input.current?.focus(); }
    }
  }

  return <div className="pirat-help">
    <button className="pirat-help-launch" type="button" onClick={() => { setMood(messages.length ? 'idle' : 'greeting'); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open} aria-label="Conversar com o papagaio da Pirat"><img src="/brand/assistant/idle.webp" alt="" width="48" height="48"/><span>Fala, marujo!</span><MessageCircle size={18} aria-hidden="true"/></button>
    <dialog ref={dialog} className="pirat-help-dialog" aria-labelledby="pirat-help-title" aria-describedby="pirat-help-disclaimer" onCancel={event => { event.preventDefault(); close(); }}>
      <header className="pirat-help-header"><div><small>SEU COPILOTO DE BORDO</small><h2 id="pirat-help-title" ref={title} tabIndex={-1}>Papagaio da Pirat</h2></div><button type="button" onClick={close} aria-label="Fechar conversa"><X size={20}/></button></header>
      <section className="pirat-help-character" aria-label="Mascote do assistente"><img src={`/brand/assistant/${mood}.webp`} alt={`Papagaio da Pirat: ${captions[mood]}`} width="104" height="104"/><div><span className="pirat-help-badge">ASSISTENTE IA</span><p role="status">{captions[mood]}</p></div></section>
      <div className="pirat-help-transcript" ref={transcript}>
        {!messages.length && <div className="pirat-help-welcome"><h3>Perdido no painel?</h3><p>Sou bom de bico e de mapa. Pergunte sobre checkouts, integrações e os recursos da Pirat.</p><div className="pirat-help-suggestions">{suggestions.map(question => <button type="button" key={question} disabled={Boolean(pending) || availability !== 'ready'} onClick={() => { setDraft(question); setMood('idle'); input.current?.focus(); }}>{question}<ArrowUp size={16} aria-hidden="true"/></button>)}</div></div>}
        <div role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions">{messages.map((message, index) => <div className={`pirat-help-message ${message.role}`} key={index}><small>{message.role === 'user' ? 'Você' : 'Papagaio'}</small><p>{message.text}</p></div>)}</div>
        {pending && <><div className="pirat-help-message user"><small>Você</small><p>{pending}</p></div><p className="pirat-help-wait">Um instante, estou consultando o mapa…</p></>}
        {availability === 'loading' && <p role="status" className="pirat-help-notice">Preparando a conversa…</p>}
        {availability === 'unconfigured' && <p role="status" className="pirat-help-notice">Ainda estou preparando meu mapa. O assistente será liberado quando a conexão com a IA estiver configurada.</p>}
        {availability === 'error' && <p role="alert" className="pirat-help-notice">Não consegui conectar. Feche e abra a conversa para tentar novamente.</p>}
        {error && <p role="alert" className="pirat-help-notice">{error}</p>}
      </div>
      <footer className="pirat-help-footer"><form onSubmit={send}><label htmlFor="pirat-help-question">Sua pergunta</label><div className="pirat-help-composer"><textarea id="pirat-help-question" ref={input} value={draft} maxLength={2000} rows={2} placeholder="Como eu faço para…" disabled={Boolean(pending) || availability !== 'ready'} onChange={event => { setDraft(event.target.value); setMood('idle'); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(event); } }}/><button type="submit" aria-label="Enviar pergunta" disabled={Boolean(pending) || !draft.trim() || availability !== 'ready'}><ArrowUp size={21}/></button></div></form><div className="pirat-help-tools"><button type="button" disabled={Boolean(pending) || !messages.length} onClick={reset}><RotateCcw size={14} aria-hidden="true"/> Nova conversa</button><small>{draft.length}/2.000</small></div><p id="pirat-help-disclaimer">IA pode errar. Enviamos suas mensagens ao Gemini para responder. Não envie senhas nem dados de clientes. A conversa fica só nesta aba e não altera sua loja.</p></footer>
    </dialog>
  </div>;
}
