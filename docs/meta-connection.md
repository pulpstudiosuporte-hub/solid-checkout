# Meta Pixel no checkout

Em **Integrações → Meta Pixel**, informe o ID e clique em **Salvar Pixel**. O SDK oficial é carregado automaticamente nos checkouts da loja ao abrir ou atualizar a página. O cadastro não depende de consultar metadados da Graph API nem de enviar eventos de teste.

O token é opcional. Ative **Enviar eventos também pelo servidor** para configurar a API de Conversões. Um token vazio preserva o anterior somente para o mesmo Pixel; trocar o ID exige informar o token correspondente. Desativar essa opção remove o token e interrompe novas entregas CAPI. O token permanece criptografado no servidor e nunca é retornado ao navegador.

“Pixel configurado” confirma que a configuração foi salva. Não representa uma verificação de permissões na Meta. Para compatibilidade, a API ainda aceita `testEventCode` quando explicitamente enviado; somente um teste aceito marca `verifiedAt`. Falhas nesse teste não substituem a configuração anterior.

## Eventos

- `PageView` e `ViewContent`: abertura e visualização do checkout.
- `InitiateCheckout`: início da sessão.
- `AddPaymentInfo`: Pix gerado ou retomado.
- `Purchase`: pagamento confirmado, nunca apenas pela geração do Pix.

O navegador usa `trackSingle` para direcionar cada evento ao Pixel da loja. Os três eventos de conversão usam o mesmo `eventID` do servidor e são deduplicados por Pixel e sessão. A falta de acesso ao sessionStorage não impede o checkout ou o envio. O carregamento aguarda o SDK; uma falha inicial permite nova tentativa.

As políticas CSP do HTML, Vite e nginx liberam `connect.facebook.net` para o SDK e `www.facebook.com` para envio. Publicar somente a API não corrige uma política antiga do web: é necessário publicar também o checkout/web.

## Verificação

Execute `npm run check` e `node node_modules/@playwright/test/cli.js test --config scripts/meta-ui.config.mjs`. Os testes do navegador interceptam o SDK e os eventos, sem criar conversões reais. Verificam cadastro apenas com ID, token opcional, CSP, os cinco eventos e deduplicação após recarregar.

Após publicar, abra novamente um checkout da loja e confira o Pixel Helper e o Gerenciador de Eventos. Bloqueadores do navegador podem impedir o SDK. O recebimento e as permissões do token real dependem dessa validação em produção; os testes locais não os comprovam.
