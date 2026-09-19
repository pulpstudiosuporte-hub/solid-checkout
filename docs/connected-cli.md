# CLI conectada

Autorização por código no navegador, token restrito à loja e ao usuário, expiração em 30 dias, revogação, list/pull/push/publish/versions/restore, build e prévia local. validate usa a validação real da API sem salvar.

O projeto JavaScript produz a configuração completa do checkout. src/theme.mjs e src/elements.mjs são editáveis em qualquer IDE. A prévia empacota o renderizador do editor e não faz cobranças. Esta versão não permite layouts React/HTML/CSS arbitrários: o motor e os componentes continuam sendo os da Pirat. Essa liberdade exige um contrato de renderização e isolamento próprio e não deve ser anunciada como implementada.

## Fontes

- scripts/connected-cli: CLI Node sem dependências de runtime e regras do projeto.
- apps/web/src/CliThemePreview.jsx: prévia local usando o renderizador compartilhado.
- scripts/build-connected-cli.mjs: compila e gera apps/web/public/downloads/pirat-cli.zip.
- apps/api/src/cli-routes.ts: autenticação e operações restritas. As demais rotas não aceitam o token da CLI.
- CliConnections.jsx: autorização e revogação em Configurações e no endereço de login da CLI.
- cli-docs-content.js: guia público com comandos reais, inserido no catálogo principal.
- Migração 20260919060000_connected_cli: conexões, dispositivos e versões.

O kit offline v1 continua separado. O nome npm está preparado, mas o pacote não foi publicado no registro. A distribuição inclui ZIP e pacote tarball para NPX por URL, hospedados em docs.apirat.io/downloads. Para atualizar ambos: `npm run build:cli`. Em Checkouts, o destaque Seu checkout. Na sua IDE. permite escolher a base e copiar os comandos com o identificador real. --template altera somente os arquivos baixados, nunca a loja automaticamente.

## Garantias e limites

Autorização de dispositivo vincula segredo aleatório e desafio ao verificador. O código expira em 10 minutos; aprovação exige sessão/CSRF e não aceita suporte. Troca de uso único e segredos armazenados como hash. Publicação exige concessão separada. Cada chamada confere conta, loja e vínculo atual. Tokens não autorizam administração, pedidos ou pagamentos.

Mutações usam trava de linha e revisão otimista por updatedAt, sem push forçado. Restauração altera apenas o rascunho e exige novo pull; preserva as fontes locais. Histórico guarda o estado anterior às mudanças da CLI, sem reconstruir edições anteriores no painel.

Prévia atende somente loopback, valida Host/Origin e serve apenas bundle, CSS e configuração visual. Não serve credenciais nem arquivos arbitrários. Avaliação de módulos é um build local do código do usuário, não uma sandbox; execute apenas projetos confiáveis.

## Entrega

Gerar Prisma, rodar testes da API/CLI, build web e revisar autorização, revogação, conflitos e prévia. Aplicar a migração antes de disponibilizar o download e a API. Validar com uma loja de teste sem cobranças. Npm público exige publicação separada e titularidade do escopo.

```sh
npm run db:generate
npm run build:cli
npm run test:cli
npx vitest run apps/api/test/cli.test.ts apps/api/test/catalog.test.ts apps/web/test/docs.test.js
npm run build --workspace=@solid/web
npm run test:cli:ui
npm run check:bundles
```

Os testes de API usam repositórios em memória e o teste do pacote usa um servidor simulado. A suíte visual abre o painel com sessão simulada e a prévia real distribuída no ZIP; verifica atualização dos módulos e preservação da última prévia válida. Isso não substitui aplicar a migração e validar a conexão com banco e autenticação reais em uma loja de teste.
