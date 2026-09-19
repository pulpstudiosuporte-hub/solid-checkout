// Public developer documentation. Contracts must match the implementation.
import { cliGuide } from './cli-docs-content';
import { developerGuides } from './developer-docs-content';
export const docsGroups = [
  { id: 'fundamentos', title: 'Fundamentos', description: 'Começo rápido, autorização, domínio e diagnóstico.', icon: 'compass' },
  { id: 'dev', title: 'CLI e temas', description: 'Projeto local, comandos, schema e publicação.', icon: 'layout' },
  { id: 'eventos', title: 'Webhooks', description: 'Eventos, payloads, assinatura e idempotência.', icon: 'plug' },
  { id: 'integracoes', title: 'Integrações', description: 'Shopify, pixels e contratos de medição.', icon: 'plug' },
];

function article(slug, group, title, summary, options) {
  const section = (id, title, items, ordered = false) => ({ id, title, items, ordered });
  return {
    slug, group, title, summary, updated: '19 de setembro de 2026',
    keywords: options.keywords || '', integration: options.integration,
    related: options.related || [],
    sections: [
      section('antes', 'Antes de começar', options.before),
      section('passo-a-passo', 'Passo a passo', options.steps, true),
      ...(options.details || []),
      section('conferir', 'Como conferir se deu certo', options.verify),
      section('resolver', 'Se algo não funcionar', options.troubleshoot),
    ],
  };
}

export const docsArticles = [
  ...developerGuides.map(guide => article(...guide)),
  article(...cliGuide),
  article('temas-cli', 'dev', 'Temas e CLI: do código ao checkout', 'Baixe três temas prontos, personalize com sua IA e importe o resultado no editor da Pirat.', {
    keywords: 'developer dev terminal CLI JSON schema tema download código IA',
    before: ['Instale Node.js 22 ou superior. O kit funciona no Windows, macOS e Linux, sem instalar dependências.', 'O contrato v1 personaliza cores, fontes, estrutura, etapas e aparência dos componentes existentes. Não executa React, CSS, JavaScript ou Liquid enviados pelo desenvolvedor.'],
    steps: ['Baixe e extraia o kit abaixo. Abra um terminal na pasta extraída.', 'Crie uma pasta nova com init, escolhendo minimal (Essencial), retail (Varejo) ou marketplace (Marketplace).', 'Abra a pasta na sua IA ou editor de código. Edite theme.json seguindo AGENTS.md e o schema do kit.', 'Execute validate e build. O arquivo para importar estará em minha-loja/dist/theme.pirat.json.', 'Na Pirat, abra um checkout em Personalizar → Modelos → Importar tema. Escolha o JSON, confira o nome e clique em Aplicar na prévia.', 'Revise computador e celular. Use Desfazer se precisar. Salve o rascunho; publique somente depois da revisão.'],
    details: [
      { id: 'download', title: 'Baixe o kit ou um tema pronto', items: ['O ZIP inclui a CLI, o validador compartilhado com o editor, o schema completo, as regras para IA e três modelos. Os JSON individuais podem ser importados diretamente.'], downloads: [
        { href: '/downloads/pirat-theme-kit-v1.zip', label: 'Kit completo com CLI (ZIP)' },
        { href: '/downloads/minimal.pirat.json', label: 'Tema Essencial (JSON)' },
        { href: '/downloads/retail.pirat.json', label: 'Tema Varejo (JSON)' },
        { href: '/downloads/marketplace.pirat.json', label: 'Tema Marketplace (JSON)' },
        { href: '/downloads/theme-v1.schema.json', label: 'Contrato completo (JSON Schema)' },
      ] },
      { id: 'terminal', title: 'Comandos reais', items: ['Execute na pasta extraída do kit. Troque retail por minimal ou marketplace para começar com outro modelo.'], code: 'node pirat.mjs init minha-loja retail\nnode pirat.mjs validate minha-loja\nnode pirat.mjs build minha-loja' },
      { id: 'json', title: 'Exemplo mínimo de theme.json', items: ['Somente os campos presentes no tema são aplicados. Este exemplo muda a estrutura e as cores do botão; use um dos modelos completos para definir toda a paleta.'], code: '{\n  "schemaVersion": 1,\n  "name": "Minha marca",\n  "config": {\n    "template": "retail",\n    "primary": "#202020",\n    "buttonBgColor": "#202020",\n    "buttonTextColor": "#ffffff"\n  }\n}' },
      { id: 'ia', title: 'Como trabalhar com sua IA', items: ['O comando init coloca as regras em AGENTS.md na pasta do tema. Forneça também theme.schema.json à IA.', 'Peça: “Leia as regras do tema. Ajuste theme.json para minha marca usando somente os campos do contrato v1. Valide com a CLI antes de finalizar.”', 'Exportar visual atual no editor gera um tema das opções suportadas, sem incluir dados da loja. Renomeie esse arquivo para theme.json dentro do projeto se quiser continuar pela CLI.'] },
    ],
    verify: ['validate precisa informar Tema válido, e build deve gerar dist/theme.pirat.json. A CLI é local: não pede senha, não acessa sua conta e não publica.', 'Depois de importar, confira cores, campos, resumo e etapas nas duas larguras. Salve, reabra o rascunho e confira antes de publicar.'],
    troubleshoot: ['Pasta já existe: init não sobrescreve projetos. Escolha outro nome ou edite o theme.json existente.', 'Campo desconhecido ou valor inválido: veja a propriedade indicada no erro e consulte o schema. O arquivo inteiro é rejeitado, sem aplicação parcial.', 'Arquivo muito grande: temas v1 têm limite de 32 KB. Não inclua imagens em base64 nem outros arquivos no JSON.', 'Logos, banners, depoimentos, blocos e integrações continuam no editor. A importação mantém esses dados e não altera preços, frete ou pagamentos. O kit offline não publica remotamente. Use a CLI conectada para enviar rascunhos e publicar; layouts arbitrários continuam fora do contrato.'],
    related: ['contrato-temas', 'cli-referencia'],
  }),
  article('contrato-temas', 'dev', 'Contrato de temas v1', 'Campos aceitos, compatibilidade, limites e regras de importação para desenvolvedores.', {
    keywords: 'schemaVersion config validação schema contrato código propriedades layout template',
    before: ['Use o JSON Schema do kit como referência completa dos campos. O validador é o mesmo na CLI e na importação do editor.', 'Campos desconhecidos são erros, inclusive no nível raiz. Não inclua credenciais ou informações comerciais no arquivo.'],
    steps: ['Defina schemaVersion como o número 1, name com 1 a 80 caracteres e config como objeto.', 'Defina config.template: minimal, conversion, showcase, compact, retail ou marketplace.', 'Use cores hexadecimais com seis dígitos (#RRGGBB), booleanos reais e números inteiros.', 'Configure contentWidth entre 650 e 1280, radius e inputRadius entre 0 e 28.', 'Escolha progressStyle entre outline, solid, icons e chevrons; layout entre split e centered.', 'Valide e importe o arquivo. O editor solicita aplicação explícita na prévia; salvar e publicar são etapas separadas.'],
    details: [{ id: 'regras', title: 'Comportamento da importação', items: ['A importação mescla somente as opções visuais presentes. Ela não apaga campos ausentes, nem redefine textos, imagens, elementos ou integrações.', 'name identifica o tema na confirmação e não renomeia o checkout.', 'A validação aceita no máximo 32 KB de JSON UTF-8. A CLI retorna código de saída 1 se houver erro.', 'O build substitui apenas o arquivo gerado dist/theme.pirat.json. init exige uma pasta nova. Não há instalação ou execução de scripts do tema.', 'O contrato v1 é uma configuração dos componentes existentes; não permite criar componentes ou carregar uma aplicação completa.'] }],
    verify: ['Confira um tema exportado pelo editor: somente campos do contrato devem aparecer. Nenhum depoimento, dado de cliente ou URL privada faz parte da exportação.', 'Teste também desfazer a aplicação antes de salvar o rascunho.'],
    troubleshoot: ['Não altere schemaVersion para tentar habilitar recursos inexistentes. Versões desconhecidas são rejeitadas.', 'Quando adicionar cores, confira também os textos e estados ativos/inativos para manter contraste.'],
    related: ['temas-cli', 'cli-conectada'],
  }),
  article('dominio', 'fundamentos', 'Conectar seu domínio', 'Publique o checkout em um endereço da sua marca, com HTTPS.', {
    keywords: 'dns cname cloudflare ssl certificado subdomínio endereço',
    before: ['Você precisa poder editar o DNS do domínio. Prefira um subdomínio dedicado, como checkout.sualoja.com.', 'Cadastrar o endereço na Pirat não altera automaticamente o DNS no seu provedor.'],
    steps: ['No painel, abra Checkout → Domínios e adicione o endereço, sem https:// e sem caminhos.', 'Copie exatamente o destino de CNAME exibido pela Pirat.', 'No provedor de DNS, crie o CNAME para o subdomínio escolhido, usando o destino copiado. Revise conflitos de registros A ou AAAA somente nesse mesmo subdomínio.', 'Volte à Pirat e acompanhe a verificação. Aguarde o status Ativo e a disponibilidade do HTTPS.', 'Use o domínio ativo no checkout que você vai publicar.'],
    verify: ['Abra o endereço publicado e confira se o navegador mostra uma conexão segura, sem aviso de certificado.', 'Teste também o link completo do checkout. Só o domínio responder não confirma que há um modelo publicado.'],
    troubleshoot: ['Revise erros de digitação no nome e no destino do CNAME. A propagação depende do provedor e não tem um prazo exato garantido.', 'Não remova registros de e-mail nem de outros sites. Se o domínio continuar pendente, compare o DNS público com as instruções exibidas no painel.'],
    related: ['inicio-rapido', 'cli-referencia', 'shopify'],
  }),
  article('shopify', 'integracoes', 'Conectar sua loja Shopify', 'Conecte o app próprio, sincronize o catálogo e leve o carrinho à Pirat.', {
    integration: 'shopify', keywords: 'theme liquid embed incorporações app proxy snippet client id secret sincronização',
    before: ['A loja e o app próprio precisam pertencer à mesma organização Shopify. Tenha permissão para instalar o app e editar o tema.', 'Conclua o cadastro da Pirat e ative seu domínio. O guia assistido em Integrações → Shopify fornece os valores e o código para sua configuração.'],
    steps: ['Em Marketing → Integrações → Shopify, abra o guia assistido e siga a criação do app no Dev Dashboard.', 'Configure e lance a versão com as URLs, os escopos e o App Proxy indicados no guia. Instale o app na loja correta e aprove suas permissões.', 'Informe na Pirat o domínio original terminado em myshopify.com, o ID do cliente e a chave secreta nos campos próprios. Clique em Conectar app próprio.', 'Use Sincronizar catálogo e confira produtos, variantes, imagens e coleções.', 'Crie e publique um checkout do tipo Loja Shopify, sem produto fixo.', 'Duplique o tema para ter uma cópia de segurança. No tema publicado, abra layout/theme.liquid e cole uma única vez o código gerado no guia, imediatamente antes de </body>.', 'Salve o tema e teste pelo carrinho e pelo botão Comprar agora, em janela anônima.'],
    details: [{ id: 'tema', title: 'Código no tema e Incorporações de apps', items: ['A integração usa um script no tema. Ela não possui extensão para ativar em “Incorporações de apps”. Não procure um botão de app embed para concluir essa etapa.', 'Copie o código do guia da sua loja, com seu domínio ativo. Antes de colar, procure data-solid-checkout para evitar instalar duas cópias.', 'Para desfazer a alteração no tema, remova apenas o bloco adicionado ou restaure a cópia de segurança.'] }],
    verify: ['Adicione dois produtos, altere quantidades e confira itens, variantes e valores no checkout da Pirat, tanto no celular quanto no computador.', 'Se a Pirat não conseguir criar a sessão, o fallback configurado deve encaminhar ao checkout nativo da Shopify. A conexão salva, sozinha, não comprova o redirecionamento.'],
    troubleshoot: ['Permissão ausente: corrija a versão do app, lance novamente e aprove as permissões indicadas.', 'Catálogo desatualizado: sincronize novamente. Carrinho sem redirecionar: confira App Proxy, tema publicado, script único, domínio ativo e modelo Shopify publicado.', 'Não cole a chave secreta no tema. Ela pertence somente ao campo de credenciais da integração.'],
    related: ['dominio', 'cli-referencia'],
  }),
  article('meta-pixel', 'integracoes', 'Meta Pixel e API de Conversões', 'Ative o Pixel pelo ID e adicione o envio pelo servidor quando necessário.', {
    integration: 'meta', keywords: 'facebook instagram capi token pixel helper purchase eventos',
    before: ['Tenha o ID do Pixel da sua operação. Para usar a API de Conversões, você também precisa de um token válido com acesso a esse Pixel.', 'O Pixel do navegador funciona com o ID. O token é opcional e serve para o envio pelo servidor.'],
    steps: ['Abra Marketing → Integrações → Meta Pixel na loja correta.', 'Informe o ID e salve o Pixel.', 'Se quiser envio pelo servidor, ative a API de Conversões e informe o token no campo protegido.', 'Ao trocar o ID, confira se o token corresponde ao novo Pixel. Não use um token de outra operação.', 'Abra ou recarregue o checkout publicado e acompanhe os eventos nas ferramentas da Meta.'],
    details: [{ id: 'eventos', title: 'Eventos da jornada', items: ['PageView e ViewContent acompanham a abertura; InitiateCheckout representa o início do checkout.', 'AddPaymentInfo acompanha a geração ou retomada do Pix. Purchase é reservado à confirmação do pagamento.', 'Quando enviados pelo navegador e servidor, os identificadores dos eventos permitem deduplicação. Gerar um Pix não é uma compra paga.'] }],
    verify: ['Confira o Pixel no navegador com o Meta Pixel Helper e a chegada de eventos no Gerenciador de Eventos.', 'Salvar a configuração não prova que a Meta aceitou cada evento. Valide também permissões e diagnóstico da conta de destino.'],
    troubleshoot: ['Nenhum Pixel encontrado: confira loja e ID, abra uma nova sessão publicada e verifique bloqueadores de rastreamento ou de rede.', 'Servidor sem eventos: revise o token, o acesso ao Pixel e a opção de API de Conversões. Não publique o token em capturas ou códigos do checkout.'],
    related: ['google-analytics', 'utmify', 'webhook-payload'],
  }),
  article('google-analytics', 'integracoes', 'Google Analytics 4', 'Acompanhe visitas e eventos de comércio eletrônico no GA4.', {
    integration: 'ga4', keywords: 'ga4 google analytics medição consentimento g-',
    before: ['Tenha uma propriedade GA4 e o ID de medição do fluxo Web, iniciado por G-. O número da propriedade é diferente do ID de medição.', 'O carregamento das tags Google depende do consentimento de medição no checkout.'],
    steps: ['Abra Marketing → Integrações → Google Analytics 4.', 'Escolha a instalação direta e informe o ID de medição. Preencha o ID numérico da propriedade se o formulário solicitar esse dado opcional.', 'Salve e abra o checkout publicado em uma nova sessão.', 'Aceite a medição para validar a instalação com consentimento. Acompanhe a navegação nas ferramentas de tempo real do GA4.', 'Teste a jornada e compare eventos com suas ações. A compra só deve ser enviada após confirmação do pagamento.'],
    details: [{ id: 'eventos', title: 'O que é enviado', items: ['A jornada inclui page_view, view_item, begin_checkout, add_shipping_info, add_payment_info e purchase, conforme as etapas realizadas.', 'No GA4, o valor dos itens considera descontos e exclui o frete; o frete é informado separadamente. O identificador da transação permite relacionar a compra ao pedido.', 'O envio é pelo navegador: consentimento, bloqueadores e fechamento da página podem afetar a medição. Os relatórios do Google não substituem os pedidos da Pirat.'] }],
    verify: ['Confira o fluxo de dados correto no GA4 e use suas ferramentas de diagnóstico para observar os eventos.', 'Teste também recusar a medição: as tags Google não devem ser carregadas nessa condição.'],
    troubleshoot: ['Se não houver eventos, revise o ID, o consentimento, bloqueadores e o modo de instalação.', 'Se escolheu GTM, a instalação direta é substituída. Configure e publique as tags no contêiner, evitando duplicar o GA4.'],
    related: ['google-tag-manager', 'google-ads'],
  }),
  article('google-ads', 'integracoes', 'Conversões do Google Ads', 'Registre compras confirmadas na ação de conversão da sua campanha.', {
    integration: 'ads', keywords: 'aw label rótulo campanhas conversão google',
    before: ['Tenha o ID de conversão iniciado por AW- e o rótulo da ação de compra. São dois campos diferentes.', 'Planeje se vai medir a compra diretamente ou importar a conversão do GA4 para evitar contar a mesma venda duas vezes como conversão principal.'],
    steps: ['Abra Marketing → Integrações → Google Ads.', 'No modo direto, informe o ID de conversão e o rótulo correspondentes à ação desejada.', 'Salve e confira as configurações de consentimento no checkout.', 'Acompanhe uma compra de teste autorizada até a confirmação e valide a ação no Google Ads.'],
    verify: ['A conversão de compra deve depender de pagamento confirmado, não apenas de Pix gerado.', 'O valor de conversão do Ads representa o total pago, incluindo frete. Confira o identificador da transação e a moeda.'],
    troubleshoot: ['Sem conversão: confira o par ID/rótulo, o consentimento, bloqueadores e se o pagamento realmente foi confirmado.', 'Contagem duplicada: revise instalações simultâneas e ações principais importadas do GA4. No modo GTM, gerencie as tags no contêiner publicado.'],
    related: ['google-analytics', 'google-tag-manager', 'webhook-payload'],
  }),
  article('google-tag-manager', 'integracoes', 'Google Tag Manager', 'Gerencie suas tags por um contêiner Web e pelos eventos do checkout.', {
    integration: 'gtm', keywords: 'gtm dataLayer tags contêiner container consentimento',
    before: ['Tenha um contêiner Web do GTM, iniciado por GTM-, e acesso para publicar suas alterações.', 'Escolher GTM substitui a instalação direta das tags Google na Pirat. Um contêiner vazio não cria tags automaticamente.'],
    steps: ['Em Marketing → Integrações → Google Tag Manager, selecione o modo GTM e informe o ID do contêiner.', 'Configure no GTM as tags e os acionadores compatíveis com os eventos de comércio eletrônico que pretende medir.', 'Use a prévia e as ferramentas de diagnóstico do Google para conferir a configuração.', 'Publique a versão do contêiner e valide no checkout publicado após consentir com a medição.'],
    details: [{ id: 'eventos', title: 'Eventos para seus acionadores', items: ['A camada de dados disponibiliza os eventos page_view, view_item, begin_checkout, add_shipping_info, add_payment_info e purchase, quando aplicáveis.', 'Use os dados de comércio eletrônico do evento, incluindo o identificador da transação, para suas tags. Não crie gatilhos que leiam os campos pessoais do formulário.', 'Defina o consentimento exigido por cada tag no contêiner. Uma configuração personalizada incorreta pode duplicar eventos ou transmitir dados indevidos.'] }],
    verify: ['Confira o contêiner correto, sua versão publicada e as tags disparadas nas etapas correspondentes.', 'Compare uma compra confirmada com o evento purchase; não use o clique no botão de Pix como equivalente a uma venda.'],
    troubleshoot: ['Contêiner detectado, sem eventos no destino: revise tags, acionadores e publicação da versão.', 'Eventos repetidos: remova instalações duplicadas de GA4 ou Ads no contêiner e confira a configuração escolhida na Pirat.'],
    related: ['google-analytics', 'google-ads'],
  }),
  article('utmify', 'integracoes', 'Conectar a UTMify', 'Envie pedidos Pix pendentes e pagos para acompanhar seu tráfego.', {
    integration: 'utmify', keywords: 'utm campanha rastreamento token atribuição',
    before: ['Tenha a credencial de API da sua operação na UTMify. A conexão pertence à loja selecionada na Pirat.'],
    steps: ['Na UTMify, localize sua credencial de API na área de integrações e webhooks.', 'Na Pirat, abra Marketing → Integrações → UTMify.', 'Cole a credencial no campo Token da API e clique em Conectar UTMify.', 'Aguarde a confirmação da validação. Abra seu checkout usando o link com os parâmetros de campanha que você pretende acompanhar.', 'Confira na UTMify a chegada do pedido após gerar Pix e sua atualização depois de confirmar o pagamento.'],
    verify: ['Pix gerado corresponde a aguardando pagamento; Pix confirmado corresponde a pago.', 'Confira o pedido e a campanha no destino. A integração usa um identificador estável para o pedido.'],
    troubleshoot: ['Credencial recusada: confira a conta de destino e gere ou copie novamente o token correto no provedor.', 'Uma falha no envio à UTMify não bloqueia o pagamento. Compare os pedidos da Pirat com o destino antes de concluir que uma venda não ocorreu.', 'Para interromper novos envios, use Desconectar na integração da loja.'],
    related: ['meta-pixel', 'webhook-payload', 'google-analytics'],
  }),
  article('webhooks', 'eventos', 'Webhooks e automações', 'Envie eventos da sua loja para um sistema próprio ou uma automação externa.', {
    integration: 'webhooks', keywords: 'api endpoint assinatura hmac sha256 automação payload integração desenvolvedor',
    before: ['Prepare um endpoint HTTPS público capaz de receber POST com JSON. Use uma URL sem credenciais, porta personalizada ou redirecionamento.', 'Webhooks notificam eventos; não são uma API para alterar preços ou criar cobranças. Guarde o segredo de assinatura somente no seu servidor.'],
    steps: ['Abra Gestão → Webhooks e crie um webhook com nome e URL de destino.', 'Selecione os eventos que sua automação precisa receber e defina se o endpoint fica ativo.', 'Informe um segredo válido ou guarde o segredo gerado, exibido uma única vez. Use-o para validar cada entrega.', 'Com o endpoint ativo, use Enviar teste. Confira a entrega no histórico e o recebimento no sistema de destino.', 'Depois, valide um evento real autorizado e trate reenvios para que não executem a mesma ação duas vezes.'],
    details: [
      { id: 'eventos', title: 'Eventos disponíveis', items: ['order.created: novo Pix gerado. order.paid: pagamento confirmado.', 'order.cancelled: cancelamento ou expiração. order.refunded: reembolso total ou parcial. payment.failed: falha na tentativa de pagamento.', 'Inscrever um evento não habilita por si só uma operação de cancelamento ou reembolso no seu gateway.'] },
      { id: 'assinatura', title: 'Contrato para quem desenvolve', items: ['O corpo contém id, event, createdAt, test e data. O conteúdo de data depende do evento. Confira o payload recebido em seu teste, sem registrar dados pessoais desnecessários.', 'Leia o corpo bruto, antes de converter JSON. Calcule HMAC-SHA256 com o segredo e a mensagem formada pelo timestamp, um ponto e o corpo bruto. Compare em tempo constante com a assinatura recebida.', 'Os nomes dos cabeçalhos preservam o prefixo solid por compatibilidade. Não os renomeie para pirat no seu receptor.', 'Valide a assinatura e a atualidade do timestamp antes de processar. Ignore eventos de teste no fluxo real. Registre o id do evento para impedir ações duplicadas em reenvios.', 'Responda com HTTP 2xx após aceitar com segurança a entrega. Respostas fora dessa faixa e falhas de conexão podem gerar novas tentativas.'], code: 'x-solid-event: order.paid\nx-solid-timestamp: <segundos Unix>\nx-solid-signature: sha256=<HMAC hexadecimal>\n\nMensagem assinada = timestamp + "." + corpoBruto\nAssinatura = "sha256=" + HMAC_SHA256(segredo, mensagem)' },
    ],
    verify: ['Enviar teste coloca a entrega na fila; isso não confirma o recebimento. Confira o status e o código HTTP no histórico.', 'Seu receptor deve reconhecer uma repetição do mesmo evento sem duplicar e-mails, baixas de estoque ou outras ações.'],
    troubleshoot: ['Falha de conexão: confira HTTPS, certificado, endereço e disponibilidade do receptor. Não use localhost ou URL interna.', 'Assinatura inválida: use o segredo correto e os bytes originais do corpo; converter o JSON e serializá-lo novamente muda a mensagem assinada.', 'Uma falha no webhook não significa que o comprador deve pagar outra vez. Confira o pedido e o gateway separadamente.'],
    related: ['webhook-payload', 'webhook-assinatura', 'webhook-entregas'],
  }),
];

export function normalizeDocsText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function searchDocs(query, group = '') {
  const terms = normalizeDocsText(query).trim().split(/\s+/).filter(Boolean);
  return docsArticles.filter(article => {
    if (group && article.group !== group) return false;
    const text = normalizeDocsText([article.title, article.summary, article.keywords,
      ...article.sections.flatMap(section => [section.title, ...section.items, section.code || ''])].join(' '));
    return terms.every(term => text.includes(term));
  });
}
