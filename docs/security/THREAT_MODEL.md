# Modelo de ameaças — SOLID

Revisão: 10/09/2026. Escopo atual: painel autenticado, múltiplas lojas, checkout público, PostgreSQL, Pix, Shopify, integrações, mídia, filas e publicação. Substitui o documento da fundação de agosto, que descrevia serviços ainda não implementados.

## Ativos e fronteiras de confiança

- Credenciais, sessões, MFA e permissões dos lojistas e administradores da plataforma.
- Tokens de integração, chave de criptografia, dados pessoais de compradores e backups.
- Preços, snapshots de pedidos, estados de pagamento, taxas e versões publicadas dos checkouts.

```text
Navegador do lojista -> proxy/CDN -> painel -> API -> PostgreSQL/Redis
Navegador do comprador -> checkout público -> API -> gateway Pix
Shopify/gateway -> webhook -> verificação oficial -> banco/fila -> processadores
Operador/CI -> imagem publicada -> proxy -> serviços e cofre de segredos
```

Entrada do navegador ou de integrações não recebe confiança por conter um identificador conhecido. Autenticação, autorização da loja, validação do conteúdo e controle de repetição são verificações separadas.

## Controles implementados e limites

| Ameaça | Controles no código | Limite operacional |
|---|---|---|
| Acesso entre lojas | Sessão, loja ativa, vínculo/role e filtros por loja; testes negativos | Auditar novas rotas e privilégios do administrador da plataforma |
| Roubo de sessão e CSRF | Tokens opacos com hash, revogação, cookies de produção Secure/HttpOnly/SameSite, origem e CSRF nas mutações; MFA disponível | MFA não é presumido obrigatório para todas as contas |
| Cadastro abusivo | Fluxo de cadastro/verificação e aprovação da conta, limites de tentativas | Monitorar filas de aprovação, entrega de e-mail e abuso |
| Manipulação de preços | Cálculo no servidor e snapshot; total conferido ao reservar pagamento | Integrações de catálogo devem manter validação de origem |
| Pix repetido ou resultado desconhecido | Reserva durável por sessão entre gateways, resposta persistida e retomada, bloqueio de fallback após resultado incerto | Sem resposta oficial não é seguro afirmar que a cobrança falhou |
| Webhook falso/repetido | Autenticação conforme integração, consulta oficial e comparação de identificador/valor, transições condicionais e entregas persistidas | Exercitar contratos de produção dos provedores |
| Crédito indevido no estorno | Crédito vinculado à taxa original, cumulativo/proporcional, bloqueio de linha e lançamentos imutáveis após faturamento | Valor parcial não confirmado exige conferência |
| Perda de trabalhos após reinício | Lease no banco, backoff, recuperação de PROCESSING e conclusão vinculada à lease | Monitorar atraso, DEAD e falhas externas; não implica entrega exatamente uma vez no provedor |
| Vazamento de dados e segredos | Criptografia de campos sensíveis, hashes, mascaramento e retenção seletiva | Cofre, controle de acesso e restauração de backups dependem da infraestrutura |
| Conteúdo malicioso e SSRF | Esquemas/validações de URLs e imagens, processamento de formatos permitidos, CSP no servidor web | Temas e serviços externos exigem testes contínuos; verificar CSP após proxy/CDN |
| Abuso e consumo de recursos | Rate limiting, quota transacional de mídia, paginação, agregação SQL e resultados limitados | Redis deve estar configurado para limites compartilhados entre réplicas |
| Dependência vulnerável | Versões fixadas, lockfile, auditoria que falha em erros, Semgrep e testes no CI | Quatro exceções transitivas do Prisma com vencimento explícito |

## Retenção e pagamentos tardios

Sessões expiradas/canceladas só são elegíveis à anonimização quando não há tentativa PAID ou REFUNDED. Abandonos usam 30/90/180 dias conforme o plano; dados de segurança/telemetria têm os prazos descritos em [segurança operacional](../production-security.md). Confirmação tardia pode concluir a sessão; dados anonimizados antes dessa confirmação não são reconstruídos automaticamente.

## Riscos e verificações pendentes em produção

1. Confirmar cabeçalhos no domínio publicado e funcionamento de login, CSP, gateway e e-mail após a atualização.
2. Revisar as exceções de dependências antes de 31/10/2026, sem ampliar a lista automaticamente.
3. Concluir a integração operacional de alertas de reconciliação, estornos em conferência e filas atrasadas.
4. Ensaiar restauração de backup e rollback coordenado, especialmente após a nova unicidade do livro de taxas.
5. Medir agregações e filas com volume real; testes locais demonstram correção funcional, não capacidade de produção.

O [registro de correções](REMEDIACAO-2026-09-10.md) contém evidências e limites da validação. Revisar este modelo a cada nova integração, categoria de dado ou mudança de fronteira de confiança.
