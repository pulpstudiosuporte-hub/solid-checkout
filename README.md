# SOLID Checkout

Checkout SaaS multiempresa SOLID, com painel operacional, checkout público, integrações, pagamentos e conteúdo administrável.

## Estrutura

```text
apps/web       painel e checkout visual React/Vite
apps/api       API Fastify TypeScript
apps/worker    processo isolado para filas futuras
packages/config     validação de ambiente
packages/contracts  contratos compartilhados
packages/database   schema Prisma, migrations e cliente PostgreSQL
packages/authorization contexto de loja e autorização central
docs/security       modelo de ameaças e decisões
```

## Requisitos

- Node.js 22.12 ou superior.
- npm 10 ou superior.

## Instalação e validação

```bash
npm ci
npm run check
```

## Desenvolvimento

Copie `.env.example` para `.env` apenas no ambiente local e substitua valores fictícios quando o serviço correspondente existir. Nunca faça commit do `.env`.

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3333`
- Health: `GET /health/live` e `GET /health/ready`

`npm run dev` continua abrindo o frontend para preservar o fluxo anterior.

Para gerar capturas locais de desktop e celular, execute `npm run visual:check`. O procedimento, os requisitos e a alternativa ao navegador integrado estão em [docs/visual-review.md](docs/visual-review.md).

O site institucional pode ser visualizado em `/site.html` e testado com `npm run test:site`, incluindo cliques e viewport mobile real. Veja [publicação em solidcheckout.xyz](docs/marketing-site.md).

## PostgreSQL local

O Docker ainda precisa estar instalado na máquina. Depois disso:

```bash
docker compose up -d postgres
copy .env.example .env
npm run db:generate
npm run db:migrate -- --name initial_tenancy
npm run db:seed
```

Em produção/staging use somente `npm run db:deploy`; nunca use `migrate dev`.

## Segurança nesta fase

- Dependências usam versões exatas e lockfile.
- Código server-side usa TypeScript estrito.
- Variáveis da API são validadas antes do processo iniciar.
- API usa CORS explícito, rate limit, limite de payload, headers seguros e logs redigidos.
- CI executa lint, typecheck, testes, build e auditoria de vulnerabilidades de produção.
- O modelo inicial de ameaças está em `docs/security/THREAT_MODEL.md`.

## Deploy do painel web no Dokploy

Configure o serviço web para construir com o arquivo `Dockerfile.web`. Ele gera o bundle Vite e publica pelo Nginx com fallback de SPA, cache correto dos assets e headers de segurança. O serviço deve expor a porta `80` e receber `VITE_API_URL` e `VITE_TURNSTILE_SITE_KEY` como argumentos de build.

O serviço da API continua usando seu fluxo próprio e deve executar `prisma migrate deploy` antes de iniciar. Nunca compartilhe o mesmo health check ou Dockerfile entre web e API.

## Desconto Pix

Na página de cupons, configure o percentual, a compra mínima após cupom e um teto opcional para o desconto Pix. Apenas OWNER e ADMIN podem salvar. A configuração vale para novas sessões; cada sessão guarda sua regra, inclusive quando o lojista altera ou desativa o desconto depois.

O desconto é calculado em centavos sobre os produtos após o cupom, sem frete, limitado para manter pelo menos R$ 0,01 em produtos. `discountCents` contém a soma dos descontos; `paymentDiscountCents` identifica a parcela Pix. Alterações de quantidade, bump e cupom recalculam ambas as parcelas. Pagamentos e integrações continuam usando o desconto total.

Antes de publicar esta versão, aplique `npm run db:deploy` no ambiente configurado para instalar a migration `20260910190000_payment_discounts`. Nenhuma migration é executada pelo build. `DATABASE_URL` é necessária para comandos de banco e para iniciar a API, mas não para gerar o Prisma Client, compilar ou executar os testes unitários.

## Desempenho do checkout

O checkout público carrega uma entrada separada do painel e do editor. No build local, a soma de JS e CSS da entrada pública e suas dependências caiu de 857.792 para 440.776 bytes (48,6%); com gzip, de 209.901 para 120.597 bytes (42,5%). A medição não inclui imagens, fontes externas nem chamadas da API. O favicon usa uma versão de 5.803 bytes; o original de 479.266 bytes permanece disponível.

A criação do Pix grava as entregas de UTMify, Meta, Shopify e notificações SOLID na tabela existente `IntegrationDeliveryJob`, dentro da transação do pagamento. A resposta ao comprador não aguarda essas entregas. A API líder processa a fila a cada 30 segundos, com recuperação de trabalhos interrompidos, até oito tentativas e intervalo crescente em falhas. O atraso pode aumentar com o volume ou a indisponibilidade de integrações. Eventos UTMify obsoletos são descartados para evitar regressão do estado do pedido; o identificador único por sessão, provedor e evento evita enfileiramento duplicado. A entrega externa continua sujeita a repetição se o processo cair depois do envio e antes de registrar o sucesso.

A consulta pública de pagamento lê somente o banco. Webhooks verificados e os reconciliadores WestPay/Roas atualizam o status; por isso a API deve manter a eleição de líder e esses trabalhos ativos. No navegador, a consulta seguinte começa cinco segundos após a anterior terminar, pausa em abas ocultas e encerra quando o pagamento deixa de estar pendente.

O gráfico de vendas agrupa cada pagamento uma vez por dia no fuso de São Paulo. As métricas de cupons descontam `paymentDiscountCents` do desconto total, sem atribuir o desconto Pix ao cupom. Estas otimizações reutilizam o schema existente e não acrescentam migrations.
