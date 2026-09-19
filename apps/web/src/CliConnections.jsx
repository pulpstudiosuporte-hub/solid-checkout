import { useEffect, useState } from 'react';
import { cliRequest } from './cli-api';
import './cli-connections.css';

export default function CliConnections({ csrfToken, storeName = 'loja selecionada' }) {
  const [code, setCode] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [canPublish, setCanPublish] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = () => cliRequest('/connections').then(result => setItems(result.items));
  useEffect(() => { load().catch(error => setMessage(error.message)); }, []);
  async function run(task) {
    setBusy(true); setMessage('');
    try { await task(); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <section className="settings-hub-panel cli-connections" aria-label="Conexões da CLI">
    <header><h2>Sua IDE conectada à Pirat</h2><p>Autorize a CLI para editar os checkouts de {storeName}. A conexão expira em 30 dias e pode ser revogada a qualquer momento.</p></header>
    <p><a href="/downloads/pirat-cli.zip" download>Baixar CLI e prévia local</a> · <a href="https://docs.apirat.io/#/docs/cli-conectada" target="_blank" rel="noreferrer">Guia de instalação e comandos</a></p>
    <form onSubmit={event => { event.preventDefault(); void run(async () => { setCandidate(await cliRequest('/device/approve', 'POST', { userCode: code, inspect: true }, csrfToken)); }); }}>
      <label className="settings-hub-field"><span>Código mostrado no seu terminal</span><input value={code} onChange={event => { setCode(event.target.value); setCandidate(null); }} maxLength={16} autoComplete="off" placeholder="Código de 10 caracteres" required /></label>
      <button className="secondary" type="submit" disabled={busy || !code.trim()}>Conferir conexão</button>
    </form>
    {candidate && <div className="cli-approval">
      <h3>Conectar {candidate.label}</h3><p>Loja: <strong>{candidate.store.name}</strong>. Permite ler e editar os rascunhos dos checkouts desta loja.</p>
      <p>Confira se o código é o mesmo do comando que você iniciou no seu computador.</p>
      <label><input type="checkbox" checked={canPublish} onChange={event => setCanPublish(event.target.checked)} /> Permitir também publicar checkouts</label>
      <p><button className="primary" type="button" disabled={busy} onClick={() => void run(async () => { await cliRequest('/device/approve', 'POST', { userCode: code, canPublish, storePublicId: candidate.store.publicId }, csrfToken); setCandidate(null); setCode(''); setCanPublish(false); setMessage('Conexão autorizada. Volte ao terminal para concluir.'); })}>Autorizar nesta loja</button></p>
    </div>}
    <p role="status">{busy ? 'Processando…' : message}</p>
    <h3>Suas conexões nesta loja</h3><button className="secondary" type="button" disabled={busy} onClick={() => void run(load)}>Atualizar lista</button>
    {!items.length && <p>Nenhuma conexão ativa.</p>}
    {items.map(item => <article className="cli-connection-row" key={item.id}><div><strong>{item.label}</strong><p>{item.canPublish ? 'Rascunhos e publicação' : 'Somente rascunhos'} · expira em {new Date(item.expiresAt).toLocaleDateString('pt-BR')}</p></div><button className="secondary" type="button" disabled={busy} onClick={() => void run(async () => { await cliRequest(`/connections/${item.id}`, 'DELETE', undefined, csrfToken); await load(); setMessage('Acesso revogado.'); })}>Revogar acesso</button></article>)}
  </section>;
}
