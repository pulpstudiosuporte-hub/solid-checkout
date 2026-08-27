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
- O limitador atual atende uma única instância. Antes de escalar a API horizontalmente, use um armazenamento compartilhado (Redis) para rate limiting.
- A limpeza automática expira sessões de checkout, remove tokens temporários e anonimiza checkouts abandonados após 30 dias.
