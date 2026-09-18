# Assistente Pirat

Chat de ajuda no painel autenticado. O cliente usa `GET /assistant/status` e `POST /assistant/messages`; a API chama o Gemini com uma base de ajuda revisada em `apps/api/src/pirat-assistant.ts`. Não há consulta de dados de contas/pedidos, ferramentas de alteração, voz ou acesso ao checkout público. Acesso de suporte por impersonação não recebe o assistente.

## Ativação

1. Crie uma chave no [Google AI Studio](https://aistudio.google.com/api-keys), vinculada ao projeto correto. A assinatura do aplicativo Gemini não substitui a chave da API.
2. Em Dokploy → aplicação **SOLID API** → Environment, adicione `GEMINI_API_KEY` com o segredo. Não coloque a chave no Git, no chat, nos argumentos de build ou em variáveis `VITE_`. Preserve as outras variáveis existentes.
3. Opcionalmente configure `GEMINI_MODEL`. Padrão: `gemini-3.1-flash-lite`. O modelo escolhido precisa suportar GenerateContent e saída JSON estruturada. Configure cotas do projeto no provedor conforme o uso esperado.
4. Publique API e web, valide a saúde da API e faça uma pergunta não sensível no painel autenticado. Verifique resposta, continuidade e troca de expressão. A presença da chave indica configuração, não comprova a validade do acesso; falhas do provedor aparecem no chat sem expor detalhes internos.
5. Para desativar respostas, remova `GEMINI_API_KEY` e publique novamente a API. Sem a chave, o chat apresenta indisponibilidade de configuração e não simula respostas.

Documentação de referência: [chaves](https://ai.google.dev/gemini-api/docs/api-key), [modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [GenerateContent](https://ai.google.dev/api/generate-content).

## Limites e privacidade

- Sessão existente, origem permitida e CSRF em toda pergunta. Limite de 20 solicitações por conta/hora, compartilhado entre sessões. Redis usa a conexão do rate limiter existente; sem Redis, o limite é por réplica. Erros e perguntas inválidas também consomem a janela depois de autenticadas. Falhas de conexão, timeout e HTTP 408/500/502/503/504 recebem no máximo uma nova tentativa após 500 ms, dentro da mesma solicitação. Limites do provedor, credenciais inválidas e outros erros permanentes não são repetidos; não há contorno da cota.
- Até 2.000 caracteres na pergunta, quatro pares de histórico, 14.000 caracteres no total e 1.024 tokens de saída. Timeout de 20 segundos por tentativa, até aproximadamente 40,5 segundos com recuperação. Fechar o chat cancela a solicitação e a espera de recuperação. Conteúdo truncado ou fora do contrato é rejeitado. O diagnóstico registra motivo e status HTTP do provedor, sem corpos, perguntas ou segredos.
- Só texto digitado, histórico recente e base de ajuda são enviados ao Gemini. Nenhuma leitura de pedidos, documentos, e-mails, nome do usuário ou credenciais é acrescentada. O lojista vê o aviso de envio ao Gemini antes da primeira mensagem; não deve incluir dados de clientes ou segredos.
- O painel mantém até 20 pares de mensagens em memória nesta aba. Recarregar, trocar de usuário/loja ou iniciar nova conversa limpa esse histórico. Não gravamos conversas em banco, armazenamento do navegador ou logs de requisição. O processamento/retenção no provedor segue os termos e configuração do projeto Google, não essa memória local.
- Respostas são renderizadas como texto, sem HTML executável, links automáticos ou comandos. O papagaio se identifica como IA e não confirma ações que não executou. Humor direcionado à situação; sem humilhação ao usuário.

## Mascote

`apps/web/public/brand/assistant/` contém WebPs de 320 × 320: `idle`, `greeting`, `thinking`, `replying`, `happy`, `angry`, `sad` (~190 KB no total). São poses estáticas alternadas pelo estado da conversa, não vídeos. A imagem original aparece em idle. As demais foram geradas pela ferramenta integrada de imagens em 18/09/2026, usando `apps/web/public/brand/pirat-mascot.png` como referência. Conversão mecânica para WebP com Sharp, sem redesenho programático.

Prompt comum: uma ilustração isolada com transparência, preservando papagaio vermelho, bico dourado curvo, chapéu preto de pirata com acabamento dourado e caveira marfim, tapa-olho preto e bandana vermelha; contornos limpos e sombreamento em células; retrato de busto, enquadramento quadrado, margem de segurança, chapéu e asas visíveis, ângulo três-quartos; sem disco de fundo, textos, rótulos ou personagens adicionais.

Direção de cada variante: greeting — uma asa levantada acenando; thinking — ponta da asa sob o bico fechado, cabeça ligeiramente inclinada; replying — bico aberto e asa em gesto de explicação; happy — bico sorridente, ambas as asas erguidas; angry — irritação cômica com o problema, asas cruzadas; sad — expressão solidária, asas abaixadas. Os PNGs originais gerados permanecem no diretório local de imagens do Codex.

## Verificação

`npm run test --workspace=@solid/api -- assistant.test.ts` valida autenticação, CSRF, contrato, privacidade do payload, limite por conta, erros e cancelamento com provedor simulado.

`npm run build --workspace=@solid/web` e `npx playwright test --config scripts/admin-ui.config.mjs assistant.spec.mjs` validam interface com fixtures locais: pergunta/resposta, poses, erro, cancelamento, reset, saída textual, ausência no login, contraste e responsividade. Capturas em `.visual-check/assistant-*.png`.

Esses testes não atestam disponibilidade, qualidade das respostas nem faturamento do Gemini real. O teste autenticado com a chave configurada continua necessário antes de anunciar ativação em produção.

Em 18/09/2026, a chave dedicada foi configurada no ambiente da API no Dokploy. Uma chamada real à função `generateHelp`, com `gemini-3.1-flash-lite`, retornou texto e expressão válidos sobre oferta de saída. Houve uma falha inicial do provedor antes do teste bem-sucedido; isso não comprova disponibilidade contínua. A publicação da API/web e a validação da conversa no painel autenticado continuam pendentes. Nenhuma credencial foi incluída no repositório.
