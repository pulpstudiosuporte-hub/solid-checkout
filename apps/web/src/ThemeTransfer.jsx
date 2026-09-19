import { useRef, useState } from 'react';
import { applyTheme, exportTheme, MAX_THEME_BYTES, parseTheme } from './theme-kit/contract.mjs';

export default function ThemeTransfer({ config, replaceConfig }) {
  const [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  async function read(file) {
    setCandidate(null); setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_THEME_BYTES) throw new Error('O tema excede 32 KB.');
      setCandidate(parseTheme(await file.text()));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function download() {
    try {
      const theme = exportTheme(config);
      const url = URL.createObjectURL(new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'meu-tema.pirat.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Tema exportado. O arquivo contém apenas as opções visuais suportadas.');
    } catch (error) { setMessage(error.message); }
  }
  return <section className="theme-transfer" aria-label="Temas para desenvolvedores">
    <h3>Seu tema, do seu jeito</h3>
    <p className="panel-help">Baixe um modelo, ajuste com sua IA e importe aqui. Você confere o visual antes de salvar.</p>
    <a href="/downloads/pirat-theme-kit-v1.zip" download>Baixar kit de temas</a>{' · '}
    <a href="https://docs.apirat.io/#/docs/temas-cli" target="_blank" rel="noreferrer">Guia para devs</a>
    <div className="theme-transfer-actions">
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>Importar tema</button>
      <button type="button" onClick={download}>Exportar visual atual</button>
    </div>
    <input ref={input} className="sr-only" type="file" accept=".json,application/json" aria-label="Arquivo do tema" disabled={busy} onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }}/>
    {candidate && <div className="theme-transfer-review">
      <strong>{candidate.name}</strong>
      <p>{Object.keys(candidate.config).length} opções visuais · estrutura {candidate.config.template}.</p>
      <p>Aplicar troca essas opções na prévia e mantém textos, imagens e elementos. Você pode desfazer antes de salvar.</p>
      <div className="theme-transfer-actions"><button type="button" onClick={() => {
        replaceConfig(old => applyTheme(old, candidate)); setCandidate(null); setMessage('Tema aplicado na prévia. Confira e salve o rascunho quando estiver pronto.');
      }}>Aplicar na prévia</button><button type="button" onClick={() => setCandidate(null)}>Cancelar importação</button></div>
    </div>}
    <p role="status" className="panel-help" style={{ whiteSpace: 'pre-line' }}>{busy ? 'Lendo tema…' : message}</p>
  </section>;
}
