# Análises

O painel usa `/dashboard` para consultar os indicadores da loja ativa. Os filtros Hoje, Ontem, Últimos 7 dias, Mês atual e Ano atual continuam disponíveis.

O filtro Personalizado aceita `period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`. As datas são inclusivas no horário de Brasília, entre 2020 e hoje, com no máximo 366 dias. O último dia é limitado ao instante atual quando necessário. A API valida o intervalo antes de executar a consulta e mantém o cache de 15 segundos separado por loja, usuário e período.

Análises envia também `store`, o identificador público da loja esperada. Se a loja ativa mudou, a API retorna `409 STORE_CHANGED`. A interface reinicia o estado ao trocar de loja e ignora respostas de consultas canceladas. Na troca de período, os valores anteriores ficam ocultos até a nova consulta terminar. Uma atualização do mesmo período preserva os dados anteriores com aviso explícito em caso de falha.

O gráfico mostra no máximo cinco rótulos de data e mantém todos os pontos diários. A opção **Ver valores por dia** disponibiliza os valores exatos em uma tabela acessível por teclado. Períodos sem pagamentos não elegem um “melhor dia” fictício. Os indicadores usam duas colunas no celular.

## Validação

- `npm.cmd run check`: lint, tipos, testes, builds e limites dos bundles.
- `npx.cmd playwright test --config scripts/analytics-ui.config.mjs`: datas personalizadas, gráfico anual, troca de loja/período com resposta atrasada, recuperação de erro, ausência de vendas e largura de 375 px.
- Capturas em `.visual-check/desktop.png`, `.visual-check/mobile.png` e `.visual-check/analytics-mobile-top.png`.

Os testes de interface usam dados locais simulados. A revisão não substitui a conferência dos indicadores com pedidos reais após o deploy. A consulta SQL e as regras comerciais de cálculo existentes não foram alteradas. A API e o frontend precisam ser publicados juntos para disponibilizar o novo filtro. A entrada de Novidades está incluída em `automaticReleases`.
