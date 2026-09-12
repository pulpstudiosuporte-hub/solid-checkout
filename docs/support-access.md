# Suporte e perfis da plataforma

## Uso

Em **Administração → Usuários**, busque um cliente ativo e escolha **Acessar suporte**. Informe motivo (10–240 caracteres), sua própria senha e o código TOTP, quando habilitado. Escolha consulta ou manutenção, conforme as permissões do seu perfil.

O aviso superior identifica o cliente, operador, modalidade e horário limite. **Encerrar suporte** revoga o acesso e volta à administração. A sessão administrativa original permanece no navegador. O acesso é limitado a 30 minutos e a três sessões simultâneas por sessão administrativa. Contas bloqueadas e membros da administração não podem ser alvos de suporte.

Consulta permite ver as áreas de operação e alternar entre lojas às quais o cliente tem acesso. Manutenção também permite criar/excluir produtos manuais, criar/editar/publicar/excluir checkouts, enviar imagens, editar fretes, cupons e desconto Pix. As permissões de membro da loja continuam valendo. Alterações em senha, MFA, sessões, dados cadastrais, membros, cobrança, gateways, domínios e destinos de webhooks ficam bloqueadas nos dois modos. Publicações continuam sujeitas às validações existentes da loja.

Em **Equipe e permissões**, o administrador principal cria, edita e exclui perfis, busca contas já cadastradas e atribui membros. Perfis com membros não podem ser excluídos. A migração inclui **Equipe técnica** (consulta, manutenção e consulta das operações) e **Compliance** (consulta e auditoria); não atribui usuários automaticamente. Somente `platformAdmin` pode administrar perfis e atribuições. Perfis personalizados nunca concedem `roles.manage`.

O **Histórico de acessos** mostra operador, cliente, motivo de abertura, leituras e alterações solicitadas, resultado HTTP e mudanças nos perfis. O identificador da requisição relaciona a auditoria de suporte aos registros operacionais existentes. O encerramento explícito gera um evento; expiração por tempo e revogação da sessão principal invalidam o acesso sem criar um evento artificial de encerramento.

## Implementação

A sessão de suporte é uma sessão filha de `Session`, vinculada à sessão administrativa, contendo usuário alvo, motivo, modalidade e vencimento absoluto. Apenas o hash SHA-256 do token aleatório fica no banco. O token bruto permanece no `sessionStorage` da aba e acompanha as requisições no cabeçalho `x-solid-support-session`. Nunca substitui o cookie HttpOnly principal. A entrada e a saída recarregam a aplicação para eliminar estados e dados da identidade anterior. Duplicar uma aba pode copiar seu `sessionStorage`; ambas ainda exigem a mesma sessão principal, e a revogação da concessão vale para ambas.

O hook central valida a sessão principal e sua associação à sessão filha, o contexto do cliente e a lista explícita de método/rota. Rotas novas não ganham acesso automaticamente. Gravações exigem origem permitida e CSRF da sessão principal. O token filho usado como cookie é recusado. Cada resolução consulta as permissões atuais e o estado do operador e do cliente. Edição de perfil/atribuição revoga concessões anteriores; logout, expiração ou bloqueio da sessão principal também invalidam o suporte.

A auditoria registra o operador antes de liberar a requisição: falha de persistência impede o acesso. O resultado HTTP é registrado ao concluir a resposta, com erro operacional registrado se essa segunda gravação falhar. Não são armazenados corpos de requisição, senhas, códigos MFA nem tokens nos eventos de auditoria. Os registros nativos de operações continuam vinculados ao usuário alvo; use os eventos `admin.support.*` com o mesmo `requestId` para identificar o responsável real. Cookies e o cabeçalho de suporte são redigidos nos logs HTTP.

As leituras de configurações durante suporte não atualizam cadastro/onboarding. Auditoria, seleção de loja da própria sessão filha e atualização de atividade da sessão são os únicos efeitos auxiliares previstos no modo de consulta. Novidades automáticas são sincronizadas pelas sessões normais.

As fronteiras seguem os princípios de validação por requisição, negação por padrão e expiração descritos nas referências [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Deploy e validação

A migração `20260912030000_platform_support_roles` precisa ser aplicada antes de iniciar a API nova: `npm run db:deploy` no ambiente de deploy, seguido do processo habitual de publicação da API e web. Em Windows, use `npm.cmd`. Ela adiciona tabela de perfis, relação no usuário, campos da sessão, índices e restrições de integridade; não altera senhas nem promove usuários.

- `npm run check`: lint, tipos, testes, build e limites dos bundles.
- `npx playwright test --config scripts/support-ui.config.mjs`: fluxos de consulta/manutenção, retorno à administração, perfis, compliance e capturas desktop/mobile. API simulada, sem contas ou pagamentos reais.
- `npm run test:integration`, com `TEST_DATABASE_URL` apontando para um banco isolado cujo nome termina em `_test`, após as migrações: verifica a relação de sessões no PostgreSQL, revogação, permissões, vencimento e rejeição de concessões incompletas. A CI já fornece esse banco; esse teste não foi executado no ambiente local sem PostgreSQL de teste.

Depois do deploy, validar com contas de teste separadas: atribuir os dois perfis, iniciar cada modalidade, testar uma alteração permitida em manutenção e uma tentativa negada em consulta, trocar loja, encerrar suporte e verificar o histórico. Remover uma permissão durante suporte deve invalidar a próxima requisição. Confirmar também o TOTP, quando habilitado, e o comportamento de duas abas. A entrada de Novidades `auto-20260912-support-roles` está preparada para publicação pelo mecanismo existente, sem disparo em massa.
