# Revisão de Webhooks e ChromaSense — 11/09/2026

## Correções

### Webhooks

- A interface oculta criação, edição, exclusão e teste de usuários sem permissão de escrita. A API continua exigindo associação à loja ativa, OWNER/ADMIN, origem permitida e CSRF válido para mutações.
- O teste de endpoint inativo é rejeitado antes de entrar na fila. Entregas pendentes são consultadas novamente pela interface; temporizadores e requisições são cancelados ao sair da página.
- Respostas antigas não substituem o estado após uma atualização ou troca de loja. A troca de loja também descarta o formulário e a chave exibida da loja anterior.
- A chave oferece confirmação de cópia e seleção manual quando o navegador recusa acesso à área de transferência. Atualizações do componente não reiniciam o foco do diálogo.
- O transporte HTTPS mantém o endereço DNS fixado e passa a aceitar IPv6 público, bloqueando também os endereços privados mapeados. Não segue redirecionamentos.
- Há um prazo absoluto de 10 segundos para a requisição HTTPS, além do timeout de inatividade. Respostas interrompidas rejeitam o envio. O prazo não inclui a resolução DNS anterior à requisição.
- O histórico registra o número de tentativas tanto em sucesso quanto em falha e preserva o status HTTP de respostas malsucedidas.
- Listas de eventos com elementos inválidos são rejeitadas. O limite de 20 endpoints por loja é verificado sob trava transacional. Chaves informadas precisam ter de 16 a 256 caracteres.

### ChromaSense

- A coleta exige token de checkout ainda válido. Uma visita não pode ser reaproveitada por outra sessão de checkout.
- Contadores e eventos são gravados na mesma transação, com trava por visita para preservar o teto de 10.000 eventos e a maior profundidade observada.
- A distribuição de rolagem conta quantas sessões alcançaram cada faixa. Novas coletas incluem a região já visível na abertura da página, inclusive páginas que cabem inteiras na tela.
- Cliques fora de controles são classificados como não interativos. A fila no navegador permanece limitada a 200 eventos mesmo com uma requisição de envio pendente.
- A amostra de eventos prioriza os mais recentes, como anunciado pela tela.
- Atualizações e mudanças de filtro cancelam as consultas anteriores. A troca de loja reinicia a seleção do checkout; uma falha de atualização não deixa resultados antigos apresentados como atuais.
- A tela informa que os filtros atuais mostram celulares. A ajuda esclarece que o mapa é aproximado: ele agrega etapas e usa o layout publicado atual, sem reconstruir a tela original de cada visita.
- O atributo `inert` da prévia usa o booleano esperado pelo React, bloqueando foco e interação com os campos do checkout apresentado no mapa.

## Validação

- `npm.cmd run check`: lint, tipos, testes, build e limites dos bundles aprovados; 19 avisos de lint preexistentes.
- Testes direcionados de rota e transporte: isolamento por sessão/loja, token expirado, CSRF, permissões, quota, IPv6, deadline, resposta interrompida, tentativas e status HTTP.
- `npx.cmd playwright test --config scripts/areas-ui.config.mjs`: três cenários aprovados, cobrindo permissões, troca de loja, criação, fallback de cópia, consulta de entrega, filtros, falha de atualização e largura mobile.
- Revisão visual no navegador integrado e abertura das capturas desktop/mobile de Webhooks e ChromaSense. A página `/ui-tests/areas-review.html` usa respostas locais fictícias e não integra o build de produção.

## Limites da revisão

O Semgrep não estava instalado nem disponível como ferramenta. Foram usados revisão manual, lint e testes; isso não constitui certificação de segurança.

Os testes de API usam Fastify.inject com banco simulado, e os de transporte não enviam tráfego externo. As travas e o rollback precisam de verificação com PostgreSQL real. A entrega ponta a ponta e a validação da assinatura HMAC pelo receptor precisam de um endpoint de integração autorizado. Nenhum webhook foi enviado a terceiros durante a revisão.

As correções não exigem migration. O histórico de rolagem já coletado mantém os valores anteriores; a nova medida de área visualizada vale para as próximas coletas. O mapa continua sem separação por etapa e versão do layout, portanto não deve ser interpretado como uma reprodução exata da visita.
