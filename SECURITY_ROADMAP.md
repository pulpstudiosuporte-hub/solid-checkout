# SOLID — Roadmap de segurança e liberação

## Estado atual

O projeto atual é um protótipo visual React/Vite. Não possui backend, banco, autenticação, autorização, isolamento multiempresa ou gateway real. As configurações do editor ficam em `localStorage`.

**Regra de liberação:** até a conclusão dos blocos P0, o sistema não pode coletar CPF real, armazenar credenciais, conectar lojas reais ou processar pagamentos reais.

## P0 — bloqueadores para qualquer piloto real

### 1. Fundação segura do projeto

- [x] Definir monorepo modular: painel, API, worker e pacotes compartilhados. Código server-side em TypeScript estrito; frontend legado com migração incremental.
- [x] Escolher versões fixas e suportadas; remover dependências `latest`.
- [x] Criar configuração validada por ambiente e `.env.example` sem segredos.
- [ ] Separar desenvolvimento, staging e produção.
- [x] Adicionar lint, testes, CI e auditoria de dependências. A proteção de branches será ativada no provedor Git.
- [x] Adotar OWASP ASVS 5.0 nível 2 como checklist técnico mínimo.
- [x] Criar modelagem inicial de ameaças e registro de decisões de segurança.

**Aceite:** build reproduzível, nenhum segredo no frontend/repositório e pipeline bloqueando falhas críticas.

### 2. Banco e isolamento multiempresa

- [x] PostgreSQL e migration inicial versionada (execução local aguarda instalação do Docker).
- [x] Entidades `User`, `Store`, `StoreMember`, `Session` e `AuditLog`.
- [x] Padrão para toda entidade de negócio usar `store_id` obrigatório quando aplicável.
- [x] Camada central de autorização que derive a loja da sessão, nunca do navegador.
- [x] Testes negativos em memória provando que uma loja não acessa dados de outra; suíte PostgreSQL entra quando o serviço estiver disponível.
- [x] IDs públicos aleatórios e diferentes dos IDs internos.

**Aceite:** testes automatizados de isolamento e autorização em toda rota administrativa.

### 3. Autenticação e sessões

- [ ] Cadastro, verificação de e-mail, login e logout.
- [ ] Senhas com Argon2id e política contra senhas comprometidas.
- [ ] Sessões revogáveis em cookie `HttpOnly`, `Secure` e `SameSite` apropriado.
- [ ] Proteção CSRF para operações autenticadas.
- [ ] Rotação de sessão após login e mudança de privilégio.
- [ ] Expiração por inatividade e expiração absoluta.
- [ ] Recuperação com token aleatório, curto, de uso único e armazenado com hash.
- [ ] Rate limit por IP e conta; respostas que não enumerem usuários.
- [ ] MFA obrigatório para `OWNER` antes de gateway, domínio, equipe e exportação.
- [ ] Reautenticação para ações críticas e tela para revogar sessões.

**Aceite:** suíte de testes para abuso de login, reset, CSRF, fixação e revogação de sessão.

### 4. Proteção de dados e LGPD

- [ ] Inventário: dado, finalidade, base legal, acesso, retenção e descarte.
- [ ] Coletar apenas dados necessários ao produto vendido.
- [ ] Criptografar tokens de Shopify/gateway em repouso com chaves fora do banco.
- [ ] Mascarar CPF, telefone e e-mail em painel, exportações e logs.
- [ ] Política de retenção e exclusão; fluxo para direitos do titular.
- [ ] Consentimento separado para pixels quando aplicável.
- [ ] Backup criptografado e teste periódico de restauração.
- [ ] Plano de resposta e comunicação de incidentes.
- [ ] Avaliar RIPD antes do piloto e obter revisão jurídica dos textos.

**Aceite:** mapa de dados aprovado, logs sem dados completos e ciclo de exclusão/restauração testado.

### 5. Checkout público seguro

- [ ] Checkout público lê somente versão publicada e imutável.
- [ ] Configurações aceitam apenas tokens validados; nenhum HTML/JS livre.
- [ ] Sanitização de texto formatado, URLs e uploads.
- [ ] CSP restritiva e headers: HSTS, `nosniff`, política de referrer e permissões.
- [ ] Validação e normalização server-side de todos os campos.
- [ ] Proteção contra XSS, SSRF, abuso de upload e automação.
- [ ] Sessão pública com token aleatório, escopo mínimo e expiração.
- [ ] Preço, desconto, bump, estoque e total recalculados no servidor.
- [ ] Snapshots imutáveis de itens e valores do pedido.
- [ ] Rate limit específico para sessão, cupom, pedido e Pix.

**Aceite:** manipular preço ou configuração pelo navegador não altera o total nem o pedido.

### 6. Pagamento Pix e webhooks

- [ ] Contrato interno de gateway e provider exclusivamente sandbox primeiro.
- [ ] Idempotência na criação de pedido e cobrança.
- [ ] Segredos do gateway somente no servidor, criptografados em repouso.
- [ ] Preservar corpo bruto e validar assinatura/timestamp do webhook.
- [ ] Persistir chave idempotente única antes do processamento.
- [ ] Responder rápido e processar em fila com retry e dead-letter queue.
- [ ] Reconciliar valor, moeda, pedido, cobrança e transição de estado.
- [ ] Nunca aceitar confirmação de pagamento vinda do frontend.
- [ ] Garantir que estoque, receita e evento `Purchase` ocorram uma vez.
- [ ] Consulta de status autenticada ao gateway como reconciliação.
- [ ] Trilha de auditoria e reprocessamento manual protegido.

**Aceite:** webhooks inválido, repetido, atrasado e com valor divergente são testados e não geram venda duplicada.

## P1 — antes de produção aberta

### 7. Integração Shopify

- [ ] OAuth com `state`, callback validado e permissões mínimas.
- [ ] GraphQL Admin API em versão suportada.
- [ ] Tokens criptografados e revogação no uninstall.
- [ ] Webhooks com HMAC no corpo bruto e idempotência.
- [ ] Paginação, rate limit, retry com backoff e auditoria.
- [ ] Nenhum dado da Shopify autoriza preço ou pagamento sem validação local.

### 8. Infraestrutura e operação

- [ ] TLS obrigatório, proxy seguro e origem não exposta quando possível.
- [ ] Banco e Redis sem portas públicas.
- [ ] Containers sem privilégio, limites de recursos e health checks.
- [ ] Secret manager e rotação de chaves.
- [ ] Logs estruturados redigidos; métricas e alertas de segurança.
- [ ] WAF/rate limiting como defesa adicional, não como controle único.
- [ ] Backup fora do servidor principal e restauração ensaiada.
- [ ] Deploy imutável, migrations controladas e rollback testado.

### 9. Verificação de segurança

- [ ] Testes unitários de autorização, dinheiro, estados e assinaturas.
- [ ] Testes de integração para isolamento e webhooks.
- [ ] Testes E2E do ciclo Pix sandbox.
- [ ] SAST, análise de dependências e secret scanning no CI.
- [ ] DAST no ambiente de staging.
- [ ] Revisão manual baseada no ASVS nível 2.
- [ ] Pentest independente antes de transações reais.
- [ ] Plano de correção com severidade, responsável e prazo.

## P2 — evolução controlada

- [ ] Domínios personalizados com verificação de posse e provisionamento seguro.
- [ ] Pixels server-side com deduplicação, consentimento e minimização.
- [ ] Exportações assíncronas protegidas, expiradas e auditadas.
- [ ] Detecção de anomalias e antifraude adaptativo.
- [ ] Rotação automática de chaves e exercícios de incidente.

## Ordem de execução acordada

1. Fundação segura e decisões de arquitetura.
2. Banco e isolamento multiempresa.
3. Autenticação, sessões e MFA.
4. Proteção de dados e auditoria.
5. Checkout server-side.
6. Pix sandbox e webhooks.
7. Shopify.
8. Infraestrutura, observabilidade e verificação final.

O editor visual pode continuar evoluindo em paralelo, mas não deve ser tratado como fonte confiável de preço, status, loja ou pagamento.
