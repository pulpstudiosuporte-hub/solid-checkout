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
