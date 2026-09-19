# Temas para desenvolvedores

O contrato v1 é visual e declarativo: estrutura existente, cores, fonte, bordas, botão, indicador de etapas e resumo. A CLI não autentica nem publica; o usuário importa o JSON, revisa e salva o rascunho pelo editor autenticado. Textos, imagens, elementos, checkout/produto e configurações comerciais permanecem no editor.

## Fontes

- `apps/web/src/theme-kit/contract.mjs`: lista permitida, tipos, limites, validação, exportação e aplicação. Reutilizado literalmente no kit da CLI.
- `apps/web/src/theme-kit/templates.mjs`: Essencial, Varejo e Marketplace. Os dois últimos reutilizam o catálogo do editor.
- `scripts/theme-kit/pirat.mjs`: CLI offline, sem dependências. `init` exige pasta nova; `validate` e `build` leem theme.json; build escreve somente dist/theme.pirat.json.
- `scripts/theme-kit/THEME-RULES.md`: regras copiadas para AGENTS.md no projeto inicializado.
- `scripts/build-theme-kit.mjs`: ZIP reproduzível, schema e JSON individuais em public/downloads. Downloads são versionados no Git para o build/Docker atual.
- `ThemeTransfer.jsx`: valida tudo antes da confirmação; aplicação usa o histórico já existente do editor. Não envia arquivos à API nem publica automaticamente.
- Guias públicos `temas-cli` e `contrato-temas` em docs-content.js.

## Manutenção e testes

Após alterar contrato, catálogo, CLI ou regras, regenere o download:

```sh
npm run build:themes
npm run test:themes
npx vitest run apps/web/test/docs.test.js
npm run build --workspace=@solid/web
npx playwright test --config scripts/admin-ui.config.mjs themes.spec.mjs
```

Os testes extraem e executam a CLI do ZIP sem instalar dependências, verificam erros e preservação de dados. Os testes de interface cobrem rejeitar, cancelar, aplicar, desfazer, salvar e downloads públicos. Use VISUAL_SERVER_EXTERNAL=1 somente se a prévia já estiver ativa na porta 4176.

## Limites e evolução

Não há sandbox de React/JavaScript, upload de pastas executáveis, novos componentes arbitrários ou comandos remotos de publicação. A versão inicial usa recursos reais já disponíveis. Expandir para blocos portáveis exigirá um contrato próprio de IDs, assets, migração e merge; autenticação de CLI remota exigirá tokens com escopos e revogação. Não documentar essas capacidades como implementadas.
