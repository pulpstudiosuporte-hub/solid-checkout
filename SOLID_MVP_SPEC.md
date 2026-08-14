# SOLID — Especificação Técnica do MVP

> Documento de implementação para IDE/agente de código. Leia integralmente antes de escrever código.

## 1. Visão do produto

O **Solid** é uma plataforma SaaS de checkout para produtos importados da Shopify, com pagamento exclusivamente via Pix. O lojista conecta sua Shopify, importa produtos, personaliza o checkout, adiciona order bumps, conecta um gateway Pix e configura pixels de marketing.

Fluxo principal:

```text
Shopify → Produto no Solid → Checkout personalizado → Order bump → Pix → Webhook → Pedido pago → Pixels
```

O MVP deve ser confiável, rápido, responsivo, multiempresa e seguro. A prioridade é processar corretamente o ciclo do pedido, e não reproduzir todas as funcionalidades das referências visuais.

## 2. Objetivo do MVP

Permitir que um lojista:

1. Crie sua conta e sua loja no Solid.
2. Conecte uma loja Shopify.
3. Importe e sincronize produtos e variantes.
4. Edite as informações comerciais usadas apenas no checkout Solid.
5. Crie e publique um checkout personalizado.
6. Configure order bumps.
7. Conecte um gateway de pagamento Pix.
8. Configure Meta Pixel, GA4, Google Ads e TikTok Pixel.
9. Receba pedidos e acompanhe pagamentos.
10. Use um domínio padrão do Solid e, posteriormente, um domínio personalizado.

## 3. Fora do escopo

Não implementar no MVP:

- Cartão de crédito ou débito.
- Boleto.
- Parcelamento.
- Dados, tokenização ou antifraude de cartão.
- Upsell one-click com cobrança automática.
- Assinaturas e recorrência.
- Marketplace de gateways.
- Roteamento entre múltiplos gateways.
- Brindes, kits e faixas de desconto.
- Automações de WhatsApp ou e-mail.
- Page builder com HTML, CSS ou JavaScript livre.
- API pública para terceiros.
- Aplicativo mobile nativo.
- Mapas geográficos e live view em tempo real.

Um upsell pós-compra poderá existir no futuro, mas deverá gerar uma nova cobrança Pix independente.

## 4. Princípios de implementação

- Começar como **monólito modular**, não como microserviços.
- Separar painel administrativo, checkout público, API e worker no código.
- Toda entidade de negócio deve pertencer a uma loja por `store_id`.
- Nunca confiar em preço, total, produto ou status enviados pelo navegador.
- Todo total deve ser calculado novamente no servidor.
- Pagamento só é confirmado por consulta autenticada ou webhook válido do gateway.
- Todo processamento de pagamento e webhook deve ser idempotente.
- Não permitir scripts personalizados inseridos pelo lojista.
- Não copiar marca, textos, logo ou assets da plataforma usada como referência.

## 5. Stack sugerida

### Aplicação

- TypeScript em modo estrito.
- Frontend: Next.js com App Router.
- Interface: React, Tailwind CSS e componentes acessíveis.
- Backend: NestJS ou módulos server-side separados em uma API Node.js.
- Banco: PostgreSQL.
- ORM: Prisma.
- Filas: Redis + BullMQ.
- Validação: Zod no frontend e backend ou DTOs equivalentes.
- Testes: Vitest/Jest e Playwright.

### Infraestrutura

- Docker Compose para o MVP.
- Caddy ou Nginx como proxy reverso.
- PostgreSQL gerenciado em produção.
- Redis gerenciado, quando possível.
- Storage compatível com S3 para imagens e logos.
- Cloudflare na frente dos domínios públicos.
- Serviço de monitoramento de erros e disponibilidade.

## 6. Arquitetura lógica

```text
apps/
  web/                 Painel administrativo
  checkout/            Checkout público otimizado
  api/                 API e regras de negócio
  worker/              Filas, webhooks, sincronizações e pixels server-side

packages/
  database/            Schema, migrations e client do banco
  ui/                  Design system compartilhado
  auth/                Autenticação, sessão e permissões
  shopify/             Cliente GraphQL, OAuth e webhooks
  payments/            Contrato e adaptadores de gateway Pix
  tracking/            Pixels e deduplicação
  validation/          Schemas compartilhados
  observability/       Logs, métricas e erros
```

Pode ser utilizado um único repositório com Turborepo. Os módulos podem ser executados no mesmo servidor no início, mas não devem ficar acoplados por importações circulares.

## 7. Multiempresa

O sistema é multi-tenant:

- `User` representa a pessoa autenticada.
- `Store` representa a operação/loja.
- `StoreMember` liga usuário, loja e papel.
- Todas as consultas devem filtrar pelo `store_id` autorizado da sessão.
- Nunca aceitar `store_id` arbitrário sem validar a associação do usuário.

Papéis iniciais:

- `OWNER`: acesso total e configurações sensíveis.
- `ADMIN`: operação completa, sem excluir a loja.
- `ANALYST`: somente leitura de métricas e pedidos.

## 8. Navegação do painel

### Início

- Visão geral.
- Receita confirmada.
- Pedidos pagos.
- Pedidos pendentes.
- Ticket médio.
- Conversão do checkout.
- Carrinhos abandonados.
- Gráfico de receita e pedidos.
- Lista de pedidos recentes.

### Pedidos

- Todos os pedidos.
- Carrinhos abandonados.
- Clientes.

### Produtos

- Produtos.
- Sincronização Shopify.

### Checkouts

- Lista de checkouts.
- Editor.
- Domínios.

### Marketing

- Order bumps.
- Cupons.
- Pixels.

### Integrações

- Shopify.
- Gateway Pix.

### Configurações

- Loja.
- Equipe.
- Segurança.
- Logs de auditoria.

## 9. Autenticação e onboarding

### Cadastro

Campos:

- Nome.
- E-mail.
- Senha.
- Aceite dos termos e política de privacidade.

Requisitos:

- Verificação de e-mail.
- Recuperação de senha com token de uso único e curta duração.
- Sessão revogável.
- MFA obrigatório para `OWNER` antes de conectar um gateway em produção.
- Limite de tentativas de login.

### Onboarding

1. Criar loja Solid.
2. Informar nome e slug.
3. Conectar Shopify ou começar com produto manual.
4. Conectar gateway Pix.
5. Criar o primeiro checkout.
6. Realizar transação de teste.
7. Publicar.

Exibir checklist de progresso no painel.

## 10. Integração Shopify

Usar a **GraphQL Admin API** e OAuth. Não construir nova integração usando a REST Admin API.

### Permissões mínimas

Solicitar somente as permissões estritamente necessárias para:

- Ler produtos.
- Ler variantes.
- Ler estoque, somente se o MVP sincronizar estoque.

Não solicitar pedidos, clientes ou escrita de produtos sem necessidade real.

### Importação inicial

- O usuário conecta a Shopify por OAuth.
- O backend armazena o token criptografado.
- O usuário escolhe importar todos ou selecionar produtos.
- A importação roda em fila e possui progresso.
- Importar título, descrição, imagens, variantes, SKU, preço e estoque disponível.
- Usar paginação por cursor.
- Respeitar rate limits e realizar retry com backoff.

### Fonte dos dados

- Shopify é a origem do catálogo.
- Solid mantém uma cópia local para velocidade e resiliência.
- Campos `source_*` preservam o valor recebido da Shopify.
- Campos `checkout_*` permitem override usado somente no Solid.
- Alterações feitas no Solid não voltam à Shopify no MVP.

Exemplo:

```text
source_title: Camiseta Essential
checkout_title: Camiseta Essential — Edição Limitada
```

### Webhooks Shopify

Assinar, quando aplicável:

- Produto criado.
- Produto atualizado.
- Produto excluído.
- Estoque atualizado.
- App desinstalado.
- Webhooks obrigatórios de privacidade/compliance, conforme o tipo de app.

Requisitos:

- Validar assinatura HMAC no corpo bruto.
- Registrar o identificador do evento.
- Responder rapidamente.
- Colocar o processamento em fila.
- Ignorar com segurança eventos repetidos.
- Revogar/desativar a conexão ao receber desinstalação.

## 11. Produtos

### Lista

- Busca por nome ou SKU.
- Filtro por ativo/inativo.
- Filtro por importado/manual.
- Imagem, nome, preço, estoque, variantes e status.
- Paginação server-side.
- Ações: editar, ativar/desativar e abrir checkout.

### Edição

Campos editáveis no Solid:

- Título do checkout.
- Descrição do checkout.
- Imagens.
- Preço de exibição.
- Preço promocional.
- Limite por pedido.
- Status.
- Controle de estoque no checkout.
- SEO básico do checkout.

Regras:

- Valores monetários armazenados como inteiro em centavos.
- Nunca usar ponto flutuante para dinheiro.
- Preço promocional deve ser menor que o preço original.
- Produto inativo não pode iniciar um novo checkout.
- Alterações não podem modificar snapshots de pedidos antigos.

## 12. Checkouts

Uma loja pode possuir vários checkouts. Cada checkout possui slug, produto principal, tema, configurações, status e versão publicada.

Estados:

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

### Editor visual

Layout em três áreas:

1. Menu de configurações à esquerda.
2. Preview responsivo no centro.
3. Barra superior com histórico, visualizar, salvar e publicar.

Modos de preview:

- Mobile.
- Tablet.
- Desktop.

### Personalizações permitidas

- Template base.
- Logo.
- Favicon.
- Cor principal.
- Fundo da página.
- Fundo, borda e texto dos cards.
- Fundo, borda, texto e placeholder dos inputs.
- Tipografia escolhida de uma lista segura.
- Tamanho de borda e arredondamento.
- Cabeçalho.
- Selos de segurança.
- Cronômetro opcional.
- Textos auxiliares.
- Campos obrigatórios.
- Cupom.
- Resumo do pedido.
- Order bump.
- Rodapé e políticas.
- URL de redirecionamento após aprovação.

### Restrições do editor

- Sem HTML livre.
- Sem JavaScript livre.
- Sem upload de SVG não sanitizado.
- Sem URLs `javascript:` ou protocolos perigosos.
- Sanitizar textos formatados.
- Aplicar limite de tamanho e tipo em imagens.
- Gerar CSS a partir de tokens validados.

### Rascunho e publicação

- Autosave com debounce.
- Rascunho separado da versão publicada.
- Botão `Publicar` cria uma versão imutável.
- Possibilidade de reverter para uma versão anterior.
- Checkout público sempre lê a versão publicada.

### Performance do checkout

- Mobile-first.
- Evitar bibliotecas pesadas.
- Imagens otimizadas.
- Carregamento de pixels após consentimento, quando exigido.
- Evitar layout shift.
- Meta de LCP inferior a 2,5 segundos em conexão móvel adequada.

## 13. Campos do comprador

Campos iniciais:

- Nome completo.
- E-mail.
- CPF ou CNPJ.
- Celular/WhatsApp.
- CEP.
- Endereço.
- Número.
- Complemento.
- Bairro.
- Cidade.
- Estado.

Endereço pode ser desabilitado para produto digital.

Requisitos:

- Máscaras são apenas auxiliares; validar novamente no servidor.
- Normalizar telefone, e-mail e documento.
- Não expor CPF completo em logs.
- Política de retenção e exclusão de dados conforme LGPD.

## 14. Carrinho e cálculo de total

O cliente pode escolher:

- Variante.
- Quantidade, dentro do limite.
- Cupom.
- Order bump.

O servidor calcula:

```text
subtotal dos itens
+ subtotal dos bumps
- desconto válido
+ frete, se existir
= total do pedido
```

Antes de criar o pagamento:

- Recarregar preços no servidor.
- Validar status do checkout e produto.
- Validar variante e estoque.
- Validar cupom.
- Validar bump e regras de elegibilidade.
- Criar snapshot de nomes, preços e imagens.

## 15. Order bump

### Administração

- Nome interno.
- Produto e variante oferecidos.
- Título comercial.
- Descrição.
- Imagem.
- Preço exclusivo.
- Limite por pedido.
- Status.
- Prioridade.
- Checkouts elegíveis.
- Produtos principais elegíveis.
- Data inicial e final opcionais.

### Checkout

- Checkbox ou card selecionável.
- Total atualizado visualmente.
- Inclusão confirmada no servidor.
- Nunca confiar no preço enviado pelo cliente.

### Métricas

- Visualizações.
- Aceites.
- Pedidos pagos com bump.
- Receita confirmada do bump.
- Taxa de aceite.

## 16. Cupons

Implementação básica:

- Código único por loja, case-insensitive.
- Desconto fixo ou percentual.
- Valor mínimo.
- Limite total de usos.
- Limite por comprador.
- Data inicial e final.
- Produtos/checkouts elegíveis.
- Ativo/inativo.

O uso só é contabilizado definitivamente quando o pedido for pago. Reservas temporárias precisam expirar junto ao Pix.

## 17. Gateway Pix

O provedor será escolhido depois. Criar uma camada de adaptação para evitar acoplamento.

### Contrato interno

```ts
interface PixGateway {
  createCharge(input: CreatePixChargeInput): Promise<PixChargeResult>;
  getCharge(externalId: string): Promise<PixChargeStatus>;
  refundCharge(input: RefundPixInput): Promise<RefundResult>;
  validateWebhook(input: RawWebhookInput): Promise<ValidatedWebhook>;
}
```

### Criação da cobrança

Entrada mínima:

- ID idempotente do pedido.
- Valor em centavos.
- Nome, e-mail e documento do pagador.
- Tempo de expiração.
- URL de webhook.
- Metadados internos sem informações sensíveis desnecessárias.

Saída normalizada:

- ID externo.
- Status.
- QR Code.
- Pix Copia e Cola.
- Data de expiração.
- Payload bruto redigido para auditoria, sem secrets.

### Tela Pix

- Valor.
- QR Code.
- Código Copia e Cola.
- Botão copiar.
- Contagem regressiva baseada no horário do servidor.
- Status “aguardando pagamento”.
- Atualização por polling controlado ou SSE.
- Sucesso após confirmação do backend.
- Estado expirado com botão para gerar nova cobrança, se permitido.

### Webhook do gateway

Fluxo obrigatório:

1. Receber corpo bruto.
2. Validar assinatura e timestamp.
3. Verificar allowlist de IP apenas como camada adicional, nunca como única validação.
4. Calcular chave de idempotência.
5. Persistir recebimento.
6. Responder `2xx` rapidamente.
7. Processar em fila.
8. Localizar cobrança e pedido.
9. Validar valor, moeda e identificadores.
10. Aplicar transição válida de status.
11. Criar evento de pedido.
12. Disparar efeitos posteriores uma única vez.

Nunca marcar um pedido como pago somente porque o frontend informou sucesso.

### Status normalizados

Cobrança:

- `CREATED`
- `PENDING`
- `PAID`
- `EXPIRED`
- `CANCELED`
- `REFUNDED`
- `FAILED`

Pedido:

- `DRAFT`
- `AWAITING_PIX`
- `PAID`
- `EXPIRED`
- `CANCELED`
- `REFUNDED`

Transições devem ser explícitas. Um pedido pago não volta para pendente.

## 18. Pedidos

### Lista

- Busca por ID, nome, e-mail ou documento mascarado.
- Filtros por status, período, produto, checkout e gateway.
- Colunas: pedido, cliente, data, itens, total, status e pagamento.
- Paginação server-side.
- Exportação CSV protegida por permissão e auditoria.

### Detalhe

- Dados do comprador.
- Itens e snapshots.
- Totais.
- Cupom.
- UTMs.
- Checkout de origem.
- Cobranças Pix.
- Linha do tempo de eventos.
- Webhooks relacionados.
- Reembolso, caso suportado.
- Notas internas.

### Identificador

- Usar UUID/ULID internamente.
- Exibir um código curto não sequencial ao usuário.
- Não permitir enumeração simples de pedidos.

## 19. Carrinho abandonado

Criar um checkout session quando houver dados mínimos úteis ou avanço relevante no formulário.

Armazenar:

- Checkout.
- Itens.
- E-mail/telefone quando informados.
- Etapa alcançada.
- UTMs.
- Última atividade.
- Status de conversão.

Não implementar automação de recuperação no MVP. Apenas listar e medir.

## 20. Clientes

Visão agregada por loja:

- Nome.
- E-mail.
- Telefone.
- Documento mascarado.
- Quantidade de pedidos.
- Pedidos pagos.
- Total pago.
- Último pedido.

Não misturar clientes entre lojas. Definir estratégia de deduplicação por e-mail normalizado e/ou documento, considerando regras de privacidade.

## 21. Pixels e tracking

### Integrações iniciais

- Meta Pixel + Conversions API.
- Google Analytics 4.
- Google Ads.
- TikTok Pixel + Events API, se disponível no provedor escolhido.

### Eventos

- `PageView`
- `ViewContent`
- `InitiateCheckout`
- `AddPaymentInfo` ao gerar o Pix
- `Purchase` somente após confirmação de pagamento

### Regras

- Gerar um `event_id` único e estável.
- Usar o mesmo `event_id` no browser e servidor para deduplicação.
- `Purchase` server-side nasce do evento de pagamento confirmado.
- Registrar tentativas, status e resposta redigida.
- Retentar eventos server-side com backoff.
- Não impedir a confirmação do pedido por falha de pixel.
- Respeitar consentimento e configuração de privacidade.
- Nunca permitir JavaScript arbitrário do lojista.

### UTMs

Capturar e salvar:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `fbclid`
- `gclid`
- `ttclid`

Associar à sessão, ao pedido e ao pagamento confirmado.

## 22. Domínios

### MVP inicial

Checkout padrão:

```text
https://pay.solid.com.br/{storeSlug}/{checkoutSlug}
```

### Domínio personalizado

Pode entrar no fim do MVP ou na fase seguinte:

- Lojista informa `pay.sualoja.com`.
- Sistema mostra registro CNAME necessário.
- Verifica DNS.
- Provisiona SSL.
- Confirma domínio antes de ativar.
- Impede domínio duplicado.
- Mantém log de alterações.

Não aceitar domínio raiz no primeiro momento; preferir subdomínio.

## 23. Modelo de dados inicial

Entidades principais:

```text
User
Session
Store
StoreMember
ShopifyConnection
ShopifyWebhookReceipt
Product
ProductVariant
ProductImage
InventorySnapshot
Checkout
CheckoutDraft
CheckoutVersion
CheckoutDomain
OrderBump
OrderBumpEligibility
Coupon
CheckoutSession
Customer
Order
OrderItem
OrderDiscount
Payment
PaymentEvent
GatewayConnection
WebhookReceipt
PixelConnection
TrackingEvent
AuditLog
```

Campos comuns:

- `id`
- `store_id`, quando aplicável
- `created_at`
- `updated_at`
- `deleted_at`, quando soft delete for adequado
- `version`, quando houver concorrência otimista

### Regras importantes

- IDs externos devem ter índice único dentro da conexão/loja.
- `WebhookReceipt` deve possuir chave idempotente única.
- `Payment` deve possuir `gateway + external_id` único.
- `OrderItem` deve guardar snapshot, não depender do produto atual.
- Dinheiro sempre em centavos e moeda explícita `BRL`.
- Datas no banco em UTC; exibir no fuso da loja.
- Dados sensíveis devem ser minimizados e criptografados quando necessário.

## 24. Endpoints sugeridos

Todos os endpoints administrativos ficam sob `/api/v1` e exigem sessão, loja e autorização.

```text
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /stores
POST   /stores
PATCH  /stores/:storeId

GET    /integrations/shopify/connect
GET    /integrations/shopify/callback
POST   /integrations/shopify/import
GET    /integrations/shopify/imports/:jobId
POST   /webhooks/shopify

GET    /products
GET    /products/:id
PATCH  /products/:id
POST   /products/:id/sync

GET    /checkouts
POST   /checkouts
GET    /checkouts/:id
PATCH  /checkouts/:id/draft
POST   /checkouts/:id/publish
GET    /checkouts/:id/versions
POST   /checkouts/:id/restore/:versionId

GET    /order-bumps
POST   /order-bumps
PATCH  /order-bumps/:id

GET    /coupons
POST   /coupons
PATCH  /coupons/:id

GET    /orders
GET    /orders/:id
POST   /orders/:id/refund

GET    /pixels
POST   /pixels
PATCH  /pixels/:id

POST   /gateway/connect
POST   /gateway/test
POST   /webhooks/gateway/:provider
```

Endpoints públicos do checkout:

```text
GET    /public/checkouts/:storeSlug/:checkoutSlug
POST   /public/checkout-sessions
PATCH  /public/checkout-sessions/:token
POST   /public/coupons/validate
POST   /public/orders
POST   /public/orders/:publicToken/pix
GET    /public/orders/:publicToken/status
```

Usar token público aleatório e de escopo limitado; não expor IDs internos.

## 25. Dashboard e métricas

Filtros:

- Hoje.
- Ontem.
- Últimos 7 dias.
- Mês atual.
- Intervalo personalizado.

Definições:

- Receita confirmada: soma de pedidos `PAID`, descontados reembolsos conforme regra definida.
- Pedidos pagos: quantidade de pedidos `PAID`.
- Ticket médio: receita confirmada / pedidos pagos.
- Conversão: sessões únicas elegíveis que viraram pedido pago.
- Carrinho abandonado: sessão com dados/atividade relevante que não virou pedido dentro da janela definida.

Não misturar pedido criado com venda confirmada. Mostrar claramente a definição de cada métrica.

## 26. Design e experiência

Direção baseada nas referências enviadas:

- Interface clara e operacional.
- Sidebar fixa no desktop.
- Cards brancos com bordas discretas.
- Fundo cinza muito claro.
- Tabelas densas, mas legíveis.
- Cor primária configurável da marca Solid; usar token temporário enquanto a identidade final não estiver definida.
- Feedback visível de loading, vazio, erro e sucesso.
- Componentes responsivos e acessíveis por teclado.

Não reproduzir pixel a pixel a interface, nomes, logo, ilustrações ou textos da referência. Criar identidade própria para o Solid.

### Design tokens iniciais

```css
--background: #f7f7f8;
--surface: #ffffff;
--text-primary: #151515;
--text-secondary: #6b6b76;
--border: #e5e5e8;
--success: #16a465;
--warning: #d98a12;
--danger: #d83b3b;
--primary: #6d45e5; /* provisório */
--radius-card: 12px;
--radius-input: 10px;
```

## 27. Segurança obrigatória

### Aplicação

- Autorização server-side em toda ação.
- MFA para operações sensíveis.
- Senhas com Argon2id.
- Cookies `HttpOnly`, `Secure` e `SameSite` adequado.
- Proteção CSRF.
- Content Security Policy restritiva.
- HSTS e headers de segurança.
- Rate limit por IP, conta, loja e endpoint.
- CAPTCHA adaptativo em fluxos abusados.
- Validação e normalização de toda entrada.
- Sanitização de rich text.
- Queries parametrizadas via ORM.
- Proteção contra SSRF ao buscar URLs externas.
- Limite de upload, MIME real e processamento seguro de imagens.
- Auditoria de login, gateway, domínio, publicação e exportação.

### Secrets

- Nunca commitar `.env`.
- Nunca colocar secret em imagem Docker ou bundle frontend.
- Usar secret manager ou Docker secrets.
- Criptografar tokens Shopify e gateway em repouso.
- Separar chaves de desenvolvimento, homologação e produção.
- Definir rotação e revogação.
- Redigir secrets, CPF, tokens e payload Pix nos logs.

### Webhooks

- Corpo bruto preservado para verificação.
- Assinatura validada com comparação constante.
- Tolerância limitada de timestamp, quando disponível.
- Idempotência persistida no banco.
- Payload e valor reconciliados.
- Processamento assíncrono.
- Dead-letter queue.
- Reprocessamento manual auditado.

### LGPD

- Consentimento e finalidade claros.
- Minimização de dados.
- Retenção configurada.
- Exportação e exclusão quando aplicável.
- Controle de acesso.
- Registro de incidentes.
- Contratos e políticas devem ser revisados por profissional jurídico.

## 28. Hospedagem segura em VPS

Não hospedar banco, backups e arquivos importantes somente na mesma VPS da aplicação.

### Topologia recomendada

```text
Internet
  ↓
Cloudflare: DNS, CDN, WAF, DDoS e rate limit
  ↓
VPS privada: proxy + web + API + worker
  ├── PostgreSQL gerenciado
  ├── Redis gerenciado
  ├── Storage S3
  └── Monitoramento externo
```

### VPS inicial

- Ubuntu LTS.
- 4 vCPU.
- 8 GB RAM.
- SSD/NVMe.
- Região próxima ao público brasileiro.
- Docker e Docker Compose atualizados.

### Hardening

- Criar usuário sem root.
- SSH somente por chave.
- Desabilitar login por senha e root remoto.
- Restringir SSH por IP ou VPN.
- Firewall permitindo apenas o necessário.
- Aplicação exposta somente pelo proxy em `443`.
- Banco e Redis sem porta pública.
- Atualizações automáticas de segurança.
- Fail2ban ou controle equivalente.
- Containers sem `privileged`.
- Filesystem read-only nos containers quando possível.
- Remover capabilities desnecessárias.
- Health checks e limites de CPU/memória.
- Não montar o socket Docker em aplicações públicas.
- Cloudflare SSL/TLS `Full (strict)`.
- Origin certificate e bloqueio do acesso direto ao origin quando viável.

### Backup

- Backup diário do PostgreSQL.
- Point-in-time recovery, se disponível.
- Cópia criptografada fora do servidor principal.
- Retenção diária, semanal e mensal definida.
- Teste de restauração periódico.
- Backup de configurações, não apenas do banco.

### Deploy

- Pipeline CI/CD.
- Build de imagem imutável.
- Scan de dependências e container.
- Migrations como etapa controlada.
- Deploy com health check.
- Rollback para a imagem anterior.
- Nunca executar `prisma migrate dev` em produção.
- Ambientes separados: development, staging e production.

## 29. Observabilidade

- Logs JSON estruturados.
- `request_id`, `store_id`, `order_id` e `payment_id` quando aplicável.
- Nunca registrar secrets ou dados pessoais completos.
- Monitorar erros, latência e taxa de falhas.
- Alertas para:
  - indisponibilidade;
  - fila parada;
  - webhook falhando;
  - divergência de pagamento;
  - disco/CPU/memória;
  - backup falho;
  - aumento anormal de erros no checkout.
- Endpoint de health separado para web, API, banco, Redis e worker.

## 30. Testes obrigatórios

### Unitários

- Cálculo de total.
- Cupom.
- Elegibilidade do bump.
- Transições de status.
- Normalização do gateway.
- Validação de assinatura.

### Integração

- Importação Shopify paginada.
- Webhook Shopify repetido.
- Criação de cobrança Pix.
- Webhook Pix válido, inválido e duplicado.
- Pagamento com valor divergente.
- Expiração do Pix.
- Reembolso.
- Isolamento entre lojas.

### End-to-end

1. Criar loja.
2. Importar produto.
3. Criar checkout.
4. Adicionar bump.
5. Publicar.
6. Preencher checkout público.
7. Gerar Pix em sandbox.
8. Simular webhook pago.
9. Confirmar pedido uma única vez.
10. Confirmar evento `Purchase` uma única vez.

Também testar mobile, navegação por teclado e estados vazios/erro.

## 31. Critérios de aceite do MVP

O MVP está pronto somente quando:

- [ ] Um usuário consegue criar conta, verificar e-mail e criar loja.
- [ ] A loja conecta a Shopify via OAuth.
- [ ] Produtos e variantes são importados sem duplicidade.
- [ ] Webhooks atualizam a cópia local.
- [ ] O lojista edita overrides comerciais.
- [ ] Um checkout pode ser criado, editado, visualizado e publicado.
- [ ] O checkout funciona bem no mobile.
- [ ] Um order bump altera o total corretamente.
- [ ] O servidor recalcula e valida todos os valores.
- [ ] Uma cobrança Pix é gerada no gateway sandbox.
- [ ] QR Code e Copia e Cola são exibidos.
- [ ] Webhook válido confirma o pedido.
- [ ] Webhook repetido não duplica pedido, receita, estoque ou pixel.
- [ ] Webhook inválido é rejeitado e auditado.
- [ ] Pedidos e clientes ficam isolados por loja.
- [ ] Meta Pixel e evento server-side usam deduplicação.
- [ ] Existe dashboard com métricas definidas.
- [ ] Logs não expõem secrets ou CPF completo.
- [ ] Backups e restauração foram testados.
- [ ] Staging e produção estão separados.
- [ ] O sistema passou por revisão de segurança antes de transações reais.

## 32. Ordem de desenvolvimento

### Sprint 0 — Fundação

- Monorepo, lint, testes e CI.
- Banco e migrations.
- Autenticação, lojas e permissões.
- Design system.
- Logs e ambientes.

### Sprint 1 — Catálogo

- OAuth Shopify.
- Importação GraphQL.
- Webhooks.
- Lista e edição de produtos.

### Sprint 2 — Checkout

- CRUD de checkout.
- Editor por tokens.
- Rascunho, preview e publicação.
- Checkout público responsivo.

### Sprint 3 — Conversão

- Sessão de checkout.
- Carrinho.
- Cupom.
- Order bump.
- Cálculo server-side.

### Sprint 4 — Pix e pedidos

- Adapter do gateway.
- Sandbox.
- QR Code e Copia e Cola.
- Webhooks idempotentes.
- Pedidos, clientes e linha do tempo.

### Sprint 5 — Tracking e operação

- Pixels.
- Eventos server-side.
- UTMs.
- Dashboard.
- Exportação.

### Sprint 6 — Produção

- Domínio.
- Hardening.
- Backups.
- Monitoramento.
- Testes de carga e segurança.
- Piloto com poucas lojas.

## 33. Instruções para o agente do IDE

1. Não construir todas as telas de uma vez.
2. Antes de cada sprint, apresentar plano, migrations e contratos afetados.
3. Implementar verticalmente: banco, regra, API, UI e teste.
4. Não usar mocks silenciosos em fluxos que parecem funcionar.
5. Marcar claramente integrações que ainda usam sandbox/fake provider.
6. Não inventar endpoints do gateway ou da Shopify; consultar a documentação oficial da versão usada.
7. Não expor secrets no client.
8. Não adicionar cartão ou boleto.
9. Não confirmar pagamento pelo frontend.
10. Não executar alterações destrutivas no banco sem migration e backup.
11. Manter um `README.md` com setup local, variáveis e comandos.
12. Manter `.env.example` apenas com nomes e valores fictícios.
13. Atualizar este documento quando uma decisão arquitetural mudar.

## 34. Decisões pendentes

Antes de implementar a integração real, definir:

- Gateway Pix inicial e documentação oficial.
- Nome de domínio principal do Solid.
- Identidade visual e cor primária definitiva.
- Produto físico, digital ou ambos.
- Necessidade de frete no MVP.
- Modelo de cobrança do SaaS.
- Se o app Shopify será customizado, distribuído ou listado.
- Política de sincronização de estoque.
- Prazo de expiração padrão do Pix.
- Política de reembolso.
- Regras e textos jurídicos revisados.

Até essas decisões serem tomadas, usar interfaces e providers de sandbox, sem simular produção.

---

**Resumo obrigatório:** Solid é um checkout SaaS multiempresa, integrado à Shopify, com editor visual controlado, order bump, pixels e pagamento exclusivamente via Pix. Segurança, idempotência, isolamento por loja e cálculo server-side são requisitos do produto, não melhorias opcionais.
