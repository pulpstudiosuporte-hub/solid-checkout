# Segurança operacional do SOLID

## Segredos

- Mantenha `APP_ENCRYPTION_KEY`, chaves dos gateways, Shopify, Resend e Dokploy apenas no cofre de variáveis do Dokploy.
- Nunca copie segredos para Git, logs, tickets ou capturas de tela. Rotacione imediatamente qualquer chave exposta.
- Revogue variáveis temporárias `SOLID_ADMIN_*`, `SOLID_RESET_*` e `SOLID_ROLE_*` logo após o uso.
- Faça rotação trimestral das chaves de API. A rotação de `APP_ENCRYPTION_KEY` exige migração dos dados criptografados e não deve ser feita sem procedimento de recriptografia.

## Banco e backups

- Não publique a porta 5432 na internet. API e PostgreSQL devem conversar pela rede interna.
- Faça backup diário criptografado, retenha ao menos 30 dias e teste a restauração mensalmente.
- Restrinja o acesso ao Dokploy com MFA e contas individuais; não compartilhe usuário administrador.

## Produção

- Use somente HTTPS, `TRUST_PROXY=true` atrás do Traefik e apenas origens reais em `CORS_ORIGINS`.
- Monitore falhas de login, redefinição de senha, webhooks, reconciliações e respostas 5xx.
- Configure `REDIS_URL` na API para compartilhar o rate limiting entre todas as réplicas. Sem Redis, cada réplica limita apenas o próprio tráfego; com Redis configurado, uma falha do serviço bloqueia as rotas limitadas em vez de liberar tentativas sem controle.
- A limpeza automática expira sessões de checkout e remove tokens temporários. A anonimização de abandonos ocorre após 30 dias no START, 90 no PRIME e 180 no ELITE; sessões com pagamento PAID ou REFUNDED são excluídas dessa limpeza. Auditoria e sessões ChromaSense têm retenção de 400 dias; eventos ChromaSense, entregas de webhook concluídas e inscrições push inativas usam 90 dias.

## Publicação das correções de 10/09/2026

Consulte [o registro de correções e o procedimento de migração](security/REMEDIACAO-2026-09-10.md). A migração do livro de taxas altera a chave única: coordene a parada de escritores antigos e a entrada da nova API. Não mantenha versões antigas gravando durante essa migração.

Após publicar o frontend, execute `npm run check:headers -- https://app.solidcheckout.xyz`. O teste consulta `/` e `/index.html` pela origem solicitada. Ter os cabeçalhos no arquivo Nginx não comprova sua presença depois do proxy/CDN.

Monitore o painel administrativo de operações e os eventos `payment_pending_over_24h`, `payment_reconciliation_item_failed` e `payment.partial_refund_review_required`. Uma criação de Pix sem resposta conclusiva precisa de conferência no gateway: não apague a tentativa nem libere outra cobrança sem confirmação oficial de que a anterior não existe ou foi encerrada.
