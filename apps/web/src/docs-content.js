// Public, merchant-facing content only. See docs/public-documentation.md before adding articles.
import { cliGuide } from './cli-docs-content';
export const docsGroups = [
  { id: 'comecar', title: 'Primeiros passos', description: 'Da sua loja ao primeiro checkout publicado.', icon: 'compass' },
  { id: 'checkout', title: 'Crie do seu jeito', description: 'Modelos, IA, imagens e recursos de conversão.', icon: 'layout' },
  { id: 'dev', title: 'Para desenvolvedores', description: 'Temas para baixar, CLI, contratos e exemplos de código.', icon: 'plug' },
  { id: 'integracoes', title: 'Conecte sua operação', description: 'Shopify, pixels, Google e automações.', icon: 'plug' },
  { id: 'vendas', title: 'Acompanhe suas vendas', description: 'Pagamentos, entrega, pedidos e análises.', icon: 'bag' },
  { id: 'ajuda', title: 'Resolva e continue', description: 'Respostas para os obstáculos mais comuns.', icon: 'help' },
];

function article(slug, group, title, summary, options) {
  const section = (id, title, items, ordered = false) => ({ id, title, items, ordered });
  return {
    slug, group, title, summary, updated: '18 de setembro de 2026',
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
  { ...article(...cliGuide), updated: '19 de setembro de 2026' },
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
    troubleshoot: ['Pasta já existe: init não sobrescreve projetos. Escolha outro nome ou edite o theme.json existente.', 'Campo desconhecido ou valor inválido: veja a propriedade indicada no erro e consulte o schema. O arquivo inteiro é rejeitado, sem aplicação parcial.', 'Arquivo muito grande: temas v1 têm limite de 32 KB. Não inclua imagens em base64 nem outros arquivos no JSON.', 'Logos, banners, depoimentos, blocos e integrações continuam no editor. A importação mantém esses dados e não altera preços, frete ou pagamentos. Novos layouts arbitrários e publicação remota por CLI ainda não fazem parte desta versão.'],
    related: ['contrato-temas', 'modelos', 'publicar'],
  }),
  article('contrato-temas', 'dev', 'Contrato de temas v1', 'Campos aceitos, compatibilidade, limites e regras de importação para desenvolvedores.', {
    keywords: 'schemaVersion config validação schema contrato código propriedades layout template',
    before: ['Use o JSON Schema do kit como referência completa dos campos. O validador é o mesmo na CLI e na importação do editor.', 'Campos desconhecidos são erros, inclusive no nível raiz. Não inclua credenciais ou informações comerciais no arquivo.'],
    steps: ['Defina schemaVersion como o número 1, name com 1 a 80 caracteres e config como objeto.', 'Defina config.template: minimal, conversion, showcase, compact, retail ou marketplace.', 'Use cores hexadecimais com seis dígitos (#RRGGBB), booleanos reais e números inteiros.', 'Configure contentWidth entre 650 e 1280, radius e inputRadius entre 0 e 28.', 'Escolha progressStyle entre outline, solid, icons e chevrons; layout entre split e centered.', 'Valide e importe o arquivo. O editor solicita aplicação explícita na prévia; salvar e publicar são etapas separadas.'],
    details: [{ id: 'regras', title: 'Comportamento da importação', items: ['A importação mescla somente as opções visuais presentes. Ela não apaga campos ausentes, nem redefine textos, imagens, elementos ou integrações.', 'name identifica o tema na confirmação e não renomeia o checkout.', 'A validação aceita no máximo 32 KB de JSON UTF-8. A CLI retorna código de saída 1 se houver erro.', 'O build substitui apenas o arquivo gerado dist/theme.pirat.json. init exige uma pasta nova. Não há instalação ou execução de scripts do tema.', 'O contrato v1 é uma configuração dos componentes existentes; não permite criar componentes ou carregar uma aplicação completa.'] }],
    verify: ['Confira um tema exportado pelo editor: somente campos do contrato devem aparecer. Nenhum depoimento, dado de cliente ou URL privada faz parte da exportação.', 'Teste também desfazer a aplicação antes de salvar o rascunho.'],
    troubleshoot: ['Não altere schemaVersion para tentar habilitar recursos inexistentes. Versões desconhecidas são rejeitadas.', 'Quando adicionar cores, confira também os textos e estados ativos/inativos para manter contraste.'],
    related: ['temas-cli', 'editor'],
  }),
  article('primeiros-passos', 'comecar', 'Sua primeira venda começa aqui', 'Prepare a loja, conecte o pagamento e publique seu primeiro checkout.', {
    keywords: 'começar onboarding cadastro configuração loja plano',
    before: ['Tenha acesso à sua conta Pirat, aos dados da loja e ao provedor do seu domínio. As configurações se aplicam à loja selecionada no painel.', 'Você pode preparar o visual antes de concluir a ativação. Publicar e vender exige concluir os dados obrigatórios e configurar o domínio e o pagamento.'],
    steps: ['Entre no painel e selecione ou crie sua loja. Confira o nome no seletor antes de alterar uma configuração.', 'Em Configurações, complete os dados obrigatórios da loja e do responsável. Consulte Meu plano para conhecer os limites da sua conta.', 'Cadastre os produtos ou conecte a Shopify e sincronize o catálogo.', 'Configure um gateway compatível e os métodos de entrega, se vender produtos físicos.', 'Adicione um domínio em Domínios, faça o apontamento indicado e aguarde o status Ativo.', 'Em Checkouts, crie um modelo, personalize e confira a prévia. Salve o rascunho e publique quando estiver pronto.'],
    verify: ['Abra o link publicado em uma janela anônima no computador e no celular. Confira produto, variação, quantidade, preço, frete e contato da loja.', 'Gerar um Pix cria um pedido pendente. Apenas a confirmação do pagamento deve mudar o pedido para pago. Um teste visual não valida o recebimento de dinheiro.'],
    troubleshoot: ['Se a publicação estiver bloqueada, confira os dados obrigatórios e o domínio ativo. Se o Pix falhar, revise o gateway da mesma loja.', 'Ao pedir ajuda, informe a etapa e o texto do erro. Não envie senhas, tokens ou dados completos de compradores.'],
    related: ['dominio', 'gateways', 'publicar'],
  }),
  article('produtos', 'comecar', 'Produtos e catálogo', 'Entenda de onde vêm os itens, variantes e valores do checkout.', {
    before: ['Defina se você vai usar o carrinho de uma loja Shopify ou um link com produto fixo. Isso muda a origem dos itens, não apenas o visual.'],
    steps: ['Selecione a loja correta e abra Produtos para revisar o catálogo.', 'Para produtos importados da Shopify, conecte a integração e use Sincronizar catálogo. Confira variantes, imagens e preços.', 'Para um link com produto fixo, cadastre ou selecione o produto correspondente antes de criar o checkout.', 'Confira se o produto exige entrega física. Essa informação influencia os campos e as opções de frete.', 'Crie o checkout no modo adequado: Loja Shopify para o carrinho automático ou link com produto fixo para uma oferta específica.'],
    verify: ['Compare um item do catálogo com o item no checkout publicado. Verifique a variante e a quantidade, além do título.', 'O modelo Shopify recebe o carrinho real; produtos ilustrativos da prévia não substituem esse carrinho.'],
    troubleshoot: ['Se uma alteração da Shopify ainda não apareceu, sincronize novamente e abra uma nova sessão de checkout.', 'Se um link exibir um produto diferente, confira o modo do checkout e o produto vinculado antes de publicar outra vez.'],
    related: ['shopify', 'modelos', 'publicar'],
  }),
  article('dominio', 'comecar', 'Conectar seu domínio', 'Publique o checkout em um endereço da sua marca, com HTTPS.', {
    keywords: 'dns cname cloudflare ssl certificado subdomínio endereço',
    before: ['Você precisa poder editar o DNS do domínio. Prefira um subdomínio dedicado, como checkout.sualoja.com.', 'Cadastrar o endereço na Pirat não altera automaticamente o DNS no seu provedor.'],
    steps: ['No painel, abra Checkout → Domínios e adicione o endereço, sem https:// e sem caminhos.', 'Copie exatamente o destino de CNAME exibido pela Pirat.', 'No provedor de DNS, crie o CNAME para o subdomínio escolhido, usando o destino copiado. Revise conflitos de registros A ou AAAA somente nesse mesmo subdomínio.', 'Volte à Pirat e acompanhe a verificação. Aguarde o status Ativo e a disponibilidade do HTTPS.', 'Use o domínio ativo no checkout que você vai publicar.'],
    verify: ['Abra o endereço publicado e confira se o navegador mostra uma conexão segura, sem aviso de certificado.', 'Teste também o link completo do checkout. Só o domínio responder não confirma que há um modelo publicado.'],
    troubleshoot: ['Revise erros de digitação no nome e no destino do CNAME. A propagação depende do provedor e não tem um prazo exato garantido.', 'Não remova registros de e-mail nem de outros sites. Se o domínio continuar pendente, compare o DNS público com as instruções exibidas no painel.'],
    related: ['primeiros-passos', 'publicar', 'shopify'],
  }),
  article('modelos', 'checkout', 'Escolher a estrutura do checkout', 'Compare modelos e encontre a organização que combina com sua loja.', {
    keywords: 'template varejo marketplace colunas etapas layout nike shopify',
    before: ['Tipo de checkout define os produtos usados; modelo visual define a apresentação. São escolhas diferentes.', 'As estruturas estão disponíveis no editor manual e na criação com IA. Use sua própria marca, imagens e textos.'],
    steps: ['Abra Checkouts e crie um checkout ou edite um rascunho existente.', 'Escolha o tipo: carrinho automático da Shopify ou produto fixo.', 'Abra Modelos e compare as opções na prévia. Varejo organiza as áreas em colunas no computador; Marketplace usa cartões para agrupar o conteúdo.', 'Ajuste o indicador de etapas, a aparência dos campos, os textos e as cores conforme as opções do modelo.', 'Confira a reorganização no celular e salve o rascunho.'],
    verify: ['Confirme a posição do formulário, dos itens e do resumo. A mesma estrutura precisa continuar legível em uma tela estreita.', 'As etapas devem corresponder ao fluxo do produto. Produtos digitais identificados não precisam exibir uma etapa de entrega física.'],
    troubleshoot: ['Trocar o modelo não habilita um meio de pagamento nem uma integração nova. Esses recursos dependem das configurações da loja.', 'Se a referência tiver um componente que não existe no editor, escolha a alternativa disponível mais próxima. A IA também usa os componentes disponíveis na Pirat.'],
    related: ['editor', 'criar-com-ia', 'publicar'],
  }),
  article('editor', 'checkout', 'Personalizar sem IA', 'Ajuste o visual e o conteúdo com a prévia do editor manual.', {
    keywords: 'manual cores tipografia fonte cabeçalho rodapé políticas seo botões etapas',
    before: ['Abra um checkout da loja selecionada. Alterações no rascunho precisam ser publicadas para aparecer para os compradores.'],
    steps: ['Em Modelos e Aparência, escolha a estrutura e o estilo inicial.', 'Em Cores e Cabeçalho, configure a identidade da loja. Mantenha contraste entre textos, campos e fundos.', 'Em Conteúdo das etapas, revise títulos, orientações e botões. Use textos compatíveis com o produto e a entrega reais.', 'Em Elementos, adicione os recursos necessários. Revise também Escassez e Oferta de saída antes de ativá-los.', 'Complete Rodapé, Políticas e SEO com informações verdadeiras da loja. Confira Moeda e idioma e as demais opções disponíveis.', 'Alterne a prévia entre computador e celular, salve e publique quando concluir a revisão.'],
    verify: ['Confira textos compridos, botões, imagens, cupom, etapas e resumo. A prévia é ilustrativa e não processa pagamentos.', 'Após publicar, abra uma nova sessão do checkout e confirme que o visual corresponde à versão revisada.'],
    troubleshoot: ['Se uma cor não for aceita, informe um valor válido pelo seletor. Se o formulário não salvar, revise os campos destacados e os pré-requisitos dos recursos ativados.', 'Para desfazer uma edição local, use os controles de desfazer/refazer do editor. Rascunho salvo e versão publicada são estados diferentes.'],
    related: ['imagens', 'oferta-de-saida', 'prova-social', 'publicar'],
  }),
  article('criar-com-ia', 'checkout', 'Criar um checkout com IA', 'Transforme sua ideia em uma prévia e continue no editor completo.', {
    keywords: 'gemini papagaio referência imagem inteligência artificial geração prompt banner logo',
    before: ['Tenha uma descrição da sua marca, o produto ou tipo de carrinho e, se quiser, uma referência visual.', 'A IA monta a personalização com os componentes da Pirat. Ela não cria produtos, preços, descontos ou compras reais.'],
    steps: ['Em Checkouts, abra Criar com IA. O papagaio conduz uma conversa guiada, uma pergunta por vez.', 'Responda com a marca, o estilo e as cores que deseja. Por exemplo: “Loja de café, fundo claro, títulos escuros e resumo lateral; destaque o prazo de entrega”.', 'Informe sua marca e escolha se vai usar logo e banners. Envie essas imagens nos campos próprios.', 'Adicione uma referência visual opcional para orientar cores e organização. Ela não vira automaticamente uma imagem do checkout.', 'Escolha os recursos, como etapas e avisos de compras. Se quiser depoimentos, forneça avaliações reais.', 'Gere a prévia, confira computador e celular e peça ajustes. Use Alterar resposta na conversa para corrigir uma escolha. Depois de gerar, escreva o que quer mudar e envie o ajuste; gere novamente antes de salvar.', 'Salve como rascunho para abrir o editor. Revise os textos e publique separadamente.'],
    details: [{ id: 'referencias', title: 'O que acontece com as imagens', items: ['A referência visual é temporária e não entra na biblioteca da loja. Ela é descartada da Pirat ao sair do criador ou salvar o rascunho; cancelar uma geração mantém a referência para tentar de novo.', 'Logos e banners usados no resultado ficam salvos para continuar aparecendo no checkout. Remover a referência não apaga esses arquivos.', 'A descrição e a referência são enviadas ao Google Gemini para gerar o resultado. Não inclua segredos nem dados pessoais de compradores. A limpeza na Pirat não determina a retenção do Google.'] }],
    verify: ['A prévia deve respeitar a estrutura e os recursos escolhidos. Confira todos os textos antes de publicar.', 'Salvar a geração cria um rascunho editável; não altera automaticamente um checkout já publicado.'],
    troubleshoot: ['Se a geração demorar ou atingir o limite, aguarde e tente novamente. Evite repetir cliques enquanto uma solicitação estiver em andamento.', 'Se a referência for recusada, use PNG, JPEG ou WebP com até 2 MB. Para logo e banner do criador, use os limites indicados ao lado do envio.', 'Uma referência pode ter funções ainda não suportadas. Explique quais partes são prioritárias e refine o resultado no editor.'],
    related: ['modelos', 'imagens', 'prova-social', 'publicar'],
  }),
  article('imagens', 'checkout', 'Logo, banners e identidade', 'Use os campos de imagem para deixar o checkout com a cara da sua loja.', {
    before: ['Prepare arquivos legíveis e com direito de uso. Uma captura enviada como referência à IA não substitui o envio da logo ou do banner.'],
    steps: ['No editor, localize o Cabeçalho e as opções de imagens ou banners. No criador com IA, escolha usar logo ou banner para abrir os campos correspondentes.', 'Envie a imagem no campo adequado e respeite o formato e o tamanho máximo informados na tela.', 'Use uma versão da logo que tenha contraste com o fundo escolhido.', 'Revise os banners no computador e no celular. Evite colocar informações essenciais em letras pequenas dentro da imagem.', 'Salve o rascunho e publique depois de revisar o resultado.'],
    verify: ['Abra o checkout em uma janela anônima e confirme que as imagens carregam. Confira recortes, proporções e legibilidade.', 'Textos como preço e condições de pagamento devem refletir a oferta real, inclusive quando aparecem em uma imagem.'],
    troubleshoot: ['Se o envio falhar, confira formato e limite do campo. Se o banner estiver cortado, ajuste sua composição para a área de exibição.', 'Se a imagem só aparecer no editor, confirme que a versão foi publicada e recarregue uma nova sessão do checkout.'],
    related: ['editor', 'criar-com-ia'],
  }),
  article('publicar', 'checkout', 'Do rascunho ao checkout publicado', 'Salve, revise e disponibilize a versão certa para seus compradores.', {
    before: ['Conclua o cadastro obrigatório da loja e tenha um domínio ativo. Revise os produtos, o gateway e a logística aplicáveis.', 'Uma prévia demonstra o layout. Ela não confirma integração, pagamento ou entrega.'],
    steps: ['Abra o checkout e confira a prévia em computador e celular.', 'Salve o rascunho. Se houver erro, corrija os campos indicados antes de continuar.', 'Use Publicar. As alterações pendentes precisam ser salvas com sucesso para a publicação concluir.', 'Abra o link publicado em uma janela anônima. No modo Shopify, inicie também pelo carrinho real da loja.', 'Confira itens, variantes, valores, cupom, frete e etapas. Se gerar Pix em um teste, saiba que isso pode criar um pedido pendente real.'],
    verify: ['A confirmação de publicação deve aparecer no painel e a nova sessão deve exibir a versão esperada.', 'Para validar recebimento, é necessário acompanhar uma transação autorizada e sua confirmação no provedor e na Pirat. Não marque uma compra como paga apenas porque o QR Code apareceu.'],
    troubleshoot: ['Se estiver vendo a versão anterior, confirme que publicou o checkout correto na loja correta e abra uma nova sessão.', 'Se a publicação estiver bloqueada, revise cadastro, domínio e campos obrigatórios. Se a página abrir mas o pagamento falhar, use o guia de gateways.'],
    related: ['dominio', 'gateways', 'resolver-checkout'],
  }),
  article('cupons', 'checkout', 'Cupons e descontos', 'Prepare descontos válidos para o checkout e para a oferta de saída.', {
    keywords: 'código desconto validade usos mínimo promoção',
    before: ['Defina a condição comercial antes de criar o cupom. O código, a validade, o limite de uso e o valor mínimo influenciam sua aplicação.'],
    steps: ['Abra Marketing → Cupons na loja correta e crie ou revise o cupom.', 'Preencha o código e as condições disponíveis no formulário. Confira o período e as restrições antes de salvar.', 'No checkout, deixe o recurso de cupom disponível se quiser permitir a digitação pelo comprador.', 'Para a oferta de saída, selecione esse cupom no editor antes de ativar a oferta.', 'Teste com um carrinho que atenda às condições e com outro que não atenda.'],
    verify: ['Confira a linha de desconto e o total final. O checkout deve recusar o código quando suas condições não forem atendidas.', 'A oferta de saída não deve substituir silenciosamente um cupom que o comprador já aplicou.'],
    troubleshoot: ['Código recusado: confira loja, digitação, validade, limite de usos e valor mínimo.', 'Não prometa um desconto no banner antes de confirmar que o cupom configurado realmente aplica esse valor ao carrinho.'],
    related: ['oferta-de-saida', 'publicar'],
  }),
  article('oferta-de-saida', 'checkout', 'Oferta de saída e popup', 'Ofereça um cupom por tempo na página ou sinal de intenção de saída.', {
    keywords: 'popup pop-up mouse voltar back redirect tempo timer desconto',
    before: ['Crie um cupom válido em Marketing → Cupons. Ativar a oferta sem selecionar um cupom impede salvar a configuração.', 'O navegador não informa a posição do botão Voltar à página. O sinal de saída usa o movimento do mouse próximo ao topo da área do checkout.'],
    steps: ['No editor, abra Oferta de saída e selecione o cupom.', 'Ative a oferta e ajuste o título, o texto do botão e a aparência.', 'Configure o tempo e os comportamentos disponíveis, incluindo a opção para celular quando desejada.', 'Confira a prévia, salve o rascunho e publique.', 'Teste em uma sessão nova: aguarde o tempo configurado ou mova o mouse em direção à parte superior da página após o tempo mínimo.'],
    verify: ['O popup deve mostrar a condição correta. Ao aceitar, confira se o cupom foi aplicado no resumo.', 'A oferta aparece uma vez por sessão e respeita situações como cupom já aplicado, pagamento em andamento ou outro diálogo aberto.'],
    troubleshoot: ['Se não abrir, teste sem um cupom aplicado, fora do pagamento e em uma nova sessão. Aguarde o tempo mínimo.', 'Em celular não há movimento de mouse; use as opções de tempo e de comportamento móvel. O recurso não garante interceptar o botão Voltar do navegador.'],
    related: ['cupons', 'editor', 'publicar'],
  }),
  article('prova-social', 'checkout', 'Depoimentos e avisos de compras', 'Dê contexto ao comprador com avaliações e atividade reais.', {
    keywords: 'pulsar clientes popup comprando prova social notificações avaliações pessoas',
    before: ['Use depoimentos verdadeiros, com autorização para exibir nomes e imagens. Avisos de compras representam atividade real, não vendas inventadas.'],
    steps: ['No editor, revise os elementos de depoimentos e os avisos de compras disponíveis para o modelo.', 'Na criação com IA, preencha os campos de depoimentos reais e escolha se deseja ativar avisos de compras.', 'Confira o texto, o nome exibido e a posição dos elementos. Sem avaliações fornecidas, a seção de depoimentos fica desativada no rascunho gerado.', 'Ajuste o visual para os avisos não atrapalharem campos ou botões, principalmente no celular.', 'Salve, revise e publique.'],
    verify: ['Confira as avaliações no checkout publicado. Verifique se o conteúdo corresponde ao que você forneceu.', 'Uma loja sem atividade elegível pode não exibir avisos de compras. Habilitar o recurso não cria essa atividade.'],
    troubleshoot: ['Se os depoimentos não aparecerem, confira se há conteúdo salvo e se a seção está ativa na versão publicada.', 'Se um aviso não aparecer em um teste, não conclua que houve erro apenas pela ausência de compras recentes. Confira a configuração e a atividade da loja.'],
    related: ['editor', 'criar-com-ia'],
  }),
  article('order-bumps', 'checkout', 'Adicionar uma oferta complementar', 'Use order bumps para oferecer um item extra de forma clara.', {
    before: ['Crie primeiro o checkout principal da loja. A oferta deve deixar claro o produto e o preço que serão adicionados ao pedido.', 'Salvar uma oferta nessa tela também publica a atualização do checkout usado pela oferta. Revise antes de confirmar.'],
    steps: ['Abra Marketing → Order bumps na loja correta.', 'Crie a oferta e escolha Produto existente ou Produto independente. No segundo caso, informe nome, preço, descrição e imagem do novo item.', 'Revise título e mensagem complementar na prévia. Confira o preço do produto selecionado.', 'Salve a oferta e confira sua apresentação no checkout publicado.', 'Teste marcar e desmarcar o item antes de gerar o pagamento.'],
    verify: ['O resumo deve refletir a escolha do comprador e o total correto. Confira também eventual impacto no frete.', 'O pedido deve conter o item adicional somente quando ele for selecionado.'],
    troubleshoot: ['Se a oferta não aparecer, confira o checkout principal e se a atualização foi publicada com sucesso.', 'Se o preço parecer incorreto, revise o produto e a condição cadastrada. Ao excluir uma oferta, leia a confirmação: um produto manual criado para ela também pode ser excluído.'],
    related: ['produtos', 'publicar'],
  }),
  article('shopify', 'integracoes', 'Conectar sua loja Shopify', 'Conecte o app próprio, sincronize o catálogo e leve o carrinho à Pirat.', {
    integration: 'shopify', keywords: 'theme liquid embed incorporações app proxy snippet client id secret sincronização',
    before: ['A loja e o app próprio precisam pertencer à mesma organização Shopify. Tenha permissão para instalar o app e editar o tema.', 'Conclua o cadastro da Pirat e ative seu domínio. O guia assistido em Integrações → Shopify fornece os valores e o código para sua configuração.'],
    steps: ['Em Marketing → Integrações → Shopify, abra o guia assistido e siga a criação do app no Dev Dashboard.', 'Configure e lance a versão com as URLs, os escopos e o App Proxy indicados no guia. Instale o app na loja correta e aprove suas permissões.', 'Informe na Pirat o domínio original terminado em myshopify.com, o ID do cliente e a chave secreta nos campos próprios. Clique em Conectar app próprio.', 'Use Sincronizar catálogo e confira produtos, variantes, imagens e coleções.', 'Crie e publique um checkout do tipo Loja Shopify, sem produto fixo.', 'Duplique o tema para ter uma cópia de segurança. No tema publicado, abra layout/theme.liquid e cole uma única vez o código gerado no guia, imediatamente antes de </body>.', 'Salve o tema e teste pelo carrinho e pelo botão Comprar agora, em janela anônima.'],
    details: [{ id: 'tema', title: 'Código no tema e Incorporações de apps', items: ['A integração usa um script no tema. Ela não possui extensão para ativar em “Incorporações de apps”. Não procure um botão de app embed para concluir essa etapa.', 'Copie o código do guia da sua loja, com seu domínio ativo. Antes de colar, procure data-solid-checkout para evitar instalar duas cópias.', 'Para desfazer a alteração no tema, remova apenas o bloco adicionado ou restaure a cópia de segurança.'] }],
    verify: ['Adicione dois produtos, altere quantidades e confira itens, variantes e valores no checkout da Pirat, tanto no celular quanto no computador.', 'Se a Pirat não conseguir criar a sessão, o fallback configurado deve encaminhar ao checkout nativo da Shopify. A conexão salva, sozinha, não comprova o redirecionamento.'],
    troubleshoot: ['Permissão ausente: corrija a versão do app, lance novamente e aprove as permissões indicadas.', 'Catálogo desatualizado: sincronize novamente. Carrinho sem redirecionar: confira App Proxy, tema publicado, script único, domínio ativo e modelo Shopify publicado.', 'Não cole a chave secreta no tema. Ela pertence somente ao campo de credenciais da integração.'],
    related: ['dominio', 'produtos', 'publicar'],
  }),
  article('meta-pixel', 'integracoes', 'Meta Pixel e API de Conversões', 'Ative o Pixel pelo ID e adicione o envio pelo servidor quando necessário.', {
    integration: 'meta', keywords: 'facebook instagram capi token pixel helper purchase eventos',
    before: ['Tenha o ID do Pixel da sua operação. Para usar a API de Conversões, você também precisa de um token válido com acesso a esse Pixel.', 'O Pixel do navegador funciona com o ID. O token é opcional e serve para o envio pelo servidor.'],
    steps: ['Abra Marketing → Integrações → Meta Pixel na loja correta.', 'Informe o ID e salve o Pixel.', 'Se quiser envio pelo servidor, ative a API de Conversões e informe o token no campo protegido.', 'Ao trocar o ID, confira se o token corresponde ao novo Pixel. Não use um token de outra operação.', 'Abra ou recarregue o checkout publicado e acompanhe os eventos nas ferramentas da Meta.'],
    details: [{ id: 'eventos', title: 'Eventos da jornada', items: ['PageView e ViewContent acompanham a abertura; InitiateCheckout representa o início do checkout.', 'AddPaymentInfo acompanha a geração ou retomada do Pix. Purchase é reservado à confirmação do pagamento.', 'Quando enviados pelo navegador e servidor, os identificadores dos eventos permitem deduplicação. Gerar um Pix não é uma compra paga.'] }],
    verify: ['Confira o Pixel no navegador com o Meta Pixel Helper e a chegada de eventos no Gerenciador de Eventos.', 'Salvar a configuração não prova que a Meta aceitou cada evento. Valide também permissões e diagnóstico da conta de destino.'],
    troubleshoot: ['Nenhum Pixel encontrado: confira loja e ID, abra uma nova sessão publicada e verifique bloqueadores de rastreamento ou de rede.', 'Servidor sem eventos: revise o token, o acesso ao Pixel e a opção de API de Conversões. Não publique o token em capturas ou códigos do checkout.'],
    related: ['google-analytics', 'utmify', 'pedidos'],
  }),
  article('google-analytics', 'integracoes', 'Google Analytics 4', 'Acompanhe visitas e eventos de comércio eletrônico no GA4.', {
    integration: 'ga4', keywords: 'ga4 google analytics medição consentimento g-',
    before: ['Tenha uma propriedade GA4 e o ID de medição do fluxo Web, iniciado por G-. O número da propriedade é diferente do ID de medição.', 'O carregamento das tags Google depende do consentimento de medição no checkout.'],
    steps: ['Abra Marketing → Integrações → Google Analytics 4.', 'Escolha a instalação direta e informe o ID de medição. Preencha o ID numérico da propriedade se o formulário solicitar esse dado opcional.', 'Salve e abra o checkout publicado em uma nova sessão.', 'Aceite a medição para validar a instalação com consentimento. Acompanhe a navegação nas ferramentas de tempo real do GA4.', 'Teste a jornada e compare eventos com suas ações. A compra só deve ser enviada após confirmação do pagamento.'],
    details: [{ id: 'eventos', title: 'O que é enviado', items: ['A jornada inclui page_view, view_item, begin_checkout, add_shipping_info, add_payment_info e purchase, conforme as etapas realizadas.', 'No GA4, o valor dos itens considera descontos e exclui o frete; o frete é informado separadamente. O identificador da transação permite relacionar a compra ao pedido.', 'O envio é pelo navegador: consentimento, bloqueadores e fechamento da página podem afetar a medição. Os relatórios do Google não substituem os pedidos da Pirat.'] }],
    verify: ['Confira o fluxo de dados correto no GA4 e use suas ferramentas de diagnóstico para observar os eventos.', 'Teste também recusar a medição: as tags Google não devem ser carregadas nessa condição.'],
    troubleshoot: ['Se não houver eventos, revise o ID, o consentimento, bloqueadores e o modo de instalação.', 'Se escolheu GTM, a instalação direta é substituída. Configure e publique as tags no contêiner, evitando duplicar o GA4.'],
    related: ['google-tag-manager', 'google-ads', 'analises'],
  }),
  article('google-ads', 'integracoes', 'Conversões do Google Ads', 'Registre compras confirmadas na ação de conversão da sua campanha.', {
    integration: 'ads', keywords: 'aw label rótulo campanhas conversão google',
    before: ['Tenha o ID de conversão iniciado por AW- e o rótulo da ação de compra. São dois campos diferentes.', 'Planeje se vai medir a compra diretamente ou importar a conversão do GA4 para evitar contar a mesma venda duas vezes como conversão principal.'],
    steps: ['Abra Marketing → Integrações → Google Ads.', 'No modo direto, informe o ID de conversão e o rótulo correspondentes à ação desejada.', 'Salve e confira as configurações de consentimento no checkout.', 'Acompanhe uma compra de teste autorizada até a confirmação e valide a ação no Google Ads.'],
    verify: ['A conversão de compra deve depender de pagamento confirmado, não apenas de Pix gerado.', 'O valor de conversão do Ads representa o total pago, incluindo frete. Confira o identificador da transação e a moeda.'],
    troubleshoot: ['Sem conversão: confira o par ID/rótulo, o consentimento, bloqueadores e se o pagamento realmente foi confirmado.', 'Contagem duplicada: revise instalações simultâneas e ações principais importadas do GA4. No modo GTM, gerencie as tags no contêiner publicado.'],
    related: ['google-analytics', 'google-tag-manager', 'pedidos'],
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
    related: ['meta-pixel', 'pedidos', 'analises'],
  }),
  article('webhooks', 'integracoes', 'Webhooks e automações', 'Envie eventos da sua loja para um sistema próprio ou uma automação externa.', {
    integration: 'webhooks', keywords: 'api endpoint assinatura hmac sha256 automação payload integração desenvolvedor',
    before: ['Prepare um endpoint HTTPS público capaz de receber POST com JSON. Use uma URL sem credenciais, porta personalizada ou redirecionamento.', 'Webhooks notificam eventos; não são uma API para alterar preços ou criar cobranças. Guarde o segredo de assinatura somente no seu servidor.'],
    steps: ['Abra Gestão → Webhooks e crie um webhook com nome e URL de destino.', 'Selecione os eventos que sua automação precisa receber e defina se o endpoint fica ativo.', 'Informe um segredo válido ou guarde o segredo gerado, exibido uma única vez. Use-o para validar cada entrega.', 'Com o endpoint ativo, use Enviar teste. Confira a entrega no histórico e o recebimento no sistema de destino.', 'Depois, valide um evento real autorizado e trate reenvios para que não executem a mesma ação duas vezes.'],
    details: [
      { id: 'eventos', title: 'Eventos disponíveis', items: ['order.created: novo Pix gerado. order.paid: pagamento confirmado.', 'order.cancelled: pedido cancelado. order.refunded: pedido reembolsado. payment.failed: falha na tentativa de pagamento.', 'Inscrever um evento não habilita por si só uma operação de cancelamento ou reembolso no seu gateway.'] },
      { id: 'assinatura', title: 'Contrato para quem desenvolve', items: ['O corpo contém id, event, createdAt, test e data. O conteúdo de data depende do evento. Confira o payload recebido em seu teste, sem registrar dados pessoais desnecessários.', 'Leia o corpo bruto, antes de converter JSON. Calcule HMAC-SHA256 com o segredo e a mensagem formada pelo timestamp, um ponto e o corpo bruto. Compare em tempo constante com a assinatura recebida.', 'Os nomes dos cabeçalhos preservam o prefixo solid por compatibilidade. Não os renomeie para pirat no seu receptor.', 'Valide a assinatura e a atualidade do timestamp antes de processar. Ignore eventos de teste no fluxo real. Registre o id do evento para impedir ações duplicadas em reenvios.', 'Responda com HTTP 2xx após aceitar com segurança a entrega. Respostas fora dessa faixa e falhas de conexão podem gerar novas tentativas.'], code: 'x-solid-event: order.paid\nx-solid-timestamp: <segundos Unix>\nx-solid-signature: sha256=<HMAC hexadecimal>\n\nMensagem assinada = timestamp + "." + corpoBruto\nAssinatura = "sha256=" + HMAC_SHA256(segredo, mensagem)' },
    ],
    verify: ['Enviar teste coloca a entrega na fila; isso não confirma o recebimento. Confira o status e o código HTTP no histórico.', 'Seu receptor deve reconhecer uma repetição do mesmo evento sem duplicar e-mails, baixas de estoque ou outras ações.'],
    troubleshoot: ['Falha de conexão: confira HTTPS, certificado, endereço e disponibilidade do receptor. Não use localhost ou URL interna.', 'Assinatura inválida: use o segredo correto e os bytes originais do corpo; converter o JSON e serializá-lo novamente muda a mensagem assinada.', 'Uma falha no webhook não significa que o comprador deve pagar outra vez. Confira o pedido e o gateway separadamente.'],
    related: ['pedidos', 'gateways'],
  }),
  article('gateways', 'vendas', 'Configurar o recebimento por Pix', 'Conecte um gateway compatível e valide a confirmação do pagamento.', {
    keywords: 'roas westpay gateway pagamento pix cartão boleto',
    before: ['Tenha uma conta habilitada no provedor e as credenciais exigidas por ele. Consulte as condições comerciais e os prazos diretamente no provedor.', 'A integração atual de pagamento oferece Pix por Roas e WestPay. Outras marcas no catálogo não significam que todos os meios de pagamento estejam implementados.'],
    steps: ['Na loja selecionada, abra Checkout → Gateways.', 'Escolha um provedor compatível e preencha os campos de credenciais exibidos, seguindo as orientações dessa integração.', 'Salve e confira o status apresentado no painel.', 'Abra o checkout publicado, revise os valores e gere um Pix de teste autorizado.', 'Para validar o ciclo completo, acompanhe um pagamento autorizado até a confirmação no provedor e no pedido da Pirat.'],
    verify: ['A geração deve retornar o QR Code ou código de pagamento e criar um pedido pendente.', 'Pagamento confirmado é uma etapa separada. Confira o status da mesma transação no provedor e na Pirat.'],
    troubleshoot: ['Credenciais rejeitadas: revise conta, ambiente e permissões no provedor. Não compartilhe a chave em mensagens.', 'Pagamento feito e pedido pendente: confira a transação no gateway e procure suporte com o identificador do pedido. Não peça um novo pagamento antes de esclarecer o primeiro.', 'O visual de um template não habilita cartão ou boleto. Mostre somente os meios realmente disponíveis à sua loja.'],
    related: ['pedidos', 'publicar', 'webhooks'],
  }),
  article('logistica', 'vendas', 'Configurar entrega e frete', 'Organize os métodos de entrega oferecidos aos seus compradores.', {
    keywords: 'logística frete prazo transportadora entrega físico digital',
    before: ['Defina valores e prazos que sua operação consegue cumprir. Os métodos manuais da Pirat não equivalem à contratação automática de uma transportadora.'],
    steps: ['Abra Checkout → Logística na loja correta.', 'Cadastre o método de entrega com nome, preço e prazos mínimo e máximo, conforme os campos do formulário.', 'Confira se os métodos que deseja oferecer estão ativos.', 'Teste o checkout de um produto físico com um endereço válido e confira as opções exibidas.', 'Revise o valor de frete no resumo antes de gerar o pagamento.'],
    verify: ['O método escolhido deve refletir o valor e o prazo cadastrados. Confira o total com e sem desconto.', 'Produtos digitais corretamente identificados não precisam passar por entrega física.'],
    troubleshoot: ['Sem opção de frete: confira produto físico, endereço preenchido e métodos ativos da loja.', 'Melhor Envio, SuperFrete e Frenet aparecem no catálogo, mas ainda não estão disponíveis para ativação nesta versão. Não espere cotação automática dessas opções.'],
    related: ['produtos', 'publicar'],
  }),
  article('pedidos', 'vendas', 'Pedidos e estados do pagamento', 'Diferencie Pix gerado de venda paga e acompanhe a jornada correta.', {
    keywords: 'pedido pendente pago confirmado cancelado reembolsado status transação',
    before: ['Selecione a loja correspondente à venda. Tenha o identificador do pedido para localizar a transação sem compartilhar dados completos do comprador.'],
    steps: ['Abra Gestão → Pedidos e localize o pedido pelos filtros disponíveis.', 'Abra os detalhes e confira itens, valores, frete e estado do pagamento.', 'Se estiver pendente, confira se o comprador apenas gerou o Pix ou se houve pagamento confirmado no provedor.', 'Para divergências, compare a mesma transação no gateway e na Pirat antes de orientar o cliente.', 'Acompanhe integrações e notificações separadamente: falha em um envio externo não anula um pagamento confirmado.'],
    verify: ['Pendente significa que a confirmação ainda não foi registrada. Pago significa que o sistema recebeu a confirmação do pagamento.', 'Não trate visitas, carrinhos ou cliques no botão como vendas pagas nos seus relatórios.'],
    troubleshoot: ['Se houver divergência, registre o horário e o identificador do pedido e procure suporte. Evite pedir que o comprador refaça o pagamento.', 'Cancelar ou reembolsar depende dos recursos da operação e do provedor; uma notificação de webhook não executa o reembolso por conta própria.'],
    related: ['gateways', 'webhooks', 'analises'],
  }),
  article('analises', 'vendas', 'Análises e carrinhos', 'Leia os números da loja sem confundir intenção de compra com receita.', {
    keywords: 'métricas dashboard faturamento conversão carrinhos abandonados período relatório',
    before: ['Confira a loja e o período selecionados. Resultados de plataformas de anúncios podem usar atribuição e horários diferentes dos pedidos.'],
    steps: ['Abra Gestão → Análises e escolha um período disponível ou um intervalo personalizado.', 'Confira os indicadores e a evolução no gráfico. Use Ver valores por dia para consultar os números em tabela.', 'Compare o resultado com os pedidos do mesmo período e seus estados de pagamento.', 'Abra Carrinhos para acompanhar jornadas que ainda não representam uma compra paga.', 'Use os dados para revisar o checkout e suas campanhas, mantendo separados tráfego, intenção de compra e pagamentos.'],
    verify: ['O filtro personalizado usa datas no horário de Brasília. Compare o mesmo intervalo em outras ferramentas.', 'Trocar de loja ou período deve atualizar os números. Sem pagamentos no período, não há receita a atribuir a um “melhor dia”.'],
    troubleshoot: ['Se a consulta falhar, tente atualizar e observe o aviso antes de usar dados anteriores.', 'Diferenças com pixels podem vir de consentimento, bloqueadores, atribuição ou janela de medição. Para confirmar o recebimento, consulte os pedidos e o gateway.'],
    related: ['pedidos', 'google-analytics', 'utmify'],
  }),
  article('resolver-checkout', 'ajuda', 'Meu checkout não está como esperado', 'Siga uma sequência curta para localizar problemas de publicação ou compra.', {
    keywords: 'erro salvar personalização inválida checkout não abre não funciona não aparece',
    before: ['Tenha o link completo e anote a etapa do problema. Confira qual loja e qual checkout você está editando.'],
    steps: ['Confira se o rascunho foi salvo e se a publicação terminou com sucesso.', 'Verifique o domínio ativo e abra uma nova sessão em janela anônima.', 'Se houver erro ao salvar, revise campos obrigatórios. Oferta de saída ativada exige um cupom selecionado.', 'Se vier da Shopify, confira catálogo, App Proxy, modelo publicado e script no tema ativo.', 'Se a página abrir mas o Pix falhar, confira o gateway. Se apenas o rastreamento falhar, revise a integração e os bloqueadores.', 'Reproduza no computador e no celular para separar problema visual de problema de configuração.'],
    verify: ['Faça uma alteração de cada vez e repita a mesma etapa. Registre se o erro ocorreu no editor, na publicação, no checkout ou no provedor.', 'Uma página carregar corretamente não comprova pagamento ou chegada de eventos de marketing. Confira cada etapa separadamente.'],
    troubleshoot: ['Se precisar de suporte, envie a descrição do problema, horário aproximado e identificador do checkout ou pedido.', 'Em capturas, oculte chaves, senhas e dados pessoais. Nunca envie o token de uma sessão de checkout pública como se fosse apenas o nome do pedido.'],
    related: ['publicar', 'oferta-de-saida', 'shopify', 'gateways'],
  }),
  article('papagaio', 'ajuda', 'Pedir ajuda ao Papagaio da Pirat', 'Use o assistente para esclarecer dúvidas sobre o sistema.', {
    keywords: 'assistente chat gemini ajuda suporte pergunta ia',
    before: ['Entre no painel e abra o Papagaio da Pirat. As orientações respeitam as áreas disponíveis para sua conta.', 'Ele oferece ajuda por texto. Uma resposta não comprova que alterou uma configuração ou consultou uma transação.'],
    steps: ['Explique o que está tentando fazer e em qual tela. Por exemplo: “Já coloquei o código da Shopify no tema; como testo o redirecionamento?”.', 'Inclua o texto do erro quando houver, retirando dados pessoais e credenciais.', 'Leia a orientação e confira os campos reais da tela antes de alterar a configuração.', 'Faça uma pergunta de continuidade se faltar contexto. Use Nova conversa para começar outro assunto.'],
    verify: ['Compare a resposta com o guia correspondente desta central. O assistente pode errar.', 'As mensagens são enviadas ao Gemini para gerar a resposta. A conversa fica na aba e não altera a loja por si só.'],
    troubleshoot: ['Se houver demora ou indisponibilidade, aguarde e tente novamente. A pergunta é preservada para facilitar uma nova tentativa.', 'Para investigar um caso específico de pagamento, use os detalhes do pedido e o suporte. Não envie senhas, tokens ou dados completos de clientes ao chat.'],
    related: ['resolver-checkout', 'shopify'],
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
