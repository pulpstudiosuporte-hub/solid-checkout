// Public integration contracts, checked against cli-routes and webhook-routes.
export const verifyWebhookExample = `import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyPiratWebhook(rawBody, headers, secret, now = Date.now()) {
  if (!Buffer.isBuffer(rawBody) || !secret) throw new Error('Configuração inválida');
  const timestamp = headers['x-solid-timestamp'];
  const signature = headers['x-solid-signature'];
  if (typeof timestamp !== 'string' || !/^\\d{1,12}$/.test(timestamp)) {
    throw new Error('Timestamp inválido');
  }
  // Janela de 5 minutos escolhida por este receptor.
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) {
    throw new Error('Entrega fora da janela');
  }
  if (typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) {
    throw new Error('Assinatura inválida');
  }
  const expected = createHmac('sha256', secret)
    .update(timestamp + '.').update(rawBody).digest();
  const received = Buffer.from(signature.slice(7), 'hex');
  if (!timingSafeEqual(expected, received)) throw new Error('Assinatura inválida');
  const payload = JSON.parse(rawBody.toString('utf8'));
  if (!payload || typeof payload.id !== 'string' || !payload.id ||
      typeof payload.event !== 'string' || typeof payload.test !== 'boolean' ||
      payload.event !== headers['x-solid-event']) {
    throw new Error('Envelope inválido');
  }
  return payload;
}`;

export const developerGuides = [
  ['inicio-rapido', 'fundamentos', 'Comece a desenvolver', 'Escolha o contrato certo para conectar seu sistema ou editar um tema na IDE.', {
    keywords: 'developer desenvolvedor API SDK autenticação CLI integração começo quickstart',
    before: ['Tenha uma loja Pirat e acesso autorizado ao recurso que pretende integrar. A documentação é pública; a autorização da loja ocorre no painel.', 'Existem três caminhos: CLI conectada para temas, webhooks para eventos enviados ao seu servidor e integrações nativas para plataformas suportadas.'],
    steps: ['Para temas, execute o login da CLI e autorize a loja no navegador. Baixe um checkout existente e abra a pasta na IDE.', 'Para eventos, implemente um receptor HTTPS com validação HMAC e cadastre-o em Gestão → Webhooks.', 'Para Shopify ou medição, consulte o guia da integração; respeite os contratos de carrinho e eventos que a Pirat já emite.', 'Valide primeiro em um checkout dedicado a testes. Só publique um tema depois de conferir a prévia e o rascunho.'],
    details: [
      { id: 'comandos', title: 'Primeiros comandos', items: ['Node.js 22.12 ou superior. O pacote é distribuído por URL; não há pacote publicado no registro npm com este nome.'], language: 'shell', code: 'npx --yes --package=https://docs.apirat.io/downloads/pirat-cli-0.1.0.tgz pirat login\nnpx --yes --package=https://docs.apirat.io/downloads/pirat-cli-0.1.0.tgz pirat checkout list\nnpx --yes --package=https://docs.apirat.io/downloads/pirat-cli-0.1.0.tgz pirat checkout pull ID_DO_CHECKOUT minha-loja\ncd minha-loja\nnpm run dev' },
      { id: 'superficies', title: 'O que você pode integrar', items: ['CLI: ler checkouts da loja autorizada, validar configuração, enviar rascunho, publicar com permissão e restaurar versões.', 'Webhooks: receber eventos de pagamentos no seu servidor. O payload atual não contém nome, e-mail ou telefone do comprador.', 'O token da CLI não é uma chave geral de API: não autoriza criar cobranças, consultar clientes, gerenciar produtos ou endpoints internos do painel. Esta documentação não oferece esses endpoints como API pública.'] },
    ],
    verify: ['A CLI identifica a loja correta e a prévia abre localmente. Um envio ao rascunho não altera o checkout publicado.', 'Seu receptor identifica um evento de teste e não o trata como venda real.'],
    troubleshoot: ['Sem autorização: peça ao proprietário ou administrador da loja para aprovar a conexão.', 'Precisa de uma operação fora dos contratos documentados: não use cookies do painel como credencial de integração. Confirme a disponibilidade antes de implementar.'],
    related: ['cli-conectada', 'autenticacao', 'webhooks', 'contrato-temas'],
  }],
  ['autenticacao', 'fundamentos', 'Autenticação e permissões', 'Entenda a autorização da CLI e a assinatura das entregas de webhook.', {
    keywords: 'bearer token escopo expiração revogação HMAC segredo autorização',
    before: ['Credenciais da CLI e segredos de webhook têm finalidades diferentes. Nunca envie esses valores em temas, repositórios, prompts ou código de navegador.'],
    steps: ['Execute login pela CLI. Compare o código exibido no terminal com o código aprovado no painel.', 'Confira a loja e autorize edição de rascunhos. Permissão de publicação é uma escolha separada.', 'Use whoami para conferir a conexão e logout para revogar e remover a credencial local.', 'Para receber webhooks, configure o segredo no servidor de destino e valide a assinatura de cada requisição.'],
    details: [
      { id: 'cli', title: 'Ciclo de autorização da CLI', items: ['O código de autorização expira em 10 minutos. A conexão expira em 30 dias e pertence a um usuário e uma loja.', 'A função de proprietário ou administrador é revalidada nas chamadas. Revogação, expiração ou perda de acesso impedem novos comandos.', 'Configurações → CLI e temas permite consultar e revogar conexões. O token não deve ser copiado da máquina do desenvolvedor para uma integração de pedidos.'] },
      { id: 'webhook', title: 'Autenticidade do webhook', items: ['O segredo é usado em HMAC-SHA256. Ele não é enviado junto com a entrega.', 'O segredo gerado aparece uma única vez no cadastro. Guarde-o em configuração protegida do receptor.', 'A assinatura confirma origem e integridade; idempotência é outra responsabilidade. Armazene o identificador do evento antes de executar ações.'] },
    ],
    verify: ['Revogue uma conexão de teste: os próximos comandos remotos devem pedir novo login.', 'Altere um byte do corpo de teste: a assinatura precisa ser rejeitada.'],
    troubleshoot: ['Código expirado ou consumido: inicie outro login. Não reutilize um código antigo.', 'Acesso ao rascunho funciona e publicação falha: confira a permissão de publicação e as condições de produto, domínio e cadastro da loja.'],
    related: ['cli-conectada', 'webhook-assinatura', 'erros'],
  }],
  ['cli-referencia', 'dev', 'Referência de comandos da CLI', 'Comandos, efeitos, conflitos e arquivos do projeto editável.', {
    keywords: 'CLI npm build validate push publish restore revision conflito comandos',
    before: ['Use a CLI distribuída pela Pirat com Node.js 22.12+. Faça login para comandos remotos.', 'Execute os comandos de projeto dentro da pasta criada por pull. O checkout precisa existir na loja.'],
    steps: ['Liste os checkouts e copie o identificador correto.', 'Baixe para uma pasta nova. O comando recusa sobrescrever uma pasta existente.', 'Edite os módulos, execute a prévia, compile e valide.', 'Envie para o rascunho. Publique o rascunho somente após revisar.'],
    details: [
      { id: 'consulta', title: 'Conexão e download', items: ['Nos exemplos, cli.mjs é o executável do ZIP. Os mesmos argumentos funcionam depois de pirat no comando NPX. list retorna até 100 checkouts não arquivados da loja.'], code: 'node cli.mjs login\nnode cli.mjs whoami\nnode cli.mjs checkout list\nnode cli.mjs checkout pull ID_DO_CHECKOUT minha-loja --template retail\nnode cli.mjs logout' },
      { id: 'projeto', title: 'Comandos dentro do projeto', items: ['dev abre uma prévia local. build gera a configuração. validate usa a API sem salvar. push grava somente o rascunho.', 'publish publica o rascunho já enviado, não as edições locais posteriores. O script inclui --yes; executá-lo é confirmar a publicação.'], code: 'npm run dev\nnpm run build\nnpm run validate\nnpm run push\nnpm run publish' },
      { id: 'historico', title: 'Versões e restauração', items: ['A listagem contém até 100 versões anteriores às mudanças da CLI. Não há histórico retroativo de alterações feitas antes desse recurso.', 'restore grava no rascunho e preserva os arquivos locais. Faça pull em outra pasta antes de continuar.'], code: 'node .pirat/tool/cli.mjs checkout versions\nnode .pirat/tool/cli.mjs checkout restore . ID_DA_VERSAO' },
      { id: 'arquivos', title: 'Contrato dos arquivos locais', items: ['src/theme.mjs exporta a configuração do editor. src/elements.mjs define os blocos. O JavaScript é avaliado na sua máquina e resulta em dados validados.', 'Os comandos mantêm a revisão recebida no download. Uma mudança concorrente no painel ou em outra IDE causa conflito, sem sobrescrita forçada.', 'A validação conectada limita a configuração serializada a 100.000 caracteres. Esse contrato é diferente do kit offline de temas, limitado a 32 KB.'] },
    ],
    verify: ['Compare o rascunho no painel após push. A versão pública só muda com publicação.', 'Mantenha o projeto e as credenciais em locais separados, conforme o padrão da CLI.'],
    troubleshoot: ['Conflito de revisão: faça pull em outra pasta, compare as mudanças e reaplique o que desejar.', 'Campos desconhecidos: remova propriedades que o validador não aceita. O tema não executa código arbitrário no servidor.'],
    related: ['cli-conectada', 'contrato-temas', 'erros'],
  }],
  ['webhook-payload', 'eventos', 'Eventos e payloads', 'Envelope JSON e campos enviados nos eventos de pagamento da Pirat.', {
    keywords: 'payload JSON schema order paid created refunded cancelled payment failed customer email telefone centavos',
    before: ['Cadastre um endpoint para os eventos desejados e valide a assinatura antes de ler os dados.', 'Valores monetários são números inteiros em centavos. totalCents igual a 14990 representa R$ 149,90.'],
    steps: ['Leia id, event, createdAt e test no envelope.', 'Se test for true, valide a integração sem executar ações reais.', 'Use data.order.id para correlacionar o pedido e data.order.paymentId para a tentativa de pagamento.', 'Valide os campos necessários ao seu consumidor e aceite campos adicionais para compatibilidade.'],
    details: [
      { id: 'json', title: 'Exemplo de order.paid', items: ['Identificadores fictícios. O payload de pagamento confirmado contém paidAt, que pode ser nulo. createdAt pertence ao evento, não ao momento de criação do pedido.'], language: 'json', code: JSON.stringify({ id: 'evt_exemplo', event: 'order.paid', createdAt: '2026-09-19T12:00:00.000Z', test: false, data: { order: { id: 'PEDIDO_EXEMPLO', paymentId: 'PAGAMENTO_EXEMPLO', status: 'PAID', totalCents: 14990, currency: 'BRL', paidAt: '2026-09-19T11:59:58.000Z' } } }, null, 2) },
      { id: 'eventos', title: 'Eventos e estados', items: ['order.created: Pix criado, status PENDING. Não confirma recebimento de dinheiro.', 'order.paid: confirmação de pagamento, status PAID.', 'order.cancelled: cancelamento ou expiração, status CANCELLED ou EXPIRED.', 'order.refunded: reembolso total (REFUNDED) ou parcial (PARTIALLY_REFUNDED). No parcial, refundedAmountCents informa o valor acumulado reembolsado em centavos.', 'payment.failed: falha de pagamento. Não interprete esse evento como reembolso.', 'O disparo de teste usa test: true e dados fixos com status PENDING, inclusive quando outro tipo de evento é selecionado. Não infira o contrato de todos os eventos apenas desse teste.'] },
      { id: 'cliente', title: 'Dados não incluídos', items: ['O payload atual não envia nome, e-mail, telefone, CPF, itens nem endereço do comprador. Não são propriedades opcionais habilitadas no webhook.', 'Os webhooks não oferecem um token geral para consultar esses dados depois. Não presuma que a API do gateway ou as rotas autenticadas do painel façam parte deste contrato.', 'Use apenas dados que seu sistema já possui legitimamente e consegue correlacionar; não tente deduzir identidade do comprador pelos identificadores.'] },
    ],
    verify: ['Teste o parser com propriedades extras, campos opcionais ausentes e um reembolso parcial.', 'Confirme que sua rotina de venda roda para order.paid e test: false, após autenticar a entrega.'],
    troubleshoot: ['E-mail ou telefone ausentes: esses dados não são enviados pelo contrato atual.', 'Entrega repetida: deduplique pelo id do evento, preservado nos reenvios. Eventos diferentes do mesmo pedido têm identificadores diferentes.'],
    related: ['webhooks', 'webhook-assinatura', 'webhook-entregas'],
  }],
  ['webhook-assinatura', 'eventos', 'Validar a assinatura do webhook', 'Verificação HMAC-SHA256 em Node.js usando os bytes originais da requisição.', {
    keywords: 'HMAC sha256 Node JavaScript raw body signature timestamp timingSafeEqual segurança',
    before: ['Preserve o corpo bruto em um Buffer antes de qualquer parser JSON. Não use JSON.stringify em um objeto já convertido para calcular a assinatura.', 'Guarde o segredo do endpoint no servidor. O exemplo abaixo é uma função de verificação, não um servidor HTTP nem uma fila de processamento.'],
    steps: ['Leia os cabeçalhos x-solid-timestamp, x-solid-signature e x-solid-event.', 'Calcule o HMAC do timestamp, ponto e bytes originais do corpo, nessa ordem.', 'Compare as assinaturas em tempo constante e valide a idade do timestamp.', 'Só então faça o parse, verifique o envelope e encaminhe a entrega para seu processamento idempotente.'],
    details: [
      { id: 'cabecalhos', title: 'Cabeçalhos e mensagem assinada', items: ['O prefixo solid dos cabeçalhos é parte do contrato. Mantenha-o no receptor.', 'O timestamp é Unix em segundos e é renovado a cada tentativa. A janela de cinco minutos do exemplo é uma escolha do receptor; mantenha o relógio do servidor sincronizado.'], code: 'Content-Type: application/json\nx-solid-event: order.paid\nx-solid-timestamp: <UNIX_EM_SEGUNDOS>\nx-solid-signature: sha256=<HMAC_HEXADECIMAL>\n\nmensagem = timestamp + "." + corpoBruto' },
      { id: 'node', title: 'Verificador em Node.js', items: ['Passe rawBody como Buffer, cabeçalhos com nomes em minúsculas e o segredo configurado. Rejeite a requisição se a função lançar erro.'], language: 'javascript', code: verifyWebhookExample },
      { id: 'processar', title: 'Depois da verificação', items: ['Se payload.test for true, registre apenas o resultado técnico e responda 2xx, sem liberar produtos ou enviar mensagens ao comprador.', 'Para eventos reais, grave o id em armazenamento durável com restrição única e enfileire a ação na mesma transação. Só confirme HTTP 2xx depois dessa gravação.', 'Se o id já estiver armazenado, responda 2xx sem repetir a ação. Uma falha no armazenamento deve retornar erro para permitir nova tentativa.', 'Não use um Set em memória como deduplicação de produção: ele se perde ao reiniciar e não coordena várias instâncias.'] },
    ],
    verify: ['Aceite uma assinatura válida e rejeite corpo alterado, assinatura ausente e timestamp antigo.', 'Repita o mesmo evento depois de reiniciar seu receptor e confirme que a ação não ocorre novamente.'],
    troubleshoot: ['Assinatura divergente: compare segredo, bytes brutos, timestamp textual e presença do ponto separador.', 'Falhas por idade: confira o relógio do servidor e se um proxy está reutilizando a requisição. Não desative a assinatura.'],
    related: ['webhook-payload', 'webhook-entregas', 'autenticacao'],
  }],
  ['webhook-entregas', 'eventos', 'Entregas, reenvios e idempotência', 'Prepare seu receptor para falhas temporárias e entregas repetidas.', {
    keywords: 'retry retries tentativas timeout backoff idempotência duplicação fila ordem entrega',
    before: ['O receptor precisa de HTTPS público. URLs privadas, localhost, credenciais na URL e portas personalizadas não são aceitos.', 'A entrega tem prazo máximo de 10 segundos. Responda depois de persistir o evento e execute trabalho demorado em uma fila.'],
    steps: ['Cadastre o endpoint e selecione os eventos necessários. Há limite de 20 endpoints por loja.', 'Use Enviar teste e confira o histórico da entrega e seu log técnico.', 'Verifique assinatura e persista id com unicidade. Trate duplicatas sem executar o efeito novamente.', 'Monitore falhas e reconcilie os eventos do seu sistema sem depender da ordem de chegada.'],
    details: [
      { id: 'tentativas', title: 'Política de tentativas', items: ['HTTP 2xx confirma a entrega. Timeout, erro de rede e respostas fora de 2xx contam como falha; redirecionamentos não são seguidos.', 'Há até oito tentativas no total. Após falhas, os intervalos mínimos programados são 2, 4, 8, 16, 32, 64 e 128 minutos. A fila pode executar depois desse horário.', 'Na oitava falha, a entrega fica em estado final de falha. Endpoint desativado também interrompe entregas pendentes.', 'O corpo e o id do evento são preservados nas tentativas. O timestamp e a assinatura dos cabeçalhos são gerados novamente.'] },
      { id: 'duplicatas', title: 'Modelo de consumo', items: ['Não há garantia de uma única entrega nem de ordenação entre eventos. Um timeout pode ocorrer após seu servidor já ter aceitado a mensagem.', 'Uma chave única no id do evento evita repetição de notificações, liberação de acesso e outras ações. Mantenha também regras de estado por pedido para eventos fora de ordem.', 'Para reembolso parcial, refundedAmountCents é acumulado. Não some esse valor novamente em cada notificação.'] },
    ],
    verify: ['Retorne um erro temporário em homologação e observe uma nova tentativa com o mesmo id.', 'Simule duas entregas simultâneas do mesmo evento e confirme que apenas uma tarefa foi criada.'],
    troubleshoot: ['Destino recusado: revise HTTPS, DNS público e ausência de porta personalizada.', 'Evento marcado como entregue, ação ausente: confira sua fila e o processamento após o aceite.', 'Não execute cobranças reais só para validar assinatura: o disparo de teste valida o transporte.'],
    related: ['webhooks', 'webhook-assinatura', 'webhook-payload'],
  }],
  ['erros', 'fundamentos', 'Erros e diagnóstico de integrações', 'Interprete falhas da CLI e do receptor sem repetir operações indevidamente.', {
    keywords: '400 401 403 404 409 410 429 INVALID_CONFIG UNKNOWN_FIELDS CONFLICT SCOPE_REQUIRED errors',
    before: ['Identifique a etapa: autorização, validação, envio, publicação ou recebimento de webhook. Não coloque segredos nem payloads pessoais em logs.'],
    steps: ['Guarde o código de erro e o identificador público do recurso quando disponível.', 'Erros de validação exigem corrigir a entrada; repetir o mesmo conteúdo não resolve.', 'Erros de acesso exigem conferir a conexão e as permissões da loja.', 'Em falha de rede durante uma escrita, confira o estado remoto antes de repetir a operação.'],
    details: [
      { id: 'cli', title: 'Códigos da CLI conectada', items: ['401 UNAUTHORIZED: conexão expirada, revogada ou sem acesso. Execute login novamente.', '400 INVALID_CONFIG ou UNKNOWN_FIELDS: configuração inválida ou campo não suportado. Valide antes do envio.', '400 REVISION_REQUIRED: falta a revisão obtida no download. Faça pull.', '403 SCOPE_REQUIRED: a conexão não autoriza publicar. Autorize esse escopo ou publique pelo painel.', '403 STORE_ONBOARDING_REQUIRED: cadastro obrigatório incompleto.', '404 NOT_FOUND ou VERSION_NOT_FOUND: recurso indisponível na loja autorizada.', '409 CONFLICT: o checkout mudou desde o download. Compare em uma pasta nova; não existe force push.', '409 DOMAIN_REQUIRED ou PRODUCT_UNAVAILABLE: confira domínio ativo e produto do checkout.', '410 DEVICE_EXPIRED: código de login expirado ou consumido. 429: limite de requisições; aguarde antes de tentar novamente.'] },
      { id: 'formato', title: 'Formato de erro da API da CLI', items: ['A CLI exibe a mensagem ao usuário. O campo fields pode acompanhar UNKNOWN_FIELDS na validação. Outros serviços podem usar contratos de erro diferentes.'], code: '{\n  "error": {\n    "code": "CONFLICT",\n    "message": "O checkout mudou no painel ou em outra IDE."\n  }\n}' },
    ],
    verify: ['Confirme que tentativas automáticas têm limite e não ignoram conflitos ou falhas de permissão.', 'No webhook, confira primeiro assinatura e persistência do evento; depois investigue os efeitos no seu sistema.'],
    troubleshoot: ['Precisa de ajuda: informe comando, etapa, código de erro e horário. Remova tokens e dados pessoais.', 'Não altere o contrato local para contornar a validação: confirme os campos suportados.'],
    related: ['autenticacao', 'cli-referencia', 'webhook-entregas'],
  }],
];
