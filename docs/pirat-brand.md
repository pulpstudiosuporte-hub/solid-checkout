# Identidade do aplicativo Pirat

Primeira etapa da mudança de marca: login, cadastro, recuperação, painel,
elementos de administração e identidade do aplicativo instalável.

Referência: identidade visual fornecida em `pirat id`. Os arquivos originais
foram copiados, sem redesenhar, recortar ou recolorir a marca:

- `apps/web/public/brand/pirat-logo-on-light.png`: logo para fundo claro.
- `apps/web/public/brand/pirat-logo-on-dark.png`: logo para fundo escuro.
- `apps/web/public/brand/pirat-mascot.png`: papagaio isolado, também usado como ícone.

Paleta: vermelho `#F52218`, vinho `#2B0200`, marfim `#FFFCF8`, carvão
`#141414` e dourado `#FFBC21`. Botões com texto branco usam `#C91D16`
para manter contraste. Títulos usam Bricolage Grotesque; a interface usa Inter.
As fontes latinas (incluindo acentos em português) são servidas localmente em
`apps/web/public/brand/fonts`, com as licenças OFL originais.
Tokens e aplicação principal ficam em `apps/web/src/pirat-theme.css`.

A aplicação segue com tema claro e superfícies de destaque escuras; os arquivos
de logo para dois fundos não acrescentam uma preferência de tema escuro.
Verde de sucesso e outras cores semânticas continuam diferenciadas.

A personalização dos checkouts dos lojistas e os dados salvos não são migrados.
As classes internas com prefixo `solid`, chaves de armazenamento, pacotes,
endereços, autenticação e contratos de API mantêm compatibilidade.
O site institucional e a definição de voz do mascote ficam para etapas futuras.
Materiais de integrações externas e razão social não são alterados por este trabalho.

Validação: `npm run check` e testes Playwright de administração, editor e
acessibilidade. As capturas de login e painel usam contas e respostas fictícias;
elas não comprovam autenticação ou pagamentos em produção. Push, deploy e
validação em produção devem ser confirmados separadamente.
