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

O login e o painel têm modo claro e escuro. Na primeira visita, seguem a
preferência do sistema; o botão de sol/lua salva a escolha neste navegador
e sincroniza abas abertas. Se o armazenamento não estiver disponível, a troca
de tema permanece funcionando durante a visita. A preferência não altera a conta.
As logos para fundo claro/escuro acompanham o tema.
Verde de sucesso e outras cores semânticas continuam diferenciadas.

`app-theme.js` gerencia a preferência, `ThemeToggle.jsx` fornece o controle e
`app-dark-theme.css` define os tokens locais de aparência. Os estilos existentes
usam os valores claros originais como fallback. `--sf`, `--bd` e `--mt`
representam superfície, borda e texto secundário. As prévias do editor isolam
esses tokens para manter as cores, controles e dados do lojista.

A personalização dos checkouts dos lojistas e os dados salvos não são migrados.
As classes internas com prefixo `solid`, chaves de armazenamento, pacotes,
endereços, autenticação e contratos de API mantêm compatibilidade.
O site institucional também usa a identidade Pirat nas entradas integrada e independente.
A definição completa de voz do mascote fica para uma etapa futura.
Materiais de integrações externas e razão social não são alterados por este trabalho.

Validação: `npm run check` e testes Playwright de administração, editor e
acessibilidade. As capturas de login e painel usam contas e respostas fictícias;
elas não comprovam autenticação ou pagamentos em produção. Push, deploy e
validação em produção devem ser confirmados separadamente.
