import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, CreditCard, Globe2, Home, LayoutTemplate, Package, Plug,
  Search, ServerCog, Settings, ShoppingBag, ShoppingCart, Sparkles, Megaphone,
  Tag, Truck, Users, Webhook, X, ScanSearch,
} from 'lucide-react';

const items = [
  { label: 'Início', group: 'Gestão', icon: Home, keywords: 'home painel visão geral dashboard métricas' },
  { label: 'Novidades', group: 'Gestão', icon: Sparkles, keywords: 'atualizações roadmap sugestões ideias lançamentos melhorias' },
  { label: 'Análises', group: 'Gestão', icon: BarChart3, keywords: 'analytics indicadores receita conversão vendas métricas' },
  { label: 'Pedidos', group: 'Gestão', icon: ShoppingBag, keywords: 'vendas pagamentos pix clientes pedidos' },
  { label: 'Carrinhos', group: 'Gestão', icon: ShoppingCart, keywords: 'abandonados recuperação checkout clientes' },
  { label: 'ChromaSense', group: 'Gestão', icon: ScanSearch, keywords: 'mapa calor cliques movimentos rolagem atenção comportamento insights checkout' },
  { label: 'Produtos', group: 'Gestão', icon: Package, keywords: 'catálogo estoque itens shopify produto' },
  { label: 'Webhooks', group: 'Gestão', icon: Webhook, keywords: 'eventos integrações notificações endpoint api' },
  { label: 'Checkouts', group: 'Checkout', icon: LayoutTemplate, keywords: 'editor personalização publicar páginas checkout' },
  { label: 'Domínios', group: 'Checkout', icon: Globe2, keywords: 'dns cloudflare endereço domínio ssl' },
  { label: 'Logística', group: 'Checkout', icon: Truck, keywords: 'frete entrega transportadora cep' },
  { label: 'Gateways', group: 'Checkout', icon: CreditCard, keywords: 'pagamento pix adquirente integração gateway' },
  { label: 'Order bumps', group: 'Marketing', icon: Sparkles, keywords: 'oferta adicional upsell bump conversão' },
  { label: 'Cupons', group: 'Marketing', icon: Tag, keywords: 'desconto cupom promoção código' },
  { label: 'Marketing', group: 'Marketing', icon: BarChart3, keywords: 'pixel rastreamento meta campanha conversão' },
  { label: 'Integrações', group: 'Marketing', icon: Plug, keywords: 'shopify conexão aplicativos integrações' },
  { label: 'Meu plano', group: 'Conta', icon: CreditCard, keywords: 'assinatura cobrança fatura plano limite' },
  { label: 'Configurações', group: 'Conta', icon: Settings, keywords: 'conta perfil segurança senha configurações' },
  { label: 'Conteúdo', group: 'Administração', icon: Megaphone, keywords: 'feedback sugestões bugs novidades vídeos imagens integrações notificações', admin: true },
  { label: 'Usuários', group: 'Administração', icon: Users, keywords: 'admin membros acesso usuários', admin: true },
  { label: 'Operações', group: 'Administração', icon: ServerCog, keywords: 'admin fila jobs sistema operações', admin: true },
];

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function CommandPalette({ open, onClose, onNavigate, platformAdmin = false }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);
  const available = useMemo(() => items.filter(item => !item.admin || platformAdmin), [platformAdmin]);
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return available;
    return available.filter(item => normalize(`${item.label} ${item.group} ${item.keywords}`).includes(term));
  }, [available, query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (active >= results.length) setActive(Math.max(0, results.length - 1));
    optionRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, results.length]);

  if (!open) return null;
  const choose = item => { if (!item) return; onNavigate(item.label); onClose(); };
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => results.length ? (index + 1) % results.length : 0); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => results.length ? (index - 1 + results.length) % results.length : 0); }
    if (event.key === 'Enter') { event.preventDefault(); choose(results[active]); }
  };

  return <div className="command-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title" onKeyDown={onKeyDown}>
      <h2 id="command-title" className="sr-only">Busca avançada do painel</h2>
      <div className="command-input">
        <Search size={20} aria-hidden="true"/>
        <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder="Buscar páginas, recursos ou ações..." role="combobox" aria-expanded="true" aria-controls="command-results" aria-activedescendant={results[active] ? `command-option-${active}` : undefined}/>
        {query && <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Limpar busca"><X size={17}/></button>}
        <kbd>Esc</kbd>
      </div>
      <div className="command-help"><span>{results.length} {results.length === 1 ? 'resultado' : 'resultados'}</span><span><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir</span></div>
      <div className="command-results" id="command-results" role="listbox" aria-label="Resultados da busca">
        {results.length ? results.map((item, index) => <button
          ref={element => { optionRefs.current[index] = element; }}
          type="button"
          id={`command-option-${index}`}
          role="option"
          aria-selected={index === active}
          className={index === active ? 'active' : ''}
          key={item.label}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(item)}
        ><span><item.icon size={19}/></span><div><b>{item.label}</b><small>{item.group}</small></div><kbd>↵</kbd></button>) : <div className="command-empty"><Search size={24}/><b>Nenhuma página encontrada</b><span>Tente buscar por “pedido”, “checkout”, “cupom” ou “configuração”.</span></div>}
      </div>
    </section>
  </div>;
}
