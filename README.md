# SOLID Checkout

Fundação do checkout SaaS multiempresa SOLID. O projeto ainda está em desenvolvimento e **não processa pagamentos reais**.

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

Ainda não existem autenticação, banco, autorização multiempresa ou gateway Pix. Não use dados pessoais ou credenciais reais.
