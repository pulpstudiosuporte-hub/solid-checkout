# Conexão Meta Pixel e API de Conversões

A consulta de cadastro não comprova a permissão de enviar eventos. Sem código de teste, a conexão consulta somente `id` e exige correspondência com o Pixel informado. Erros de leitura 10, 100 e 200 não são aceitos como validação: orientam o lojista a usar Eventos de teste. Um ID inexistente também pode produzir erro 100, portanto essa resposta não significa que o token é válido.

Para validar o envio, abra o Pixel/fonte de dados no Gerenciador de Eventos da Meta, copie o código da aba **Eventos de teste**, preencha o campo opcional e clique em **Conectar Meta**. O sistema envia somente `SolidConnectionTest`, com identificador aleatório e sem dados de compradores, para `/{pixelId}/events` com `test_event_code`. Só confirma quando a Meta retorna `events_received: 1`. O código não é salvo nem aplicado às compras posteriores.

Token inválido/expirado, falta de permissão e indisponibilidade têm mensagens distintas. Falhas não substituem uma conexão existente. O token segue criptografado no banco e passa no cabeçalho de autorização, sem entrar na URL; erros externos não são copiados para logs ou respostas.

Referência: [EventRequest no SDK oficial da Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event_request.py). A consulta cadastral preserva o fluxo anterior para tokens com acesso de leitura; o teste opcional verifica o envio pela CAPI.

Verificação local: `npm run test --workspace=@solid/api -- meta-client.test.ts gateway-configuration.test.ts` e `node node_modules/@playwright/test/cli.js test --config scripts/meta-ui.config.mjs`. Os testes usam respostas simuladas; a autorização do Pixel real depende de nova tentativa com a Meta após publicar a API e o web.
