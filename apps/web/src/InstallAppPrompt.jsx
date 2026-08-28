import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
const DISMISSED_KEY = 'solid:pwa-install-dismissed';
export default function InstallAppPrompt() {
  const [prompt, setPrompt] = useState(null); const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.localStorage.getItem(DISMISSED_KEY) === 'yes') return undefined;
    const capture = event => { event.preventDefault(); setPrompt(event); }; window.addEventListener('beforeinstallprompt', capture);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) setIosHelp(true);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);
  if (!prompt && !iosHelp) return null;
  const close = () => { window.localStorage.setItem(DISMISSED_KEY, 'yes'); setPrompt(null); setIosHelp(false); };
  const install = async () => { await prompt.prompt(); const result = await prompt.userChoice; if (result.outcome === 'accepted') close(); };
  return <aside className="install-app-card" aria-label="Instalar aplicativo SOLID"><span><Download size={20}/></span><div><strong>Use a SOLID como aplicativo</strong><small>{iosHelp ? <>No Safari, toque em <Share2 size={13}/> e depois em “Adicionar à Tela de Início”.</> : 'Instale no celular para abrir mais rápido e em tela cheia.'}</small></div>{prompt && <button className="install-app-action" onClick={() => void install()}>Instalar</button>}<button className="install-app-close" onClick={close} aria-label="Fechar sugestão de instalação"><X size={18}/></button></aside>;
}
