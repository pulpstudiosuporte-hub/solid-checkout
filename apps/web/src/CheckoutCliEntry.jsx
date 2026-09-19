import { useState } from 'react';
import { ArrowUpRight, Check, Code2, Copy, Terminal } from 'lucide-react';
import './checkout-cli-entry.css';

const prefix = 'npx --yes --package=https://docs.apirat.io/downloads/pirat-cli-0.1.0.tgz pirat';
const models = [{ id: 'current', name: 'Seu checkout', description: 'Continue de onde parou' }, { id: 'minimal', name: 'Minimal', description: 'Leve e direto ao ponto' }, { id: 'retail', name: 'Varejo', description: 'Produtos, etapas e resumo' }, { id: 'marketplace', name: 'Marketplace', description: 'Seções em cartões' }];
export default function CheckoutCliEntry({ checkouts, disabled }) {
  const [model, setModel] = useState('current'), [checkoutId, setCheckoutId] = useState(''), [copied, setCopied] = useState(''), [error, setError] = useState('');
  const selected = checkouts.find(item => item.publicId === checkoutId) || checkouts[0];
  const commands = [{ id: 'login', label: '01 · Conecte sua loja', code: `${prefix} login` }, { id: 'pull', label: '02 · Baixe seu projeto', code: selected ? `${prefix} checkout pull ${selected.publicId} minha-loja${model === 'current' ? '' : ` --template ${model}`}` : '' }];
  async function copy(id, code) { try { await navigator.clipboard.writeText(code); setCopied(id); setError(''); } catch { setError('Selecione o comando e copie manualmente.'); } }
  function connect() { window.location.hash = '/cli'; window.dispatchEvent(new CustomEvent('solid:navigate', { detail: 'Configurações' })); }
  return <section className="checkout-cli-entry" aria-labelledby="checkout-cli-title">
    <div className="checkout-cli-intro"><p className="checkout-cli-eyebrow"><Code2 size={16} aria-hidden="true"/> PIRAT PARA DEVS</p><h2 id="checkout-cli-title">Seu checkout.<br/><em>Na sua IDE.</em></h2><p>Escolha uma base, abra na sua IDE e construa com a sua IA. Veja cada ajuste antes de enviar.</p><button className="checkout-cli-connect" type="button" disabled={disabled} onClick={connect}>Configurar CLI <ArrowUpRight size={18} aria-hidden="true"/></button><a href="https://docs.apirat.io/#/docs/cli-conectada" target="_blank" rel="noreferrer">Ler a documentação</a></div>
    <div className="checkout-cli-workbench"><fieldset className="checkout-cli-models"><legend>Escolha seu ponto de partida</legend>{models.map(item => <label key={item.id} className={model === item.id ? 'selected' : ''}><input type="radio" name="cli-template" value={item.id} checked={model === item.id} onChange={() => setModel(item.id)}/><span className={`checkout-cli-mini ${item.id}`} aria-hidden="true"><i/><i/><i/></span><strong>{item.name}</strong><small>{item.description}</small></label>)}</fieldset>
      <label className="checkout-cli-target">Checkout do projeto<select value={selected?.publicId || ''} onChange={event => setCheckoutId(event.target.value)} disabled={!checkouts.length}>{!checkouts.length && <option value="">Nenhum checkout criado</option>}{checkouts.map(item => <option value={item.publicId} key={item.publicId}>{item.name}</option>)}</select></label>
      <div className="checkout-cli-terminal"><header><Terminal size={16} aria-hidden="true"/><span>Terminal</span><small>Node.js 22.12+</small></header>{commands.map(item => <div className="checkout-cli-command" key={item.id}><span>{item.label}</span>{item.code ? <div><code>{item.code}</code><button type="button" aria-label={`Copiar comando de ${item.id === 'login' ? 'conexão' : 'download'}`} onClick={() => void copy(item.id, item.code)}>{copied === item.id ? <Check size={17}/> : <Copy size={17}/>}</button></div> : <p>Crie um checkout para baixar o projeto.</p>}</div>)}<p className="checkout-cli-terminal-note">Depois: <code>cd minha-loja</code> e <code>npm run dev</code></p></div>
      <p className="checkout-cli-feedback" role="status">{error || (copied ? 'Comando copiado.' : 'Prévia local → rascunho → publicação. Você decide quando colocar no ar.')}</p>
    </div>
  </section>;
}
