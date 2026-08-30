# Roadmap competitivo do SOLID Checkout

**Status:** proposta de planejamento  
**Horizonte sugerido:** 6 ciclos de produto, com duração definida conforme o tamanho do time  
**Objetivo:** elevar o SOLID Checkout ao nível funcional das principais plataformas brasileiras de checkout, usando a Corvex como referência de mercado, sem copiar sua identidade, textos ou implementação.

## 1. Visão do produto

O SOLID deve ser o checkout de maior clareza operacional para operações brasileiras que vendem com Pix e Shopify: rápido para o comprador, mensurável para o lojista e confiável para quem opera pagamentos e integrações.

A meta não é acumular telas. Cada novo recurso deve melhorar pelo menos um destes resultados:

1. aumentar a conversão do checkout;
2. recuperar receita que seria perdida;
3. reduzir tempo e erro operacional;
4. tornar decisões mensuráveis com dados confiáveis;
5. ampliar integrações sem comprometer segurança e estabilidade.

## 2. Benchmark da Corvex

### 2.1 Recursos observados no painel

- início com visitantes ao vivo, pedidos, conversão, alcance geográfico e progresso da conta;
- análises e indicadores comerciais;
- Live View da jornada do visitante e da progressão no checkout;
- vendas e produtos;
- checkout visual e personalizável;
- marketing;
- Clarex, com gravações de sessão, mapas de calor e análise de intenção de clique;
- automações visuais;
- integrações e catálogo de aplicativos;
- sistema e loja virtual;
- central de novidades e comunicação de produto.

### 2.2 Recursos anunciados e documentados

- editor de checkout por arrastar e soltar, temas e componentes;
- configuração das etapas e formas de pagamento;
- order bumps, brindes, cupons, desconto por pagamento, faixas de desconto e roletas de conversão;
- dados e jornada em tempo real;
- fluxos visuais de recuperação, pós-venda e marketing;
- gatilhos, atrasos, condições, ramificações, metatags e templates de automação;
- webhooks de criação de pedido e confirmação de pagamento;
- API para criar checkout;
- API Key com escopos para integrações;
- atualização individual e em lote de rastreio para WMS, ERP, Make e n8n;
- loja virtual com temas, seções, SEO, domínio, código personalizado e assistente de IA;
- aplicativo móvel e área de membros;
- suporte a múltiplos países e moedas.

## 3. Estado atual do SOLID

Esta avaliação foi feita sobre as páginas, rotas e modelos existentes no repositório.

| Domínio | Estado | O que já existe | Principal lacuna |
|---|---|---|---|
| Checkout | Parcial forte | Editor, quatro presets, rascunho/publicação, preview responsivo, blocos reordenáveis, cupom, bump, depoimentos, cronômetro e domínio | Editor realmente modular, regras comerciais e testes de conversão |
| Catálogo | Implementado | Produtos, variantes, imagens, coleções Shopify, produtos digitais e arquivamento | Kits, bundles e regras comerciais avançadas |
| Pedidos e pagamentos | Implementado | Sessões, tentativas de pagamento, Pix, Roas, WestPay e reconciliação | Timeline operacional e gestão avançada de exceções |
| Shopify | Implementado | OAuth, sincronização de catálogo/pedidos e reconciliação | Melhor observabilidade e ações de recuperação |
| Marketing | Parcial | Cupons, order bumps, Meta e UTMify | Brindes, descontos por pagamento/faixa, experimentos e atribuição unificada |
| Carrinhos abandonados | Parcial | Histórico, configuração de recuperação e entrega por e-mail | Fluxos multietapa, canais adicionais, condições e métricas por fluxo |
| Analytics | Parcial | Receita, pedidos, conversão, série temporal e exportação CSV | Eventos de jornada, funil, geografia, coortes e atualização em tempo real |
| Logística | Parcial | Métodos de frete e dados de envio | API pública de rastreio, timeline e integrações WMS/ERP |
| Integrações | Parcial | Shopify, Meta, UTMify, gateways e diagnóstico | API pública, chaves com escopo, webhooks gerenciáveis e marketplace |
| Segurança/operação | Implementado forte | MFA, Turnstile, sessões, CSRF, auditoria, rate limit, health check, billing e administração | Observabilidade de produto e SLOs consolidados |
| Loja virtual | Ausente | O checkout pode operar com Shopify | Construtor próprio completo, que não é prioridade imediata |
| Comportamento | Ausente | — | Live View, replay de sessão e mapas de calor |

## 4. Estratégia de paridade

### Prioridade P0 — Fundação de dados e confiabilidade

Sem uma camada de eventos, Live View, automações e relatórios produzirão números divergentes.

**Entregas**

- definir taxonomia versionada de eventos: visita iniciada, checkout visualizado, identificação preenchida, frete selecionado, cupom aplicado, bump aceito, Pix gerado, pagamento aprovado, abandono e erro;
- criar identificadores consistentes para visitante, sessão, checkout, loja e pedido;
- persistir eventos de produto em uma estrutura append-only;
- garantir deduplicação, idempotência e ordenação mínima por sessão;
- criar fila de jobs com retry, backoff e dead-letter queue;
- adicionar feature flags e trilha de auditoria para recursos comerciais;
- instrumentar métricas técnicas, logs estruturados e alertas por SLO;
- documentar consentimento, retenção e anonimização conforme LGPD.

**Critério de saída**

- diferença menor que 1% entre sessões pagas, pagamentos confirmados e relatórios;
- nenhum evento financeiro duplicado em testes de retry;
- eventos críticos chegam ao processamento em p95 menor que 5 segundos.

### Prioridade P1 — Checkout de conversão 2.0

É a fase de maior retorno e deve vir antes de loja virtual ou aplicativo móvel.

**Entregas**

- editor em canvas com biblioteca de blocos, inserção, duplicação, reordenação e ocultação por dispositivo;
- propriedades por bloco e estilos globais separados;
- autosave, histórico de versões, desfazer/refazer e publicação com rollback;
- templates próprios da marca SOLID, sem reproduzir temas da concorrência;
- preview desktop, tablet e celular com dados reais de produto;
- brindes condicionais;
- desconto por forma de pagamento;
- desconto progressivo por quantidade ou subtotal;
- múltiplos order bumps com regras e prioridade;
- regras de exibição por produto, campanha, dispositivo e valor do carrinho;
- validação de links, acessibilidade e performance antes da publicação;
- experimento A/B de checkout com divisão estável e resultado por conversão.

**Critério de saída**

- LCP p75 abaixo de 2,5 s e INP p75 abaixo de 200 ms no checkout móvel;
- publicação sem downtime e rollback funcional;
- comparação A/B sem dupla contabilização;
- melhora mensurável da conversão em pelo menos um template ou regra testada.

### Prioridade P2 — Analytics e Live View

**Entregas**

- dashboard com visitantes ativos, receita, pedidos, conversão e ticket médio;
- funil por etapa do checkout com perda absoluta e percentual;
- filtros por período, checkout, produto, campanha, gateway e dispositivo;
- visão geográfica por país, estado e cidade com consentimento e precisão apropriada;
- Live View via SSE ou WebSocket com sessões ativas e etapa atual;
- alerta de queda de conversão ou aumento de erro de pagamento;
- comparativo com período anterior;
- relatórios exportáveis e URLs de filtros compartilháveis;
- histórico de carrinhos com política de retenção por plano.

**Critério de saída**

- painel ao vivo com atraso p95 menor que 10 segundos;
- filtros preservados na URL;
- métricas conciliadas com o financeiro;
- nenhuma informação pessoal sensível exposta no Live View.

### Prioridade P3 — Automação visual

**Entregas**

- construtor em grafo com gatilho, ação, espera, condição, ramificação e fim;
- gatilhos iniciais: abandono, Pix gerado, pagamento aprovado/recusado, pedido criado e rastreio atualizado;
- ações iniciais: e-mail, webhook, atualização de tag e notificação interna;
- variáveis documentadas de cliente, pedido, pagamento, produto, checkout e rastreio;
- templates de recuperação de Pix, carrinho abandonado e pós-venda;
- logs por execução, tentativa manual, pausa e versionamento de fluxo;
- limites por plano e proteção contra loops;
- avaliação posterior de WhatsApp somente com provedor oficial e consentimento.

**Critério de saída**

- execução idempotente;
- taxa de entrega e receita recuperada por fluxo visíveis;
- simulação do fluxo antes da ativação;
- falha em uma ação não perde o restante da execução.

### Prioridade P4 — Plataforma de integrações

**Entregas**

- API pública versionada;
- chaves separadas por ambiente, loja e escopo;
- criação programática de checkout;
- consulta segura de pedidos conforme escopo;
- atualização individual e em lote de rastreio;
- webhooks configuráveis, assinados, com retry, histórico e replay;
- documentação OpenAPI e playground com credenciais de teste;
- conectores oficiais para Make e n8n;
- catálogo de apps com estado, permissões e diagnóstico;
- sandbox para parceiros.

**Critério de saída**

- assinatura e replay de webhooks testados;
- rotação de chave sem downtime;
- idempotency key nas escritas críticas;
- limite, escopo e auditoria aplicados em todas as rotas públicas.

### Prioridade P5 — Inteligência comportamental

Esta é uma iniciativa cara em armazenamento, privacidade e processamento. Só deve começar depois da instrumentação do P0 estar estável.

**Entregas**

- gravação de sessão com mascaramento automático de campos e exclusão total de pagamento;
- mapa de cliques, movimento e rolagem;
- segmentação por dispositivo, checkout, origem e resultado;
- identificação de rage clicks, dead clicks e abandono por etapa;
- amostragem e retenção configuráveis para controlar custo;
- consentimento, opt-out, exclusão e auditoria LGPD.

**Critério de saída**

- nenhum dado de cartão, senha, documento ou campo marcado como sensível é gravado;
- custo de captura por mil sessões dentro do orçamento definido;
- reprodução confiável nas versões suportadas do checkout.

### Prioridade P6 — Expansão do ecossistema

Avaliar somente após os indicadores de P1 a P4 justificarem o investimento.

- loja virtual e editor de páginas;
- área de membros;
- aplicativo móvel;
- múltiplas moedas e operação internacional;
- assistente de IA para checkout, relatórios e automações;
- marketplace aberto a terceiros.

## 5. Sequência recomendada de ciclos

| Ciclo | Tema | Dependência | Resultado de negócio |
|---|---|---|---|
| 1 | Eventos, jobs e observabilidade | — | Dados confiáveis e base para todos os módulos |
| 2 | Editor 2.0 e regras comerciais | Ciclo 1 | Mais conversão e diferenciação imediata |
| 3 | Funil, analytics e Live View | Ciclo 1 | Decisão em tempo real e diagnóstico de abandono |
| 4 | Automação visual | Ciclos 1 e 3 | Recuperação e pós-venda escaláveis |
| 5 | API, webhooks e ecossistema | Ciclo 1 | Menos operação manual e mais parceiros |
| 6 | Comportamento e experimentação avançada | Ciclos 1 a 3 | Otimização baseada em evidência |

P2 e P3 podem avançar em paralelo apenas se houver equipes independentes. Com uma única equipe, a ordem acima reduz retrabalho.

## 6. Nova arquitetura de informação do painel

Uma navegação recomendada para a próxima geração:

1. **Visão geral** — saúde da operação e principais indicadores;
2. **Analytics** — funis, receita, produtos, campanhas e geografia;
3. **Ao vivo** — visitantes e progressão no checkout;
4. **Vendas** — pedidos, pagamentos e carrinhos;
5. **Catálogo** — produtos, variantes, kits e brindes;
6. **Checkout** — checkouts, editor, templates, domínios e experimentos;
7. **Crescimento** — bumps, cupons, descontos e campanhas;
8. **Automações** — fluxos, templates e execuções;
9. **Integrações** — gateways, canais, apps, API e webhooks;
10. **Configurações** — loja, equipe, cobrança, segurança e auditoria.

No celular, a navegação deve usar drawer com rolagem explícita e busca. Recursos indisponíveis por plano devem informar o motivo, nunca simplesmente desaparecer.

## 7. Direção de experiência e interface

- manter a identidade roxa do SOLID e não reproduzir a aparência da Corvex;
- adotar dashboard denso em informação, mas com hierarquia forte e respiro entre grupos;
- oferecer busca global e comandos rápidos;
- usar gráficos acessíveis, com tabela ou resumo textual equivalente;
- manter foco visível, navegação por teclado e alvos de toque de no mínimo 44 px;
- incluir estados de carregamento, vazio, erro, permissão e dados atrasados;
- evitar animações contínuas e respeitar `prefers-reduced-motion`;
- projetar cada módulo primeiro para desktop operacional e depois para celular de consulta/ação rápida;
- exibir sempre loja ativa, período e atualização dos dados para evitar decisões no contexto errado.

## 8. Métricas do programa

### Conversão

- taxa de início para pagamento aprovado;
- abandono por etapa;
- aceitação de bump e brinde;
- uso e impacto de cupom/desconto;
- uplift por experimento.

### Receita e recuperação

- receita confirmada;
- ticket médio;
- receita recuperada por automação;
- tempo entre Pix gerado e pagamento;
- falha por gateway.

### Produto e operação

- tempo para publicar um checkout;
- taxa de sucesso de publicação;
- tempo para identificar incidentes;
- sucesso e latência de webhooks;
- execuções de automação com erro;
- adoção por módulo.

### Experiência técnica

- Core Web Vitals do checkout;
- disponibilidade do checkout e da API;
- erro JavaScript por mil sessões;
- atraso dos dados ao vivo;
- divergência entre analytics e pagamentos.

## 9. O que não fazer agora

- iniciar loja virtual, aplicativo móvel e IA ao mesmo tempo;
- criar Live View consultando diretamente tabelas transacionais a cada atualização;
- armazenar replay bruto no PostgreSQL principal;
- liberar automações sem idempotência, limites e histórico de execução;
- misturar métricas de visita com tentativas de pagamento sem uma taxonomia de eventos;
- copiar layout, ilustrações, nomes proprietários ou textos da Corvex;
- esconder módulos por erro de autorização sem explicar ao usuário.

## 10. Próximas decisões de produto

Antes de iniciar o Ciclo 1, fechar:

1. tamanho do time e capacidade por ciclo;
2. perfil prioritário: Shopify + Pix, infoproduto ou e-commerce próprio;
3. gateways prioritários;
4. retenção desejada de eventos e carrinhos por plano;
5. canal inicial das automações;
6. meta de conversão e volume esperado de sessões;
7. orçamento de infraestrutura para tempo real e replay.

## 11. Fontes do benchmark

- [Documentação técnica da Corvex](https://help.usecorvex.com.br/documentacao)
- [Página oficial da Corvex](https://usecorvex.com.br/)
- painel fornecido como referência visual pelo responsável do SOLID Checkout;
- código atual do SOLID em `apps/web`, `apps/api` e `packages/database`.

As informações públicas da concorrência servem como benchmark de capacidade. O desenho, a implementação, a marca e os textos do SOLID devem continuar originais.
