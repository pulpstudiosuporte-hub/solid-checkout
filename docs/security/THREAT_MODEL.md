# Modelo de ameaças inicial — SOLID

Data: 2026-08-13. Escopo: fundação, antes de autenticação, banco e pagamentos.

## Ativos críticos

- Credenciais e sessões dos lojistas.
- Tokens Shopify e gateway Pix.
- CPF/CNPJ, contato e endereço de compradores.
- Preços, totais, pedidos e estados de pagamento.
- Versões publicadas dos checkouts.
- Chaves de criptografia, logs e backups.

## Fronteiras de confiança

```text
Navegador do lojista -> painel -> API -> banco/Redis
Navegador do comprador -> checkout público -> API -> gateway Pix
Shopify/gateway -> endpoint de webhook -> fila -> worker -> banco
Operador/CI -> ambiente de deploy -> secret manager
```

Tudo vindo do navegador, query string, webhook ou integração externa é não confiável até autenticação, autorização e validação.

## Ameaças prioritárias e controles planejados

| Ameaça | Impacto | Controle obrigatório |
|---|---|---|
| Acesso cruzado entre lojas | Crítico | `store_id` derivado da sessão, autorização central e testes negativos |
| Alteração de preço no navegador | Crítico | cálculo integral no servidor e snapshot do pedido |
| Webhook Pix falso ou repetido | Crítico | assinatura, timestamp, idempotência persistida e reconciliação |
| Roubo de sessão | Crítico | cookie seguro, rotação, MFA, revogação e reautenticação |
| Vazamento de tokens/CPF | Crítico | criptografia, minimização, mascaramento e redação de logs |
| XSS por editor/lojista | Alto | esquema fechado de tokens, sanitização e CSP; sem JS/HTML livre |
| CSRF administrativo | Alto | cookie SameSite e token CSRF em ações mutáveis |
| SSRF por imagens/URLs | Alto | allowlist de protocolo/destino, bloqueio de redes internas e fetch controlado |
| Abuso de login/cupom/Pix | Alto | rate limit por IP, conta, loja e endpoint |
| Dependência comprometida | Alto | versões fixas, lockfile, auditoria e atualização controlada |
| Falha/duplicação de worker | Alto | jobs idempotentes, retry limitado e dead-letter queue |
| Operação sem recuperação | Alto | backups externos, restauração ensaiada e rollback |

## Decisões desta fundação

- API e worker são módulos separados, embora possam rodar na mesma infraestrutura inicialmente.
- API escuta apenas loopback por padrão.
- Erros públicos são genéricos e incluem `requestId`; detalhes ficam apenas em logs redigidos.
- CORS usa allowlist explícita e credenciais; wildcard é proibido.
- O worker não processa filas até Redis, idempotência e persistência estarem implementados.
- O frontend atual permanece protótipo JavaScript dentro do workspace. Todo código server-side novo é TypeScript estrito; a migração visual para TSX será incremental e rastreada.

## Riscos ainda abertos

- Não há autenticação, banco, autorização, CSRF nem armazenamento seguro de segredos.
- Não há proxy de produção configurado nem CSP com nonce para uma aplicação renderizada no servidor.
- `localStorage` mantém apenas configuração visual de demonstração; nunca deve guardar token ou dado pessoal.
- Health readiness ainda não verifica banco/Redis porque esses serviços não foram adicionados.

Revisar este documento a cada integração, nova categoria de dado ou mudança de fronteira de confiança.
