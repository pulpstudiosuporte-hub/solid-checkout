# Interface do painel SOLID

O visual do sistema está em `apps/web/src/admin-refresh.css`, aplicado às raízes `.solid-admin` e `.solid-auth`. A navegação usa uma superfície escura; as telas de gestão mantêm fundos claros, campos maiores, estados de foco e espaçamentos consistentes. O menu móvel fecha com Escape, conserva o foco dentro da navegação e devolve o foco ao botão de abertura.

O início inclui `RevenueOverview.jsx` e `RevenueChart.jsx`: receita por período, pontos exploráveis com mouse ou teclado, ticket médio e pedidos Pix pendentes. Os valores vêm de `/dashboard`, com estados de carregamento, falha e ausência de dados. As respostas fictícias existem apenas no diretório de testes.

## Conferência local

Tente primeiro o navegador integrado, conforme `visual-review.md`. A suíte abaixo usa o Chrome instalado, define o viewport real e salva imagens em `.visual-check/admin-*.png`:

```powershell
npm.cmd run test:ui
```

O comando compila o frontend e inicia um preview isolado em `127.0.0.1:4176`. Os testes cobrem início, produtos, pedidos, checkouts, configurações, análises, gateways, logística, order bumps e cupons; verificam também busca, menu compacto, navegação móvel, abertura de formulário, login/cadastro/recuperação, gráfico e estados de erro e vazio.

As chamadas de API são interceptadas com dados fictícios em memória. Endpoints ausentes são reportados e gravações são bloqueadas. A CSP é ignorada apenas nesse contexto de teste, porque a política de produção não permite a API local na porta 3333. O CSS de fontes externas é substituído pelo fallback local para capturas determinísticas. As configurações de produção não são alteradas por essas opções.

Abra as capturas para avaliar a aparência; testes aprovados não substituem a inspeção das imagens. A suíte não valida login real, persistência, integrações, autenticação de produção ou pagamentos. Essas verificações dependem da API e de credenciais apropriadas.

O site institucional separado continua em `solid-site`; a reconstrução do frontend do sistema é necessária para publicar estas alterações no painel.
