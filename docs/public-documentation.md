# Documentação pública da Pirat

A central usa o domínio público `https://docs.apirat.io/`, com artigos em `/#/docs/<slug>`. Esse host abre a documentação na raiz e não cai no painel autenticado, mesmo se receber um hash de login ou checkout. A rota `/#/docs` nos hosts antigos continua funcionando. O conteúdo é carregado antes do painel e não consulta a API. O atalho Documentação abre outra aba para preservar formulários em edição; o site institucional também oferece o link no menu e no rodapé.

O domínio aponta para o serviço web existente na porta 80 do Dokploy, com HTTPS. Não exige outro container ou migração de dados. O host de documentação não registra o service worker do painel. Os artigos usam hash para recarregar sem depender de rewrite de caminhos. O site institucional independente precisa de seu próprio deploy para atualizar os links.

## Manutenção

A central é didática: ensina a configurar, usar e integrar os recursos. Não funciona como changelog nem divulga lançamentos ou redesigns; esse conteúdo pertence a Novidades. Ajustes apenas visuais não pedem novos trechos nos guias. Atualize instruções quando o uso do produto mudar.

O conteúdo público e pesquisável fica em `apps/web/src/docs-content.js`. Não publique automaticamente a pasta `docs/`: ela também contém documentação interna, operações e segurança da plataforma. O catálogo público é deliberadamente separado.

Ao entregar uma funcionalidade para lojistas:

1. Revise o guia correspondente ou adicione um artigo com slug permanente, categoria, resumo, palavras-chave e data de revisão.
2. Documente pré-requisitos, passos, resultado esperado, como testar, limitações e erros comuns. Confira os nomes das telas e o comportamento no código atual.
3. Adicione links relacionados válidos. Se mudar o título, preserve o slug para não quebrar compartilhamentos.
4. Uma integração disponível precisa ter artigo com `integration` correspondente ao ID do catálogo compartilhado. O teste verifica essa cobertura. Recursos futuros devem ser identificados como indisponíveis, sem passos de ativação fictícios.
5. Revise conteúdo sensível: não inclua credenciais, dados de clientes, procedimentos exclusivos de administração, infraestrutura privada nem mecanismos de acesso privilegiado. Exemplos técnicos devem usar placeholders e apenas contratos necessários à integração do lojista.
6. Atualize a publicação em Novidades no mesmo deploy, conforme AGENTS.md. Adicionar um artigo requer alteração de conteúdo, revisão e deploy; não há importação automática nem editor de artigos na administração nesta versão.

## Fontes de implementação conferidas

- Primeiros passos, produtos, modelos, editor e publicação: telas correspondentes em `apps/web/src`, `checkout-config`, `checkout-template-catalog` e fluxo de publicação.
- IA: `CheckoutAiBuilder`, `docs/checkout-ai.md`.
- Shopify: guia assistido `ShopifyOnboarding.jsx`. URLs e snippet dependentes da loja permanecem no guia autenticado, sem cópia fixa na central pública.
- Meta: `docs/meta-connection.md` e telas da integração.
- Google: `docs/google-integrations.md` e telas da integração.
- UTMify: `UtmifyIntegration.jsx`.
- Webhooks: `webhook-routes.ts` e `WebhooksPage.jsx`; nomes dos cabeçalhos legados preservados.
- Oferta de saída: `docs/exit-offer.md`.
- Gateway e disponibilidade: `gateway-catalog.js` e `integration-catalog.js`.
- Pedidos, análises e logística: telas e documentação dos recursos.

A data de revisão é editorial: não deve mudar só porque o site foi compilado. Preços de planos, prazos comerciais e metas de conversão não são fixados nos artigos.

## Validação

```powershell
npx.cmd vitest run apps/web/test/docs.test.js
npm.cmd run build --workspace=@solid/web
npx.cmd playwright test --config scripts/admin-ui.config.mjs docs.spec.mjs
npm.cmd run check:bundles
```

Se o preview já estiver em execução na porta da suíte, configure `VISUAL_SERVER_EXTERNAL=1` antes do Playwright. Os testes não fazem login real, não criam pedidos e não acionam integrações. Verificam acesso sem API, busca, links, navegação, modo claro/escuro, teclado e larguras de computador, tablet e celular. Capturas ficam em `.visual-check/docs-*`; abra as imagens para revisão visual.

## Limites

A documentação explica o produto; a suíte não retesta as integrações reais descritas. O conteúdo é revisado manualmente junto às mudanças do produto. Rotas hash não fornecem metadados de busca individuais renderizados pelo servidor. Um domínio dedicado com páginas indexáveis pode ser uma etapa posterior, sem bloquear o acesso público atual.
