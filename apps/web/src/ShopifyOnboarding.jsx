import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Circle, ExternalLink, HelpCircle, Plug, RefreshCw, ShoppingBag, TestTube2 } from 'lucide-react';
import './shopify-onboarding.css';

const guide = [
  { title: 'Localize o domínio da sua loja', icon: ShoppingBag, description: 'Copie o endereço terminado em .myshopify.com.', detail: 'Você encontra esse endereço em Configurações → Domínios. Não use o domínio personalizado da vitrine.' },
  { title: 'Instale e autorize o app SOLID', icon: Plug, description: 'Clique em Conectar com Shopify e aprove o acesso.', detail: 'A SOLID nunca solicita sua senha. A autorização acontece na Shopify e pode ser revogada quando quiser.' },
  { title: 'Sincronize o catálogo', icon: RefreshCw, description: 'Importe produtos, variantes, imagens e coleções.', detail: 'Depois da primeira importação, sincronize novamente sempre que alterar produtos na Shopify.' },
  { title: 'Ative o redirecionamento no tema', icon: ExternalLink, description: 'Ative o App Embed “SOLID Checkout” e salve.', detail: 'Em Loja virtual → Temas → Personalizar, abra App embeds, ative SOLID Checkout, informe o domínio e salve.' },
  { title: 'Faça uma compra de teste', icon: TestTube2, description: 'Confirme se o carrinho abre o checkout SOLID.', detail: 'Teste em janela anônima e confira produto, preço, frete e geração do Pix antes de vender.' },
];

export default function ShopifyOnboarding({ connected, synced, shopDomain, storeKey }) {
  const storageKey = `solid-shopify-guide-${storeKey || 'store'}`;
  const [manual, setManual] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; } });
  const [expanded, setExpanded] = useState(connected ? null : 0); const [open, setOpen] = useState(!connected || !synced);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(manual)); } catch { /* armazenamento pode estar bloqueado */ } }, [manual, storageKey]);
  const completed = [Boolean(shopDomain), connected, synced, Boolean(manual.embed), Boolean(manual.test)]; const total = completed.filter(Boolean).length;
  const progress = useMemo(() => `${Math.round((total / guide.length) * 100)}%`, [total]);
  const themeUrl = shopDomain ? `https://${shopDomain}/admin/themes/current/editor?context=apps` : null;
  return <section className="card shopify-onboarding"><button className="onboarding-summary" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}><span className="onboarding-help"><HelpCircle size={21}/></span><div><span>GUIA DE CONFIGURAÇÃO</span><h2>Conecte sua Shopify à SOLID</h2><p>{total} de {guide.length} etapas concluídas</p></div><div className="onboarding-progress" aria-label={`${total} de ${guide.length} etapas concluídas`}><i style={{ '--progress': progress }}/><strong>{progress}</strong></div><ChevronDown className={open ? 'rotated' : ''} size={20}/></button>{open && <div className="onboarding-steps">{guide.map((step, index) => { const Icon = step.icon; const done = completed[index]; const isManual = index >= 3; return <article className={done ? 'done' : ''} key={step.title}><button className="guide-step-main" type="button" onClick={() => setExpanded(value => value === index ? null : index)} aria-expanded={expanded === index}><span className="guide-status">{done ? <Check size={16}/> : <Circle size={16}/>}</span><span className="guide-icon"><Icon size={18}/></span><div><h3>{step.title}</h3><p>{step.description}</p></div><ChevronDown className={expanded === index ? 'rotated' : ''} size={18}/></button>{expanded === index && <div className="guide-detail"><p>{step.detail}</p>{index === 3 && themeUrl && <a href={themeUrl} target="_blank" rel="noreferrer">Abrir editor do tema <ExternalLink size={15}/></a>}{isManual && <label><input type="checkbox" checked={Boolean(index === 3 ? manual.embed : manual.test)} onChange={event => setManual(current => ({ ...current, [index === 3 ? 'embed' : 'test']: event.target.checked }))}/> Marcar esta etapa como concluída</label>}</div>}</article>; })}<button className="skip-guide" type="button" onClick={() => setOpen(false)}>Ocultar tutorial por enquanto</button></div>}</section>;
}
