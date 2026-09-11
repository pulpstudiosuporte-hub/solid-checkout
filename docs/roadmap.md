# Gestão do roadmap

Em **Administração → Conteúdo → Roadmap**, o administrador pode criar itens próprios, editar título e descrição, escolher melhoria/sugestão ou correção, mudar a etapa e publicar ou ocultar. Os filtros permitem buscar por texto, status e visibilidade. Editar uma sugestão preserva seu autor e seus votos.

As etapas são Aguardando (`BACKLOG`), Planejado (`PLANNED`), Em andamento (`IN_PROGRESS`) e Concluído (`DONE`). A visibilidade é independente: um item pode estar planejado e ainda oculto. Novos itens são ocultos por padrão. Apenas os itens aprovados são retornados ao lojista por `/product-feedback`.

`POST /admin/content/feedback` cria um item atribuído ao administrador autenticado e sem associação a uma loja. `PATCH /admin/content/feedback/:id` aceita título (5–120 caracteres), descrição (10–2000), tipo, status e visibilidade. Essas ações exigem administrador de plataforma, origem permitida e CSRF válido. O servidor não aceita autoria, loja ou votos fornecidos pelo cliente.

## Publicação

A migração `20260911231500_editable_roadmap` transforma os três cards antes fixos no frontend em registros editáveis. Ela preserva identificadores e conteúdo, não sobrescreve registros existentes e é executada uma única vez. Os registros são atribuídos ao primeiro administrador de plataforma existente; instalações sem administrador começam com o roadmap vazio. Exclusões posteriores não recriam esses cards.

Publique a API com a migração antes ou junto com o frontend. Sem a migração, os antigos cards fixos não aparecerão até serem cadastrados. A atualização em Novidades acompanha esta entrega.

## Verificação

- `npm.cmd run check` valida tipos, lint, testes e builds.
- `npx.cmd playwright test --config scripts/roadmap-ui.config.mjs` verifica criação, edição, falha com preservação do formulário, filtros, mudança de status, publicação, ocultação e exclusão na visão do lojista.
- A revisão visual usa dados simulados em desktop e celular. A aplicação da migração em produção e a conferência com dados reais dependem do deploy.
