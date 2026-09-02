import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Circle, Clipboard, ExternalLink, Globe2, HelpCircle, KeyRound, PackageCheck, Palette, RefreshCw, Settings2, ShoppingBag, TestTube2, UserCheck } from 'lucide-react';
import './shopify-onboarding.css';

const appUrl = 'https://app.solidcheckout.xyz';
const apiUrl = 'https://api.solidcheckout.xyz';

function buildThemeSnippet(checkoutHost) {
  const payUrl = checkoutHost ? `https://${checkoutHost}` : appUrl;
  return `<script
  src="${appUrl}/shopify/solid-checkout.js"
  defer
  data-solid-checkout
  data-proxy-path="/apps/solid-checkout/checkout-session"
  data-pay-url="${payUrl}"
  data-fallback="true">
</script>`;
}

function buildGuide(checkoutHost) {
  return [
    {
      key: 'prerequisites', title: 'Conclua os pré-requisitos da SOLID', icon: UserCheck, description: 'Ative o cadastro e o domínio antes de publicar.', path: 'SOLID → Configurações e Domínios', action: 'prerequisites', actionLabel: 'Revisar pré-requisitos', automatic: true,
      instructions: ['Conclua os dados obrigatórios da loja e do responsável.', 'Adicione um domínio de checkout e aguarde o status Ativo.', 'O modelo pode ser editado antes disso, mas a publicação e o redirecionamento dependem desses dois itens.'],
    },
    {
      key: 'create', title: 'Crie seu app no Dev Dashboard', icon: ShoppingBag, description: 'O app deve pertencer à mesma organização da loja.', path: 'Dev Dashboard → Apps → Criar app', action: 'dashboard', actionLabel: 'Abrir Dev Dashboard', manual: true,
      instructions: ['Entre no Dev Dashboard com a conta proprietária da mesma organização Shopify da loja.', 'Clique em Apps, Criar app e Começar a partir do Dev Dashboard.', 'Use um nome reconhecível, como “SOLID Checkout — Minha Loja”.', 'Não compartilhe o Client secret: esse app e as credenciais pertencem à sua operação.'],
    },
    {
      key: 'permissions', title: 'Crie e lance uma versão', icon: Settings2, description: 'Configure URLs, escopos e App Proxy na mesma versão.', path: 'Seu app → Versões → Criar uma versão', action: 'dashboard', actionLabel: 'Abrir Dev Dashboard', manual: true,
      instructions: [`Em URL do app, use ${appUrl} e desmarque “Incorporar app ao admin da Shopify”.`, 'Em Escopos, cole exatamente: read_products,write_orders,write_app_proxy', 'Não marque “Usar fluxo de instalação legado”.', `Em Proxy do app, escolha prefixo apps, subcaminho solid-checkout e URL ${apiUrl}/integrations/shopify/proxy.`, 'Clique em Lançar. A propagação da versão pode levar alguns minutos.', 'Se alterar escopos ou o proxy depois, lance outra versão e aprove as novas permissões; em instalações antigas, pode ser necessário reinstalar o app.'],
    },
    {
      key: 'install', title: 'Instale o app na loja correta', icon: PackageCheck, description: 'A instalação concede as permissões da versão lançada.', path: 'Seu app → Início → Instalar app', action: 'dashboard', actionLabel: 'Abrir Dev Dashboard', manual: true,
      instructions: ['Clique em Instalar app e selecione a loja correta.', 'Revise produtos, pedidos e proxy e confirme a instalação.', 'Confirme em Shopify Admin → Configurações → Apps e canais de vendas.', 'Se a instalação continuar em zero, aguarde a versão propagar, atualize a página e tente novamente.'],
    },
    {
      key: 'credentials', title: 'Conecte as credenciais na SOLID', icon: KeyRound, description: 'A API valida loja, instalação e todos os escopos.', path: 'Seu app → Configurações → Credenciais; depois SOLID → Integrações → Shopify', action: 'credentials', actionLabel: 'Preencher credenciais',
      instructions: ['Abra Configurações no menu do app e copie o ID do cliente e a Chave secreta na seção Credenciais.', 'Informe também o domínio original nomedaloja.myshopify.com.', 'Clique em Conectar app próprio.', 'Se faltar uma permissão, volte à versão do app, corrija os escopos, lance novamente e aprove a alteração.', 'Nunca envie a chave secreta por mensagem ou captura de tela.'],
    },
    {
      key: 'sync', title: 'Sincronize e confira o catálogo', icon: RefreshCw, description: 'Valide produtos, variantes, imagens e coleções.', path: 'SOLID → Integrações → Shopify', action: 'sync', actionLabel: 'Ir para sincronização',
      instructions: ['Clique em Sincronizar catálogo.', 'Confira se os totais importados correspondem à loja.', 'A SOLID renova automaticamente os tokens temporários.', 'Sincronize novamente quando precisar refletir uma alteração imediatamente.'],
    },
    {
      key: 'checkout', title: 'Crie e publique o modelo Shopify', icon: Palette, description: 'Um modelo automático atende qualquer carrinho da loja.', path: 'SOLID → Checkouts → Criar checkout → Loja Shopify', action: 'checkout', actionLabel: 'Abrir Checkouts', manual: true,
      instructions: ['Escolha Loja Shopify; não selecione um produto fixo.', 'Personalize o visual e publique o modelo.', 'O modelo Shopify publicado recebe os produtos, variantes, quantidades e preços do carrinho real.', 'Para infoprodutos, crie separadamente um Link para infoproduto com produto fixo.'],
    },
    {
      key: 'theme', title: 'Ative a ponte no tema com segurança', icon: Globe2, description: 'Faça backup do tema e adicione um único snippet.', path: 'Shopify Admin → Loja virtual → Temas → … → Duplicar; depois Editar código → layout/theme.liquid', code: buildThemeSnippet(checkoutHost), manual: true, requiresDomain: true,
      instructions: ['Duplique o tema antes de editar; o tema duplicado é o seu ponto de restauração.', 'No tema publicado, abra Editar código e o arquivo layout/theme.liquid.', 'Procure </body> e confirme que ainda não existe “data-solid-checkout”.', 'Cole o código imediatamente antes de </body> e salve.', 'Este app não possui extensão de tema, portanto não aparecerá em “Incorporações de apps”.', 'Para desfazer, remova somente esse bloco <script> ou restaure a cópia do tema.'],
    },
    {
      key: 'test', title: 'Faça o teste final de ponta a ponta', icon: TestTube2, description: 'Confirme redirecionamento, carrinho e fallback.', path: 'Loja publicada → janela anônima → produto → carrinho → Finalizar compra', manual: true,
      instructions: ['Teste em janela anônima no celular e no desktop.', 'Adicione dois produtos, altere quantidades e finalize pelo carrinho e pelo botão Comprar agora.', 'Confirme se a URL abre no seu domínio ativo e se itens, variantes, quantidades e valores estão corretos.', 'Gere o Pix e confira o pedido na SOLID; não faça um pagamento real se estiver apenas validando.', 'Se a SOLID não puder criar a sessão, o fallback deve levar ao checkout nativo da Shopify.'],
    },
  ];
}

function readProgress(storageKey) {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}

export default function ShopifyOnboarding({ connected, synced, enteredShop, storeKey, checkoutHost, activationCompleted, onAction }) {
  const storageKey = `solid-shopify-own-app-guide-${storeKey || 'store'}`;
  const guide = useMemo(() => buildGuide(checkoutHost), [checkoutHost]);
  const [manual, setManual] = useState(() => readProgress(storageKey));
  const [copied, setCopied] = useState(false);
  const prerequisitesReady = Boolean(activationCompleted && checkoutHost);
  const completed = { prerequisites: prerequisitesReady, create: Boolean(manual.create), permissions: Boolean(manual.permissions), install: Boolean(manual.install), credentials: connected || Boolean(enteredShop?.trim() && manual.credentials), sync: synced, checkout: Boolean(manual.checkout), theme: Boolean(manual.theme && checkoutHost), test: Boolean(manual.test) };
  const firstPendingStep = guide.findIndex(step => !completed[step.key]);
  const [expanded, setExpanded] = useState(firstPendingStep >= 0 ? firstPendingStep : 0);
  const [open, setOpen] = useState(firstPendingStep >= 0);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(manual)); } catch { /* armazenamento pode estar bloqueado */ } }, [manual, storageKey]);
  const total = Object.values(completed).filter(Boolean).length;
  const progress = `${Math.round((total / guide.length) * 100)}%`;
  const themeIndex = guide.findIndex(step => step.key === 'theme');
  const activeStep = guide[expanded] || guide[0];
  const ActiveIcon = activeStep.icon;
  const activeDone = completed[activeStep.key];
  const activeBlocked = Boolean(activeStep.requiresDomain && !checkoutHost);
  const selectStep = index => { setExpanded(index); setOpen(true); };
  const copyCode = () => navigator.clipboard.writeText(activeStep.code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); });

  return <section className="card shopify-onboarding">
    <button className="onboarding-summary" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}><span className="onboarding-help"><HelpCircle size={21}/></span><div><span>GUIA ASSISTIDO · SHOPIFY</span><h2>Configure sua loja para vender com a SOLID</h2><p>{total} de {guide.length} etapas concluídas</p></div><div className="onboarding-progress" aria-label={`${total} de ${guide.length} etapas concluídas`}><i style={{ '--progress': progress }}/><strong>{progress}</strong></div><ChevronDown className={open ? 'rotated' : ''} size={20}/></button>
    {open && <div className="onboarding-body">
      <div className="onboarding-intro" role="note"><strong>Jornada para app próprio da sua organização Shopify.</strong><span>A instalação por Client ID e Client secret funciona quando o app e a loja pertencem à mesma organização. Você pode ocultar o tutorial e continuar depois.</span></div>
      {!checkoutHost && <div className="onboarding-theme-warning" role="alert"><div><strong>O domínio do checkout ainda não está ativo.</strong><span>Configure o domínio antes de publicar o modelo ou copiar o código do tema.</span></div><button type="button" onClick={() => onAction?.('domains')}>Configurar domínio</button></div>}
      {checkoutHost && !manual.theme && <div className="onboarding-theme-warning" role="alert"><div><strong>Falta ativar a ponte no tema.</strong><span>O código já usa o domínio ativo <code>{checkoutHost}</code>.</span></div><button type="button" onClick={() => selectStep(themeIndex)}>Ver ativação no tema</button></div>}
      <div className="onboarding-workspace">
        <nav className="onboarding-step-list" aria-label="Etapas do tutorial">{guide.map((step, index) => { const Icon = step.icon; const done = completed[step.key]; const blocked = Boolean(step.requiresDomain && !checkoutHost); return <button type="button" key={step.key} className={`${expanded === index ? 'active ' : ''}${done ? 'done ' : ''}${blocked ? 'blocked' : ''}`} aria-current={expanded === index ? 'step' : undefined} onClick={() => selectStep(index)}><span className="guide-status">{done ? <Check size={15}/> : <b>{index + 1}</b>}</span><span className="guide-icon"><Icon size={17}/></span><span className="guide-step-copy"><small>{step.automatic ? 'VERIFICAÇÃO AUTOMÁTICA' : step.manual ? 'CONFIRMAÇÃO MANUAL' : 'AÇÃO NA SOLID'}</small><strong>{step.title}</strong></span><ChevronDown size={16} aria-hidden="true"/></button>; })}</nav>
        <article className={`guide-panel ${activeDone ? 'done ' : ''}${activeBlocked ? 'blocked' : ''}`} aria-labelledby={`guide-title-${activeStep.key}`}>
          <header><span className="guide-panel-icon"><ActiveIcon size={20}/></span><div><small>{expanded + 1} DE {guide.length}</small><h3 id={`guide-title-${activeStep.key}`}>{activeStep.title}</h3><p>{activeStep.description}</p></div>{activeDone && <span className="guide-complete"><Check size={14}/> Concluída</span>}</header>
          {activeBlocked && <p className="guide-blocked-message" role="status">Ative o domínio para liberar esta etapa.</p>}
          <div className="guide-path"><strong>Caminho</strong><span>{activeStep.path}</span></div>
          <ol>{activeStep.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol>
          {activeStep.code && !activeBlocked && <div className="guide-code"><pre><code>{activeStep.code}</code></pre><button type="button" onClick={copyCode}><Clipboard size={14}/>{copied ? 'Código copiado' : 'Copiar código'}</button></div>}
          <div className="guide-actions">{activeStep.action && <button type="button" className="guide-action" disabled={(activeStep.action === 'sync' && !connected) || activeBlocked} onClick={() => onAction?.(activeStep.action)}>{activeStep.actionLabel}{activeStep.action === 'dashboard' && <ExternalLink size={14}/>}</button>}{activeStep.manual && <label><input type="checkbox" aria-label={`Marcar ${activeStep.title} como concluída`} checked={Boolean(manual[activeStep.key])} disabled={activeBlocked} onChange={event => setManual(current => ({ ...current, [activeStep.key]: event.target.checked }))}/> Marcar como concluída</label>}</div>
          <footer className="guide-pagination"><button type="button" disabled={expanded === 0} onClick={() => selectStep(expanded - 1)}>Anterior</button><span>Etapa {expanded + 1} de {guide.length}</span><button type="button" disabled={expanded === guide.length - 1} onClick={() => selectStep(expanded + 1)}>Próxima</button></footer>
        </article>
      </div>
      <footer className="onboarding-footer"><span><Circle size={13}/> O progresso fica salvo somente nesta loja e pode ser retomado depois.</span><button className="skip-guide" type="button" onClick={() => setOpen(false)}>Ocultar por enquanto</button></footer>
    </div>}
  </section>;
}
