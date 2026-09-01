import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Circle, ExternalLink, HelpCircle, LayoutTemplate, Plug, RefreshCw, ShoppingBag, TestTube2 } from 'lucide-react';
import './shopify-onboarding.css';

const guide = [
  {
    key: 'domain',
    title: 'Encontre o domínio original da loja',
    icon: ShoppingBag,
    description: 'Copie o endereço que termina em .myshopify.com.',
    instructions: [
      'Abra o painel administrativo da Shopify.',
      'Entre em Configurações e depois em Domínios.',
      'Copie o domínio “nomedaloja.myshopify.com”. Não use o domínio público da vitrine.',
      'Volte à SOLID, cole o endereço no campo Domínio MyShopify e mantenha somente o nome da loja.',
    ],
    action: 'domain',
    actionLabel: 'Preencher domínio',
  },
  {
    key: 'connection',
    title: 'Instale e autorize o app SOLID',
    icon: Plug,
    description: 'Conecte a loja e aprove as permissões na Shopify.',
    instructions: [
      'Clique em Conectar com Shopify na área abaixo.',
      'A Shopify abrirá a tela oficial de autorização do aplicativo.',
      'Confira as permissões e clique em Instalar app ou Atualizar.',
      'Ao terminar, você voltará automaticamente para a SOLID com a loja conectada.',
    ],
    action: 'connect',
    actionLabel: 'Ir para conexão',
  },
  {
    key: 'sync',
    title: 'Sincronize o catálogo',
    icon: RefreshCw,
    description: 'Importe produtos, variantes, imagens e coleções.',
    instructions: [
      'Depois que a conexão estiver ativa, clique em Sincronizar catálogo.',
      'Aguarde a confirmação da quantidade de produtos, variantes, imagens e coleções importadas.',
      'Quando alterar produtos na Shopify, volte aqui e execute uma nova sincronização.',
    ],
    action: 'sync',
    actionLabel: 'Ir para sincronização',
  },
  {
    key: 'checkout',
    title: 'Prepare e publique o checkout',
    icon: LayoutTemplate,
    description: 'Defina o checkout que receberá os carrinhos da Shopify.',
    instructions: [
      'Abra Checkouts no menu da SOLID e personalize o checkout principal.',
      'Confirme produtos, valores, gateway Pix, domínio e aparência.',
      'Publique as alterações antes de ativar o redirecionamento no tema.',
      'Guarde o identificador do checkout; ele será informado no App Embed da Shopify.',
    ],
    action: 'checkout',
    actionLabel: 'Abrir checkouts',
    manual: true,
  },
  {
    key: 'embed',
    title: 'Ative o redirecionamento no tema',
    icon: ExternalLink,
    description: 'Ligue o App Embed “SOLID Checkout” e salve o tema.',
    instructions: [
      'Na Shopify, acesse Loja virtual → Temas e clique em Personalizar no tema publicado.',
      'Abra App embeds no menu lateral e ative SOLID Checkout.',
      'Informe o identificador do checkout e selecione o domínio de pagamento da SOLID.',
      'Mantenha o checkout nativo como contingência e clique em Salvar.',
    ],
    action: 'theme',
    actionLabel: 'Abrir editor do tema',
    manual: true,
  },
  {
    key: 'test',
    title: 'Faça uma compra de teste',
    icon: TestTube2,
    description: 'Valide o carrinho e a geração do Pix antes de vender.',
    instructions: [
      'Abra a vitrine em uma janela anônima para evitar cache e sessões antigas.',
      'Adicione um produto ao carrinho e avance para finalizar a compra.',
      'Confirme se produto, quantidade, preço, frete e personalização estão corretos.',
      'Preencha dados de teste e gere o Pix. Confira também o pedido no painel da SOLID.',
    ],
    manual: true,
  },
];

function readProgress(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export default function ShopifyOnboarding({ connected, synced, shopDomain, enteredShop, storeKey, onAction }) {
  const storageKey = `solid-shopify-guide-${storeKey || 'store'}`;
  const [manual, setManual] = useState(() => readProgress(storageKey));
  const [expanded, setExpanded] = useState(connected ? null : 0);
  const [open, setOpen] = useState(!connected || !synced);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(manual)); } catch { /* armazenamento pode estar bloqueado */ }
  }, [manual, storageKey]);

  const completed = {
    domain: Boolean(shopDomain || enteredShop?.trim()),
    connection: connected,
    sync: synced,
    checkout: Boolean(manual.checkout),
    embed: Boolean(manual.embed),
    test: Boolean(manual.test),
  };
  const total = Object.values(completed).filter(Boolean).length;
  const progress = useMemo(() => `${Math.round((total / guide.length) * 100)}%`, [total]);

  return <section className="card shopify-onboarding">
    <button className="onboarding-summary" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className="onboarding-help"><HelpCircle size={21}/></span>
      <div><span>TUTORIAL SHOPIFY</span><h2>Conecte sua loja passo a passo</h2><p>{total} de {guide.length} etapas concluídas</p></div>
      <div className="onboarding-progress" aria-label={`${total} de ${guide.length} etapas concluídas`}><i style={{ '--progress': progress }}/><strong>{progress}</strong></div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>
    {open && <div className="onboarding-body">
      <div className="onboarding-intro" role="note"><strong>Você não precisa fornecer sua senha da Shopify.</strong><span>A instalação e a autorização acontecem no ambiente oficial da Shopify. Siga as etapas na ordem.</span></div>
      <div className="onboarding-steps">{guide.map((step, index) => {
        const Icon = step.icon;
        const done = completed[step.key];
        return <article className={done ? 'done' : ''} key={step.key}>
          <button className="guide-step-main" type="button" onClick={() => setExpanded(value => value === index ? null : index)} aria-expanded={expanded === index}>
            <span className="guide-status">{done ? <Check size={16}/> : <b>{index + 1}</b>}</span>
            <span className="guide-icon"><Icon size={18}/></span>
            <div><span className="guide-kind">{step.manual ? 'CONFIRMAÇÃO MANUAL' : 'VERIFICAÇÃO AUTOMÁTICA'}</span><h3>{step.title}</h3><p>{step.description}</p></div>
            <ChevronDown className={expanded === index ? 'rotated' : ''} size={18}/>
          </button>
          {expanded === index && <div className="guide-detail">
            <ol>{step.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol>
            <div className="guide-actions">
              {step.action && <button type="button" className="guide-action" disabled={(step.action === 'theme' && !shopDomain) || (step.action === 'sync' && !connected)} onClick={() => onAction?.(step.action)}>{step.actionLabel}{step.action === 'theme' && <ExternalLink size={14}/>}</button>}
              {step.manual && <label><input type="checkbox" aria-label={`Marcar ${step.title} como concluída`} checked={Boolean(manual[step.key])} onChange={event => setManual(current => ({ ...current, [step.key]: event.target.checked }))}/> Marcar como concluída</label>}
            </div>
            {step.action === 'theme' && !shopDomain && <small className="guide-prerequisite">Conecte a Shopify primeiro para liberar o atalho do tema.</small>}
          </div>}
        </article>;
      })}</div>
      <footer className="onboarding-footer"><span><Circle size={13}/> Seu progresso fica salvo somente para esta loja.</span><button className="skip-guide" type="button" onClick={() => setOpen(false)}>Ocultar por enquanto</button></footer>
    </div>}
  </section>;
}
