import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Circle, ExternalLink, HelpCircle, KeyRound, PackageCheck, RefreshCw, Settings2, ShoppingBag } from 'lucide-react';
import './shopify-onboarding.css';

const guide = [
  {
    key: 'create', title: 'Crie seu app no Dev Dashboard', icon: ShoppingBag, description: 'O app pertencerá à sua organização Shopify.', action: 'dashboard', actionLabel: 'Abrir Dev Dashboard', manual: true,
    instructions: ['Abra o Dev Dashboard com a mesma conta proprietária da loja.', 'Confirme que o app e a loja aparecem na mesma organização Shopify; esse vínculo é obrigatório para gerar o token.', 'Clique em Apps e depois em Create app.', 'Use um nome fácil de reconhecer, como “SOLID Checkout — Minha Loja”.', 'Este é um app próprio da sua loja; não compartilhe as credenciais com terceiros.'],
  },
  {
    key: 'permissions', title: 'Configure e publique as permissões', icon: Settings2, description: 'Libere somente o necessário para catálogo e pedidos.', action: 'dashboard', actionLabel: 'Configurar app', manual: true,
    instructions: ['Na configuração do app, adicione os escopos Admin API read_products e write_orders.', 'Crie uma versão com essas permissões e clique em Release.', 'Se alterar permissões depois, publique outra versão e aprove a atualização na loja.', 'A SOLID recusa a conexão quando uma permissão obrigatória estiver ausente.'],
  },
  {
    key: 'install', title: 'Instale o app na sua loja', icon: PackageCheck, description: 'Associe o app à loja que será conectada.', action: 'dashboard', actionLabel: 'Ir para instalações', manual: true,
    instructions: ['Abra Home ou Installs dentro do app.', 'Clique em Install app e selecione a loja correta.', 'Revise as permissões exibidas pela Shopify e confirme a instalação.', 'O app precisa estar instalado antes que as credenciais funcionem.'],
  },
  {
    key: 'credentials', title: 'Conecte as credenciais na SOLID', icon: KeyRound, description: 'Informe domínio, Client ID e Client secret.', action: 'credentials', actionLabel: 'Ir para credenciais',
    instructions: ['No Dev Dashboard, abra Settings do app.', 'Copie o Client ID e o Client secret.', 'Na SOLID, informe também o domínio original nomedaloja.myshopify.com.', 'Clique em Conectar app próprio. A SOLID validará loja, instalação e permissões diretamente na Shopify.'],
  },
  {
    key: 'sync', title: 'Sincronize o catálogo', icon: RefreshCw, description: 'Importe produtos, variantes, imagens e coleções.', action: 'sync', actionLabel: 'Ir para sincronização',
    instructions: ['Com a conexão ativa, clique em Sincronizar catálogo.', 'Confira as quantidades importadas.', 'As credenciais geram tokens de 24 horas, mas a SOLID os renova automaticamente.', 'Execute uma nova sincronização quando quiser refletir alterações imediatamente.'],
  },
];

function readProgress(storageKey) {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}

export default function ShopifyOnboarding({ connected, synced, enteredShop, storeKey, onAction }) {
  const storageKey = `solid-shopify-own-app-guide-${storeKey || 'store'}`;
  const [manual, setManual] = useState(() => readProgress(storageKey));
  const [expanded, setExpanded] = useState(connected ? null : 0);
  const [open, setOpen] = useState(!connected || !synced);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(manual)); } catch { /* armazenamento pode estar bloqueado */ } }, [manual, storageKey]);
  const completed = { create: Boolean(manual.create), permissions: Boolean(manual.permissions), install: Boolean(manual.install), credentials: connected || Boolean(enteredShop?.trim() && manual.credentials), sync: synced };
  const total = Object.values(completed).filter(Boolean).length;
  const progress = useMemo(() => `${Math.round((total / guide.length) * 100)}%`, [total]);
  return <section className="card shopify-onboarding">
    <button className="onboarding-summary" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}><span className="onboarding-help"><HelpCircle size={21}/></span><div><span>TUTORIAL SHOPIFY 2026</span><h2>Crie e conecte seu próprio app</h2><p>{total} de {guide.length} etapas concluídas</p></div><div className="onboarding-progress" aria-label={`${total} de ${guide.length} etapas concluídas`}><i style={{ '--progress': progress }}/><strong>{progress}</strong></div><ChevronDown className={open ? 'rotated' : ''} size={20}/></button>
    {open && <div className="onboarding-body">
      <div className="onboarding-intro" role="note"><strong>Este é o processo atual da Shopify para apps novos.</strong><span>Desde janeiro de 2026, o token permanente criado no Admin é um fluxo legado. Use Client ID e Client secret do Dev Dashboard.</span></div>
      <div className="onboarding-steps">{guide.map((step, index) => { const Icon = step.icon; const done = completed[step.key]; return <article className={done ? 'done' : ''} key={step.key}><button className="guide-step-main" type="button" onClick={() => setExpanded(value => value === index ? null : index)} aria-expanded={expanded === index}><span className="guide-status">{done ? <Check size={16}/> : <b>{index + 1}</b>}</span><span className="guide-icon"><Icon size={18}/></span><div><span className="guide-kind">{step.manual ? 'CONFIRMAÇÃO MANUAL' : 'VERIFICAÇÃO AUTOMÁTICA'}</span><h3>{step.title}</h3><p>{step.description}</p></div><ChevronDown className={expanded === index ? 'rotated' : ''} size={18}/></button>{expanded === index && <div className="guide-detail"><ol>{step.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol><div className="guide-actions"><button type="button" className="guide-action" disabled={step.action === 'sync' && !connected} onClick={() => onAction?.(step.action)}>{step.actionLabel}{step.action === 'dashboard' && <ExternalLink size={14}/>}</button>{step.manual && <label><input type="checkbox" aria-label={`Marcar ${step.title} como concluída`} checked={Boolean(manual[step.key])} onChange={event => setManual(current => ({ ...current, [step.key]: event.target.checked }))}/> Marcar como concluída</label>}</div></div>}</article>; })}</div>
      <div className="onboarding-intro shopify-extension-note" role="note"><strong>Catálogo e pedidos ≠ redirecionamento do tema.</strong><span>Um app criado pelo lojista não inclui automaticamente a extensão visual da SOLID. A ativação do checkout no tema continua sendo uma etapa separada pelo canal oficial da SOLID.</span></div>
      <footer className="onboarding-footer"><span><Circle size={13}/> O progresso do tutorial fica salvo somente nesta loja.</span><button className="skip-guide" type="button" onClick={() => setOpen(false)}>Ocultar por enquanto</button></footer>
    </div>}
  </section>;
}
