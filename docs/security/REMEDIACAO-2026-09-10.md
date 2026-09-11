# Correções da auditoria SOLID

Implementação local concluída em 10/09/2026, com verificações finais na virada para 11/09 UTC. Referência: [auditoria original](AUDITORIA-2026-09-10.md). Este registro descreve código e testes locais; não registra deploy ou alteração no banco de produção.

## Resultado por ponto

| Ponto | Alteração | Limite ou acompanhamento |
|---|---|---|
| 1. Pix duplicado | Reserva persistida sob bloqueio da sessão, compartilhada entre gateways. Resposta do provedor salva antes do enfileiramento. Reinício retoma respostas salvas. | Timeout sem identificador oficial fica UNCERTAIN e exige conferência, sem tentativa automática em outro gateway. |
| 2. Reconciliação injusta | Seleção por vencimento, bloqueio SKIP LOCKED, lease e backoff persistidos por tentativa. Removido corte de 24 horas. | Capacidade e latência sob carga real precisam de monitoramento. |
| 3. Dependências | Fastify, Sharp e fast-uri corrigidos; dotted-map removido do runtime. | Quatro alertas high transitivos do Prisma permanecem como exceções restritas até 31/10/2026. |
| 4. Auditoria falsamente verde | Falhas de rede, execução, timeout, JSON e relatórios incompletos encerram o comando com erro. | Exceções exigem versão instalada, advisory, cadeia e PostgreSQL compatíveis. |
| 5. Cabeçalhos publicados | Nginx com segurança, HTML sem cache, gzip e teste automatizado de cabeçalhos no CI. | A origem pública precisa ser verificada novamente após deploy. |
| 6. Estorno parcial | Crédito proporcional e cumulativo da taxa efetivamente cobrada, em lançamentos novos; sem alterar lançamentos faturados. | Valor parcial ausente ou ambíguo gera conferência, sem crédito integral. |
| 7. Confirmação tardia | Pagamento confirmado conclui sessões expiradas/canceladas; transição concorrente cobra taxa uma vez. Limpeza protege sessões pagas/estornadas. | Dados já anonimizados anteriormente não são recuperados por esta mudança. |
| 8. Recuperação de carrinho | PROCESSING abandonado volta à fila após cinco minutos. Conclusão vinculada à lease impede trabalhador antigo de finalizar a nova tentativa. | Entrega externa ainda deve ser acompanhada pelo provedor de e-mail. |
| 9. Receita de produtos | Apenas sessões com pagamento confirmado entram nas vendas; agrupamento por produto e rateio após descontos. | Receita apresentada continua sendo receita bruta dos pagamentos PAID, não um relatório contábil líquido de estornos parciais. |
| 10. Painel sem limites | Agregação SQL por loja, séries e rankings limitados, cache com teto de 500 entradas. | Não foi feito benchmark com o volume de produção. |
| 11. Mídia | Hash de conteúdo, deduplicação e quota em transação; biblioteca paginada para reutilizar/excluir; referências e isolamento de loja conferidos. | Arquivos antigos sem hash passam a ser deduplicados conforme novos uploads. Não há exclusão automática de todo arquivo aparentemente órfão. |
| 12. CI | Jobs de PostgreSQL real, interface/axe, Semgrep, auditoria e Nginx; orçamento dos bundles no check. | Execução remota do workflow depende de publicação no repositório. |
| 13. Acessibilidade | Controles recebem nomes acessíveis, contraste corrigido nas telas verificadas e biblioteca com diálogo nativo/foco/Escape. | Axe cobre os cenários listados abaixo; não representa certificação de toda a aplicação ou de temas arbitrários do lojista. |
| 14. Manutenção | Cliente HTTP separado com checagem de tipos, timeout e cancelamento; código morto removido; opções corretas do ESLint preservadas. | Migração integral de JSX para TSX continua incremental. Permanecem 19 avisos de lint, sem erros. |
| 15. Peso inicial | Mapa estático substitui gerador JavaScript; CSS do checkout/editor carregado com seu módulo; animação do mapa pausa fora da tela. | SVG do mapa é um recurso separado, cerca de 460 kB bruto / 22 kB gzip. |
| 16. Documentação | Modelo de ameaças e retenção atualizados; procedimento de migração e acompanhamento abaixo. | Backups, restauração, proxy/CDN e alertas precisam ser confirmados na infraestrutura real. |

## Validação executada

- `npm run check`: código de saída 0; 217 testes dos workspaces (145 API, 64 web, 4 configuração, 4 autorização); checagem de tipos e build aprovados. A política de auditoria foi ampliada e os três testes passaram também em execução específica. ESLint: zero erros, 19 avisos.
- `npm run test:integration`: oito testes aprovados em PostgreSQL 18 isolado, com todas as 58 migrações aplicadas. Verificam reserva concorrente entre gateways, retomada após reinício, distribuição de 60 pagamentos antigos entre trabalhadores, confirmação duplicada/tardia, métricas por loja, estornos cumulativos, mídia/quota e lease de recuperação.
- Playwright: 27 testes aprovados, incluindo navegação, falha de gravação/publicação, preservação de rascunho, controles de toque e viewports de 320 a 1440 px. A suíte do painel foi executada novamente após estabilizar animações nas capturas e adicionar verificação contra sobreposição da barra lateral.
- Axe: sem violações A/AA detectadas em login, Início, Pedidos, Produtos, Análises, Checkouts, cabeçalho do editor mobile e biblioteca de imagens, nos estados testados.
- Semgrep CE 1.177.0: 92 regras aplicáveis, 163 arquivos de código, zero achados; inclui os novos arquivos, confirmado no JSON da varredura com `--no-git-ignore`.
- `npm run audit:prod`, com acesso efetivo ao npm: zero alertas inesperados, quatro high nas exceções abaixo e zero critical. Uma falha de consulta dentro do sandbox retornou erro, como esperado pela política nova.
- Limites dos bundles aprovados: CSS inicial do painel de aproximadamente 366 para 272 kB; JavaScript do mapa de aproximadamente 396 para 2,2 kB. O gerador do mapa não integra mais as dependências do frontend.
- Nginx oficial 1.30.4 em loopback: configuração validada com `nginx -t`, cabeçalhos de `/` e `/index.html` aprovados e asset CSS servido com gzip, `Vary: Accept-Encoding` e cache imutável. A cópia de teste adapta somente o endereço/porta de escuta e o diretório do build; não valida o Traefik/CDN ou TLS de produção.

Evidências locais, ignoradas pelo Git: `.visual-check/fixes-check.json`, `fixes-check.log`, `fixes-semgrep-all.json` e capturas Playwright. Foram abertas as imagens nativas `desktop.png` e `mobile.png`, além de login, painel e editor em viewports reais de celular/tablet. O capturador nativo recorta a janela estreita; a referência mobile é Playwright. O navegador integrado estava indisponível antes de abrir páginas, conforme `docs/visual-review.md`.

As APIs dos testes de interface são simuladas e a CSP é contornada exclusivamente nessa suíte. Testes locais não comprovam login em produção, aprovação de um Pix real, entrega de e-mail, autenticação dos gateways ou execução do CI remoto.

## Dependências com exceção temporária

`scripts/audit-policy.mjs` restringe as exceções às versões instaladas e aos advisories revisados:

- `deepmerge-ts@7.1.5` e sua propagação para `@prisma/config@7.9.1`: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- `mysql2@3.15.3`, somente como dependência do Prisma CLI: [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) e [GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), com propagação para `prisma@7.9.1`.

O sistema usa PostgreSQL e não abre conexões MySQL. Isso restringe a exposição dos usos analisados, mas não remove o pacote vulnerável. Advisory novo, versão diferente, mudança para MySQL ou vencimento em 31/10 invalidam a exceção. Atualizar o Prisma quando houver correção compatível continua pendente.

## Migração e publicação

1. Preparar backup restaurável e compilar a mesma revisão que será publicada.
2. Interromper escritores antigos da API e dos processadores de pagamentos. A alteração da unicidade do livro de taxas não deve conviver com código antigo fazendo upsert pela chave anterior.
3. Executar `npm run db:deploy` com a conexão de produção configurada pelo mecanismo de segredos do ambiente. Aplicam-se `20260911000100_payment_integrity`, `20260911000200_media_deduplication` e `20260911000300_partial_refund_ledger`.
4. Iniciar a nova API/processadores e publicar o frontend correspondente. Os tipos Prisma precisam ter sido gerados no build.
5. Conferir readiness, autenticação, painel de operações e um pagamento controlado com o gateway. Testar confirmação tardia e eventos repetidos em sandbox do provedor quando disponível.
6. Executar `npm run check:headers -- https://app.solidcheckout.xyz` pelo domínio público e conferir a compressão dos assets. A imagem web do CI também executa esse teste em Nginx local.

Não reverter apenas o binário da API para a versão antiga após a migração do livro de taxas. Prefira correção adiante; rollback do esquema exige avaliar os lançamentos com sequência e preservar o histórico. Nenhuma dessas etapas foi executada em produção nesta tarefa.

## Operação de pagamentos que exigem conferência

O administrador encontra no painel de operações tentativas CREATING/UNCERTAIN antigas, pendências acima de 24 horas e estornos parciais sem valor confirmado. Esses itens não oferecem um botão de retry cego.

- Se houver resposta oficial salva, o reconciliador conclui o enfileiramento automaticamente, sem criar novo Pix.
- Se a criação terminou sem identificador oficial, consultar o gateway com a referência de idempotência, loja, horário e valor. Preservar a tentativa e o resultado da conferência. Não excluir nem marcar como falha por suposição, pois uma cobrança externa pode existir.
- Quando o gateway confirmar pagamento, usar o fluxo autenticado de notificação/reconciliação suportado. Uma correção manual excepcional deve conferir identificador, valor, loja e vínculo da sessão, com registro de auditoria.
- Estorno parcial usa apenas valor cumulativo confirmado em centavos. A implementação aceita os campos explícitos dos adaptadores; não converte por adivinhação um `refund_amount` de unidade desconhecida. O contrato desses campos ainda precisa ser exercitado com respostas reais de cada provedor.
- A regra adotada é devolução proporcional da taxa efetivamente cobrada. Valor ausente gera sinalização de conferência; estorno integral devolve somente a taxa restante. Lançamentos faturados não são reescritos.

Monitorar `payment_pending_over_24h`, `payment_reconciliation_item_failed`, `payment_reconciliation_unverified` e `payment.partial_refund_review_required`, além do número de jobs DEAD e do atraso da fila. O código fornece sinais e recuperação; configuração de alertas e testes de restauração dependem da operação de produção.

## Conferência do conjunto preparado para o push

O commit da auditoria foi separado das alterações locais anteriores do site institucional. Uma cópia isolada do índice recebeu `npm ci --ignore-scripts`, build dos pacotes compartilhados e `npm run check`, com código de saída 0. Foram aprovados 203 testes dos workspaces (145 API, 50 web, 4 autorização e 4 configuração), além de três testes de segurança; os 14 testes exclusivos da landing page permanecem no trabalho local separado. Tipos, builds e limites de bundles passaram. A auditoria de produção nessa instalação limpa confirmou somente as mesmas quatro exceções transitivas. Evidências: `.visual-check/push-check.json` e `push-check.log`.
