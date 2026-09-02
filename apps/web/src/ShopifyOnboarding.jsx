import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Circle, Clipboard, ExternalLink, HelpCircle, KeyRound, PackageCheck, Palette, RefreshCw, Settings2, ShoppingBag } from 'lucide-react';
import './shopify-onboarding.css';

const themeSnippet = `<script
  src="https://app.solidcheckout.xyz/shopify/solid-checkout.js"
  defer
  data-solid-checkout
  data-proxy-path="/apps/solid-checkout/checkout-session"
  data-pay-url="https://app.solidcheckout.xyz"
  data-fallback="true">
</script>`;

const guide = [
  {
    key: 'create', title: 'Crie seu app no Dev Dashboard', icon: ShoppingBag, description: 'O app pertencerá à sua organização Shopify.', path: 'Dev Dashboard → Apps → Criar app', action: 'dashboard', actionLabel: 'Abrir Dev Dashboard', manual: true,
    instructions: ['Abra o Dev Dashboard com a mesma conta proprietária da loja.', 'Clique em Apps e depois em Criar app.', 'Escolha Começar a partir do Dev Dashboard.', 'Use um nome fácil de reconhecer, como “SOLID Checkout — Minha Loja”.', 'Este app pertence à sua loja; não compartilhe as credenciais.'],
  },
  {
    key: 'permissions', title: 'Crie uma versão com as permissões', icon: Settings2, description: 'Os escopos ficam em Versões, não em Credenciais.', path: 'Seu app → Versões → Criar uma versão', action: 'dashboard', actionLabel: 'Abrir versões do app', manual: true,
    instructions: ['No menu lateral do app, abra Versões e clique em Criar uma versão.', 'Em URL do app, use https://app.solidcheckout.xyz e desmarque Incorporar app ao admin da Shopify.', 'Em Escopos, cole exatamente: read_products,write_orders,write_app_proxy', 'Não marque Usar fluxo de instalação legado.', 'Abra Proxy do app: prefixo apps, subcaminho solid-checkout e URL https://api.solidcheckout.xyz/integrations/shopify/proxy', 'Clique em Lançar, informe um nome opcional para a versão e confirme. Isso ativa a configuração; não publica o app na App Store.'],
  },
  {
    key: 'install', title: 'Instale o app na sua loja', icon: PackageCheck, description: 'Associe a versão publicada à loja que será conectada.', path: 'Seu app → Início → Instalar app', action: 'dashboard', actionLabel: 'Abrir página do app', manual: true,
    instructions: ['Depois de lançar a versão, abra Início no menu lateral do app.', 'Clique em Instalar app e selecione a loja correta.', 'Revise produtos, pedidos e proxy do app na tela da Shopify e confirme.', 'Ao terminar, o app aparece em Configurações → Apps e canais de vendas da loja.'],
  },
  {
    key: 'credentials', title: 'Copie as credenciais e conecte', icon: KeyRound, description: 'ID do cliente e chave secreta ficam em Credenciais.', path: 'Seu app → Credenciais', action: 'credentials', actionLabel: 'Preencher credenciais na SOLID',
    instructions: ['No menu lateral do app, abra Credenciais.', 'Copie o ID do cliente e a Chave secreta.', 'Na SOLID, informe também o domínio original nomedaloja.myshopify.com.', 'Clique em Conectar app próprio. A SOLID validará a instalação e as permissões.', 'Nunca envie a chave secreta por mensagem ou captura de tela.'],
  },
  {
    key: 'sync', title: 'Sincronize o catálogo', icon: RefreshCw, description: 'Importe produtos, variantes, imagens e coleções.', path: 'SOLID → Integrações → Shopify', action: 'sync', actionLabel: 'Ir para sincronização',
    instructions: ['Com a conexão ativa, clique em Sincronizar catálogo.', 'Confira as quantidades importadas.', 'As credenciais geram tokens de 24 horas, mas a SOLID os renova automaticamente.', 'Execute uma nova sincronização quando quiser refletir alterações imediatamente.'],
  },
  {
    key: 'checkout', title: 'Crie o modelo automático da Shopify', icon: Palette, description: 'Personalize uma vez; o carrinho real preenche os produtos.', path: 'SOLID → Checkouts → Criar checkout → Loja Shopify', action: 'checkout', actionLabel: 'Criar modelo Shopify', manual: true,
    instructions: ['Escolha Loja Shopify — não selecione um produto.', 'Personalize o checkout com as cores, elementos e ordem desejados.', 'Publique o modelo. O último modelo Shopify publicado se torna o padrão da loja.', 'O comprador verá exatamente os produtos, variantes, quantidades e preços que escolheu no carrinho da Shopify.'],
  },
  {
    key: 'theme', title: 'Ative pelo código do tema', icon: ShoppingBag, description: 'Não use “Incorporações de apps”: o app próprio é ativado em theme.liquid.', path: 'Shopify Admin → Loja virtual → Temas → … → Editar código → layout/theme.liquid', code: themeSnippet, manual: true,
    instructions: ['Não procure a SOLID em Incorporações de apps. Apps próprios criados no Dev Dashboard não aparecem nessa lista sem uma extensão publicada pela Shopify CLI.', 'Volte para Loja virtual → Temas, localize o tema publicado, abra o menu de três pontos (…) e clique em Editar código.', 'Na coluna de arquivos, abra a pasta layout e selecione theme.liquid.', 'Use Ctrl+F para localizar </body> perto do final do arquivo.', 'Cole o código abaixo imediatamente antes de </body>, clique em Salvar e aguarde a confirmação da Shopify.', 'Abra sua loja em uma janela anônima, adicione produtos ao carrinho e clique em Finalizar compra.', 'A SOLID recebe o carrinho assinado pela Shopify. Se a SOLID estiver indisponível, o checkout nativo será usado automaticamente.'],
  },
];

function readProgress(storageKey) {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}

export default function ShopifyOnboarding({ connected, synced, enteredShop, storeKey, onAction }) {
  const storageKey = `solid-shopify-own-app-guide-${storeKey || 'store'}`;
  const [manual, setManual] = useState(() => readProgress(storageKey));
  const [copied, setCopied] = useState(false);
  const firstPendingStep = !connected ? 0 : !synced ? 4 : !manual.checkout ? 5 : !manual.theme ? 6 : null;
  const [expanded, setExpanded] = useState(firstPendingStep);
  const [open, setOpen] = useState(firstPendingStep !== null);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(manual)); } catch { /* armazenamento pode estar bloqueado */ } }, [manual, storageKey]);
  const completed = { create: Boolean(manual.create), permissions: Boolean(manual.permissions), install: Boolean(manual.install), credentials: connected || Boolean(enteredShop?.trim() && manual.credentials), sync: synced, checkout: Boolean(manual.checkout), theme: Boolean(manual.theme) };
  const total = Object.values(completed).filter(Boolean).length;
  const progress = useMemo(() => `${Math.round((total / guide.length) * 100)}%`, [total]);
  return <section className="card shopify-onboarding">
    <button className="onboarding-summary" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}><span className="onboarding-help"><HelpCircle size={21}/></span><div><span>TUTORIAL SHOPIFY 2026</span><h2>Crie e conecte seu próprio app</h2><p>{total} de {guide.length} etapas concluídas</p></div><div className="onboarding-progress" aria-label={`${total} de ${guide.length} etapas concluídas`}><i style={{ '--progress': progress }}/><strong>{progress}</strong></div><ChevronDown className={open ? 'rotated' : ''} size={20}/></button>
    {open && <div className="onboarding-body">
      <div className="onboarding-intro" role="note"><strong>Este é o processo atual da Shopify para apps novos.</strong><span>Desde janeiro de 2026, o token permanente criado no Admin é um fluxo legado. Use Client ID e Client secret do Dev Dashboard.</span></div>
      {!manual.theme && <div className="onboarding-theme-warning" role="alert"><div><strong>O app não aparecerá em “Incorporações de apps”.</strong><span>Para concluir, adicione a ponte da SOLID diretamente no arquivo <code>layout/theme.liquid</code>.</span></div><button type="button" onClick={() => setExpanded(6)}>Ver ativação no tema</button></div>}
      <div className="onboarding-steps">{guide.map((step, index) => { const Icon = step.icon; const done = completed[step.key]; return <article className={`${done ? 'done ' : ''}${step.key === 'theme' ? 'theme-required' : ''}`} key={step.key}><button className="guide-step-main" type="button" onClick={() => setExpanded(value => value === index ? null : index)} aria-expanded={expanded === index}><span className="guide-status">{done ? <Check size={16}/> : <b>{index + 1}</b>}</span><span className="guide-icon"><Icon size={18}/></span><div><span className="guide-kind">{step.manual ? 'CONFIRMAÇÃO MANUAL' : 'VERIFICAÇÃO AUTOMÁTICA'}</span><h3>{step.title}</h3><p>{step.description}</p></div><ChevronDown className={expanded === index ? 'rotated' : ''} size={18}/></button>{expanded === index && <div className="guide-detail"><div className="guide-path"><strong>Caminho</strong><span>{step.path}</span></div><ol>{step.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol>{step.code && <div className="guide-code"><pre><code>{step.code}</code></pre><button type="button" onClick={() => navigator.clipboard.writeText(step.code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); })}><Clipboard size={14}/>{copied ? 'Código copiado' : 'Copiar código'}</button></div>}<div className="guide-actions">{step.action && <button type="button" className="guide-action" disabled={step.action === 'sync' && !connected} onClick={() => onAction?.(step.action)}>{step.actionLabel}{step.action === 'dashboard' && <ExternalLink size={14}/>}</button>}{step.manual && <label><input type="checkbox" aria-label={`Marcar ${step.title} como concluída`} checked={Boolean(manual[step.key])} onChange={event => setManual(current => ({ ...current, [step.key]: event.target.checked }))}/> Marcar como concluída</label>}</div></div>}</article>; })}</div>
      <div className="onboarding-intro shopify-extension-note" role="note"><strong>Dois modelos, dois usos.</strong><span>O modelo Shopify recebe o carrinho real automaticamente. Para infoprodutos, crie um Link para infoproduto e escolha um produto fixo para compartilhar.</span></div>
      <footer className="onboarding-footer"><span><Circle size={13}/> O progresso do tutorial fica salvo somente nesta loja.</span><button className="skip-guide" type="button" onClick={() => setOpen(false)}>Ocultar por enquanto</button></footer>
    </div>}
  </section>;
}
