import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, Compass, Copy, HelpCircle, LayoutTemplate, Menu, Moon, Plug, Search, ShoppingBag, Sun, X } from 'lucide-react';
import { useAppTheme } from './app-theme';
import { docsArticles, docsGroups, searchDocs } from './docs-content';
import { docsHref } from './docs-route';
import { integrations } from './integration-catalog';
import './docs.css';

const icons = { compass: Compass, layout: LayoutTemplate, plug: Plug, bag: ShoppingBag, help: HelpCircle };
const articleBySlug = new Map(docsArticles.map(article => [article.slug, article]));

function ArticleCard({ article, onNavigate }) {
  return <a className="docs-article-card" href={docsHref(article.slug)} onClick={onNavigate}>
    <span><strong>{article.title}</strong><span>{article.summary}</span></span><ArrowRight size={18} aria-hidden="true"/>
  </a>;
}

export default function DocsPage({ route }) {
  const { theme, toggleTheme } = useAppTheme();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const heading = useRef(null);
  const search = useRef(null);
  const menuButton = useRef(null);
  const initialRoute = useRef(true);
  const article = articleBySlug.get(route.slug);
  const category = docsGroups.find(item => item.id === article?.group);
  const results = searchDocs(query, group);
  const searching = Boolean(query.trim() || group);
  const activeGroup = docsGroups.find(item => item.id === group);
  const changeArticle = () => { setQuery(''); setGroup(''); setMenuOpen(false); };

  useEffect(() => {
    document.title = `${article ? article.title : route.slug ? 'Guia não encontrado' : 'Documentação'} · Pirat`;
    setCopyMessage('');
    if (route.section) {
      const target = document.getElementById(`docs-section-${route.section}`);
      if (target) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (!initialRoute.current) heading.current?.focus({ preventScroll: true });
    }
    initialRoute.current = false;
  }, [article, route.slug, route.section]);

  useEffect(() => {
    const keyboard = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.current?.focus(); }
      if (event.key === 'Escape') { setMenuOpen(false); if (menuOpen) menuButton.current?.focus(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [menuOpen]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(new URL(docsHref(route.slug), window.location.origin).href); setCopyMessage('Link copiado'); }
    catch { setCopyMessage('Não foi possível copiar. Use o endereço do navegador.'); }
  };

  const nav = <nav aria-label="Guias da documentação">
    <a href={docsHref()} onClick={changeArticle} className={`docs-nav-home ${!route.slug ? 'active' : ''}`} aria-current={!route.slug ? 'page' : undefined}><BookOpen size={17} aria-hidden="true"/> Visão geral</a>
    {docsGroups.map(category => <section key={category.id}><h2>{category.title}</h2>{docsArticles.filter(item => item.group === category.id).map(item => <a key={item.slug} href={docsHref(item.slug)} onClick={changeArticle} aria-current={route.slug === item.slug ? 'page' : undefined} className={route.slug === item.slug ? 'active' : ''}>{item.title}</a>)}</section>)}
  </nav>;

  return <div className="pirat-docs" data-theme={theme}>
    <a href="#docs-main" className="docs-skip" onClick={event => { event.preventDefault(); heading.current?.focus(); heading.current?.scrollIntoView(); }}>Pular para o conteúdo</a>
    <header className="docs-header">
      <a className="docs-brand" href={docsHref()} onClick={changeArticle} aria-label="Pirat — início da documentação"><img src={`/brand/pirat-logo-on-${theme === 'dark' ? 'dark' : 'light'}.png`} alt="Pirat"/><span>docs</span></a>
      <div className="docs-search" role="search"><Search size={19} aria-hidden="true"/><input ref={search} id="docs-search" aria-label="Buscar na documentação" placeholder="O que você quer aprender?" value={query} onChange={event => { setQuery(event.target.value); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); }}/>{query ? <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={17}/></button> : <kbd>Ctrl K</kbd>}</div>
      <div className="docs-header-actions"><button className="docs-icon-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><a className="docs-panel-link" href="https://app.apirat.io/" target="_blank" rel="noreferrer">Abrir painel <ArrowRight size={15} aria-hidden="true"/></a></div>
    </header>
    <div className="docs-mobile-bar"><span>Central de documentação</span><button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="docs-mobile-nav" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={18}/> : <Menu size={18}/>} {menuOpen ? 'Fechar guias' : 'Explorar guias'}</button></div>
    {menuOpen && <div className="docs-mobile-nav" id="docs-mobile-nav">{nav}</div>}
    <div className="docs-shell">
      <aside className="docs-sidebar"><p className="docs-label">MANUAL DE BORDO</p>{nav}<div className="docs-sidebar-note"><Compass size={20} aria-hidden="true"/><p>Da primeira configuração<br/>à próxima venda.</p></div></aside>
      <main className="docs-main" id="docs-main">
        {searching ? <section className="docs-results">
          <p className="docs-label">ENCONTRE SEU CAMINHO</p><h1 ref={heading} tabIndex={-1}>{query.trim() ? 'Resultados da busca' : activeGroup?.title}</h1>
          <div className="docs-filter-row"><label htmlFor="docs-group-filter">Assunto</label><select id="docs-group-filter" value={group} onChange={event => setGroup(event.target.value)}><option value="">Todos os assuntos</option>{docsGroups.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" onClick={() => { setQuery(''); setGroup(''); }}>Limpar filtros</button></div>
          <p role="status" className="docs-muted">{results.length} {results.length === 1 ? 'guia encontrado' : 'guias encontrados'}{query.trim() ? ` para “${query.trim()}”` : ''}.</p>
          <div className="docs-result-list">{results.map(item => <ArticleCard key={item.slug} article={item} onNavigate={changeArticle}/>)}</div>
          {!results.length && <div className="docs-empty"><Search size={28} aria-hidden="true"/><h2>Ainda não encontramos esse caminho.</h2><p>Tente o nome do recurso, como “domínio”, “Pixel” ou “Shopify”, ou escolha outro assunto.</p><button className="docs-primary" type="button" onClick={() => { setQuery(''); setGroup(''); }}>Voltar aos guias</button></div>}
        </section> : article ? <div className="docs-reading-layout">
          <article className="docs-article">
            <div className="docs-breadcrumb"><a href={docsHref()} onClick={changeArticle}>Documentação</a><ChevronRight size={14} aria-hidden="true"/><span>{category.title}</span></div>
            <p className="docs-label">{category.title}</p><h1 ref={heading} tabIndex={-1}>{article.title}</h1><p className="docs-lead">{article.summary}</p>
            <div className="docs-article-meta"><span>Revisado em {article.updated}</span><button type="button" onClick={copyLink}>{copyMessage === 'Link copiado' ? <Check size={15}/> : <Copy size={15}/>} Copiar link</button></div><span className="docs-copy-status" role="status">{copyMessage}</span>
            <nav className="docs-inline-toc" aria-label="Seções deste guia">{article.sections.map(section => <a key={section.id} href={docsHref(article.slug, section.id)}>{section.title}</a>)}</nav>
            {article.sections.map(section => <section className={`docs-article-section ${section.id === 'antes' ? 'docs-prerequisites' : ''}`} key={section.id}><h2 id={`docs-section-${section.id}`} tabIndex={-1}>{section.title}</h2>{section.ordered ? <ol>{section.items.map(item => <li key={item}>{item}</li>)}</ol> : <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}{section.code && <pre aria-label="Contrato de assinatura do webhook"><code>{section.code}</code></pre>}</section>)}
            <section className="docs-related"><p className="docs-label">CONTINUE POR AQUI</p><h2>O próximo passo</h2>{article.related.map(slug => <ArticleCard key={slug} article={articleBySlug.get(slug)}/>)}</section>
          </article>
          <aside className="docs-toc"><p className="docs-label">NESTE GUIA</p><nav aria-label="Índice do artigo">{article.sections.map(section => <a key={section.id} href={docsHref(article.slug, section.id)}>{section.title}</a>)}</nav><div><BookOpen size={20} aria-hidden="true"/><p>Uma configuração de cada vez.<br/>Teste antes de publicar.</p></div></aside>
        </div> : route.slug ? <section className="docs-empty"><Compass size={32} aria-hidden="true"/><h1 ref={heading} tabIndex={-1}>Esse guia não foi encontrado.</h1><p>O endereço pode ter mudado. Encontre o assunto pela busca ou volte à documentação.</p><a className="docs-primary" href={docsHref()} onClick={changeArticle}>Explorar documentação <ArrowRight size={17}/></a></section> : <>
          <section className="docs-hero"><div><p className="docs-label">DOCUMENTAÇÃO PIRAT</p><h1 ref={heading} tabIndex={-1}>Sua loja no comando.<br/><em>O caminho está aqui.</em></h1><p>Configure, conecte e crie. Guias diretos para tirar as dúvidas do caminho e colocar sua operação para navegar.</p><a className="docs-primary" href={docsHref('primeiros-passos')}>Começar pela primeira venda <ArrowRight size={17}/></a><span className="docs-hero-caption">Pública. Sem login. No seu ritmo.</span></div><img src="/brand/assistant/greeting.webp" alt="" aria-hidden="true" className="docs-mascot"/></section>
          <section className="docs-topics"><div className="docs-section-heading"><div><p className="docs-label">ESCOLHA UM ASSUNTO</p><h2>Qual é a missão de hoje?</h2></div><span>{docsArticles.length} guias para explorar</span></div><div className="docs-topic-grid">{docsGroups.map(category => { const Icon = icons[category.icon]; return <button type="button" className="docs-topic" key={category.id} onClick={() => { setGroup(category.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}><span className="docs-topic-icon"><Icon size={23} aria-hidden="true"/></span><h3>{category.title}</h3><p>{category.description}</p><span className="docs-topic-bottom">{docsArticles.filter(item => item.group === category.id).length} guias <ArrowRight size={17} aria-hidden="true"/></span></button>; })}</div></section>
          <section className="docs-start"><div className="docs-section-heading"><div><p className="docs-label">DA IDEIA À PUBLICAÇÃO</p><h2>Uma boa rota para começar</h2></div></div><div className="docs-start-grid">{['primeiros-passos', 'criar-com-ia', 'shopify', 'meta-pixel'].map(slug => <ArticleCard key={slug} article={articleBySlug.get(slug)}/>)}</div></section>
          <section className="docs-connections"><div className="docs-section-heading"><div><p className="docs-label">INTEGRAÇÕES</p><h2>Conecte as peças da sua operação</h2></div></div><p className="docs-muted">Guias para as integrações disponíveis nesta versão. Cada conexão tem seus próprios pré-requisitos.</p><div className="docs-integration-grid">{integrations.filter(item => item.available).map(item => { const guide = docsArticles.find(article => article.integration === item.id); return guide ? <a key={item.id} href={docsHref(guide.slug)}><item.icon size={20} aria-hidden="true"/><strong>{item.name}</strong><ChevronRight size={16} aria-hidden="true"/></a> : <span key={item.id}>{item.name} · Guia em preparação</span>; })}</div><details className="docs-upcoming"><summary>E as outras opções do catálogo?</summary><p>{integrations.filter(item => !item.available).map(item => item.name).join(', ')} ainda não estão disponíveis para ativação nesta versão. A presença no catálogo não significa que a conexão já funciona. Acompanhe Novidades no painel para conhecer os lançamentos.</p></details></section>
          <section className="docs-help"><HelpCircle size={26} aria-hidden="true"/><div><h2>Travou em alguma etapa?</h2><p>Comece pelo diagnóstico. Um detalhe na configuração pode ser tudo o que falta.</p></div><a href={docsHref('resolver-checkout')}>Resolver um problema <ArrowRight size={17} aria-hidden="true"/></a></section>
        </>}
        <footer className="docs-footer"><span>Pirat · Manual de bordo</span><span>Guias para os recursos disponíveis. Novas rotas chegam com o produto.</span><a href="https://app.apirat.io/" target="_blank" rel="noreferrer">Ir para o painel <ArrowRight size={14} aria-hidden="true"/></a></footer>
      </main>
    </div>
  </div>;
}
