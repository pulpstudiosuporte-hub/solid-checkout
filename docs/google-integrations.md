# Google para os lojistas

Cada loja configura seus próprios destinos em **Integrações → Google Analytics 4 / Google Ads / Google Tag Manager**. A configuração usa a loja ativa, exige proprietário ou administrador e recusa uma gravação que indique outra loja. Não é a mensuração do painel administrativo ou do site institucional da SOLID.

O administrador da plataforma pode trocar as imagens em **Administração → Conteúdo → Integrações**, escolhendo Google Analytics 4, Google Ads ou Google Tag Manager. A imagem salva aparece no catálogo e no formulário correspondente. O catálogo e o seletor administrativo usam a mesma lista para manter novas integrações disponíveis nas duas telas. Esta versão inclui a publicação automática “Google conectado à sua loja” nas Novidades, preservando edições manuais do conteúdo.

## GA4 e Google Ads

1. No Analytics, crie ou selecione a propriedade da loja e um fluxo Web para o domínio público do checkout. Copie o **ID de medição `G-…`** em Administrador → Fluxos de dados → Web.
2. Na SOLID, escolha **GA4 e Google Ads**, informe esse ID e salve. O ID numérico da propriedade é opcional e serve para abrir o relatório correspondente. Não substitui o ID de medição.
3. Para Ads, selecione a ação de conversão de compra e informe seu **ID `AW-…`** e **rótulo de conversão**. Ambos são necessários. Use uma única ação principal para a compra: importar a mesma compra do GA4 e contar também a conversão direta de Ads pode duplicar a mensuração da campanha.
4. Nos relatórios, filtre o domínio do checkout para distinguir a jornada medida pela SOLID das páginas da vitrine. Para acompanhar a vitrine inteira, instale a mesma propriedade também na plataforma de origem. Configuração entre domínios e atribuição entre plataformas exigem configuração própria no Google.
5. Confira as configurações de medição otimizada no fluxo GA4: desative coleta automática de interações com formulários e mudanças de histórico no checkout. A SOLID fornece eventos explícitos com URL de página sanitizada. Não ative coleta automática de dados fornecidos pelo usuário no Google Ads para estes campos.

As tags diretas são carregadas somente após o comprador aceitar a medição. O consentimento começa negado e é atualizado antes da configuração das tags (Consent Mode v2 básico). A escolha é guardada por loja no navegador por até 180 dias. Preferências de cookies permite revogar; a página é recarregada para remover scripts e listeners já instalados. A SOLID não depende dessas tags para processar o pagamento.

## Tag Manager

Escolha **Tag Manager** e informe um contêiner **Web `GTM-…`**. Esse modo substitui a instalação direta; os campos diretos são removidos para evitar a instalação dupla. Publicar e manter as tags do contêiner é responsabilidade de quem administra a conta Google do lojista.

O contêiner é carregado apenas após aceitar a medição. Para refletir essa escolha no Consent Mode usando as APIs próprias do GTM, crie um modelo personalizado de tag, com permissão de escrita nos quatro tipos de consentimento abaixo, e execute-o em **Consent Initialization — All Pages**:

```js
const applyConsent = require('setDefaultConsentState');
applyConsent({
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted'
});
data.gtmOnSuccess();
```

Esse modelo só se aplica ao contêiner carregado pela SOLID **depois do aceite**. Não reutilize esse padrão em páginas que carregam o GTM antes da decisão. A recusa inicial não carrega o contêiner; a revogação interrompe os eventos da SOLID e recarrega a página sem carregar o GTM. O dataLayer também disponibiliza `solid_consent` com os quatro estados.

No contêiner:

- Configure a tag do Google com o ID GA4; desative o page_view automático (`send_page_view: false`). Use variáveis do dataLayer `solid_page_location`, `solid_page_title` e `solid_page_referrer` para os parâmetros correspondentes. Evite usar a URL completa da sessão ou variáveis de formulário.
- Crie uma tag de evento GA4 usando o nome do evento e os dados de comércio eletrônico do dataLayer. Acione somente em `page_view`, `view_item`, `begin_checkout`, `add_shipping_info`, `add_payment_info` e `purchase`.
- Para Ads, configure Conversion Linker e uma tag de conversão disparada somente em `purchase`. Use `ecommerce.transaction_id`, `ecommerce.currency` e o valor desejado. `ecommerce.value` exclui frete; some `ecommerce.shipping` se a sua ação de conversão incluir frete.
- Publique o contêiner após verificar no Preview/Tag Assistant. Tags que dependem de hosts não permitidos pela CSP, Custom HTML inline e JavaScript que exige eval continuam bloqueados. A política mantém essas restrições.

## Eventos e valores

| Evento | Momento |
| --- | --- |
| `page_view` | Abertura de uma sessão de checkout com aceite |
| `view_item` | Produtos da sessão disponíveis |
| `begin_checkout` | Sessão de checkout iniciada |
| `add_shipping_info` | Escolha de frete concluída |
| `add_payment_info` | Pix gerado |
| `purchase` | API encontra pagamento com status PAID |
| `conversion` | Conversão direta de Ads, no mesmo pagamento confirmado |

O endpoint público exige token da sessão e retorna apenas configuração pública e dados selecionados do pedido. Não retorna tokens do Google, credenciais de API, CPF, e-mail, telefone ou endereço do comprador. O envio explícito da SOLID usa URL sintética do checkout sem token/hash da sessão e referrer vazio. Os UTMs e identificadores de clique aceitos passam por uma lista de campos e validação; não inclua dados pessoais nos nomes de campanha/produtos. Scripts e tags adicionais configurados pelo lojista precisam seguir a mesma restrição.

O valor do GA4 exclui frete e já considera os descontos, distribuídos entre os itens. A conversão direta de Ads usa o total efetivamente pago, incluindo frete. Ambos usam a sessão como `transaction_id`, estável nas tentativas de pagamento. Gerar Pix não dispara compra.

UTMs, gclid, gbraid e wbraid são preservados quando presentes na entrada do checkout direto. O contrato de criação de sessão aceita esses parâmetros também para integrações que os encaminhem. A transferência desde a vitrine Shopify deve ser conferida na configuração de origem; a integração não inventa parâmetros que não chegaram ao checkout.

## Validação

- Salvar confirma formato e persistência dos IDs, não a propriedade da conta nem o recebimento de eventos. A indicação na SOLID é **Configurado**.
- Entre no Google com acesso à propriedade e abra **Tempo real** no GA4. Abra um checkout de teste publicado, aceite a medição e confira a sequência até `add_payment_info`.
- Confira que apenas uma confirmação de pagamento autorizada resulta em `purchase`, com moeda, itens, valor e transaction_id corretos. Confira também a ação no Ads ou as tags no GTM. Não use cobranças reais sem um cenário de teste autorizado.
- Teste duas lojas com IDs distintos e um usuário analista. Ao trocar a loja, não deve aparecer nem ser salva a configuração anterior.
- Testes locais: `npx vitest run apps/api/test/google-integration.test.ts apps/web/test/google-tracking.test.js` e `npx playwright test --config scripts/google-ui.config.mjs`. A página `/ui-tests/google-review.html` simula API e bloqueia o carregamento real de scripts Google; não integra o build de produção.

## Operação e limites

Validação local em 11/09/2026: `npm.cmd run check` aprovado (19 avisos de lint preexistentes), 11 testes direcionados de API/tracking e três cenários Playwright aprovados. Formulário e consentimento inspecionados no navegador integrado; capturas desktop/mobile abertas. API, banco e scripts Google foram simulados nos cenários dedicados. Nenhuma conta Google real foi vinculada e nenhum evento foi enviado ao Google nesta revisão.

A configuração é criptografada na tabela existente `gateway_connections`, provider `GOOGLE`. Não há migration ou dependência nova. A API precisa do `APP_ENCRYPTION_KEY` já usado pelas outras integrações. Atualize API e web juntos; a CSP do HTML, Vite e Nginx permite os destinos Google documentados (incluindo os endpoints locais google.com.br). Outros TLDs e tags podem exigir revisão específica da política. IDs não são segredos, mas acesso à configuração administrativa é autenticado.

As compras são emitidas pelo navegador após consultar a confirmação da API. Bloqueadores, falhas de rede, recusa de consentimento ou fechamento da página podem impedir o envio. O código reduz repetições no mesmo navegador com memória/sessionStorage e envia transaction_id; isso não comprova recebimento remoto. Não há envio GA4 pelo servidor, conversões aprimoradas, reembolso automático, OAuth ou importação de relatórios para dentro do painel. Os relatórios são abertos no Google. Desconectar afeta novas consultas; páginas já abertas podem manter scripts até serem recarregadas.

## Referências oficiais

- [Eventos de comércio eletrônico do GA4](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
- [Consent Mode e APIs de consentimento no GTM](https://developers.google.com/tag-platform/security/guides/consent)
- [Conversões do Google Ads com a tag do Google](https://support.google.com/google-ads/answer/7548399)
- [CSP necessária às tags Google](https://developers.google.com/tag-platform/security/guides/csp)
- [Direcionamento dos eventos para cada destino](https://developers.google.com/tag-platform/gtagjs/routing)
