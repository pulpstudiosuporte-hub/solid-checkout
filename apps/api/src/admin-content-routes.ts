import { hasPlatformPermission } from './platform-permissions.js';
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { AppEnvironment } from "@solid/config";
import type { PrismaClient } from "@solid/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthRepository, SessionUser } from "./auth-repository.js";
import { createStorePushDispatcher } from "./web-push-service.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const same = (left: string, right: string): boolean => {
  const a = Buffer.from(sha256(left), "hex");
  const b = Buffer.from(sha256(right), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
const failure = (request: FastifyRequest, code: string, message: string) => ({
  error: { code, message, requestId: request.id },
});
const clean = (value: unknown, max: number): string =>
  typeof value === "string"
    ? value.trim().replace(/\0/g, "").slice(0, max)
    : "";
const optionalUrl = (value: unknown): string | null | undefined => {
  const raw = clean(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};
const statuses = ["BACKLOG", "PLANNED", "IN_PROGRESS", "DONE"] as const;
type RoadmapData = { title?: string; description?: string; type?: 'BUG' | 'SUGGESTION'; status?: (typeof statuses)[number]; approved?: boolean };
function roadmapData(body: unknown): RoadmapData {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Informe os dados do roadmap.');
  const input = body as Record<string, unknown>;
  const data: RoadmapData = {};
  for (const [field, min, max] of [['title', 5, 120], ['description', 10, 2000]] as const) {
    if (input[field] === undefined) continue;
    const value = typeof input[field] === 'string' ? input[field].trim().replace(/\0/g, '') : '';
    if (value.length < min || value.length > max) throw new Error(`${field === 'title' ? 'Título' : 'Descrição'} deve ter entre ${min} e ${max} caracteres.`);
    data[field] = value;
  }
  if (input.type !== undefined) {
    if (input.type !== 'BUG' && input.type !== 'SUGGESTION') throw new Error('Tipo inválido.');
    data.type = input.type;
  }
  if (input.status !== undefined) {
    if (!statuses.includes(input.status as (typeof statuses)[number])) throw new Error('Status inválido.');
    data.status = input.status as (typeof statuses)[number];
  }
  if (input.approved !== undefined) {
    if (typeof input.approved !== 'boolean') throw new Error('Visibilidade inválida.');
    data.approved = input.approved;
  }
  if (!Object.keys(data).length) throw new Error('Nenhuma alteração informada.');
  return data;
}
const categories = [
  "NEWS",
  "IMPROVEMENT",
  "FIX",
  "INTEGRATION",
  "SECURITY",
] as const;
const automaticReleases = [
  {
    publicId: 'auto-20260918-checkout-ai-conversation',
    category: 'IMPROVEMENT' as const,
    title: 'Crie seu checkout numa conversa com o papagaio',
    description: 'O Criar com IA agora conduz uma conversa, uma pergunta por vez, sobre marca, cores, imagens e recursos. Revise respostas anteriores, confira a prévia e peça ajustes antes de salvar o rascunho no editor.',
    publishedAt: new Date('2026-09-18T23:30:00.000Z'),
  },
  {
    publicId: 'auto-20260918-public-documentation',
    category: 'NEWS' as const,
    title: 'Seu manual de bordo agora é público',
    description: 'A documentação da Pirat reúne guias de checkout, criação com IA, integrações, pagamentos e entrega, com busca por assunto, passos de configuração e soluções para dúvidas comuns. Acesse Documentação no menu do painel e compartilhe os guias sem exigir login.',
    publishedAt: new Date('2026-09-18T23:20:00.000Z'),
  },
  {
    publicId: 'auto-20260918-checkout-ai-studio-entry',
    category: 'IMPROVEMENT' as const,
    title: 'Um novo destaque para criar com IA',
    description: 'O estúdio de IA ganhou um painel com a identidade da Pirat e acesso destacado na página de checkouts, adaptado ao computador e ao celular. A prévia também passa a ocultar a etapa de entrega para produtos digitais identificados.',
    publishedAt: new Date('2026-09-18T23:10:00.000Z'),
  },
  {
    publicId: 'auto-20260918-checkout-models-guided',
    category: 'IMPROVEMENT' as const,
    title: 'Mais estruturas para personalizar seu checkout',
    description: 'Escolha os modelos Varejo ou Marketplace no editor e na criação com IA. Defina sua marca, envie logo e banners, escolha o formato das etapas e ative avisos de compras reais. Confira a prévia no computador e no celular antes de salvar o rascunho.',
    publishedAt: new Date('2026-09-18T23:00:00.000Z'),
  },
  {
    publicId: 'auto-20260918-checkout-ai-recovery',
    category: 'FIX' as const,
    title: 'Recuperação automática na criação com IA',
    description: 'O criador tenta novamente quando a IA demora ou enfrenta uma falha temporária. Se ainda não conseguir, sua ideia e a prévia anterior continuam disponíveis para você retomar.',
    publishedAt: new Date('2026-09-18T22:05:00.000Z'),
  },
  {
    publicId: 'auto-20260918-checkout-ai-builder',
    category: 'NEWS' as const,
    title: 'Crie seu checkout com IA',
    description: 'Descreva sua ideia e gere uma prévia com cores, fontes e textos. Você pode enviar uma referência visual temporária, incluir depoimentos reais e pedir ajustes. Salve como rascunho para finalizar no editor; a publicação continua sob seu controle.',
    publishedAt: new Date('2026-09-18T22:00:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-assistant-permissions',
    category: 'SECURITY' as const,
    title: 'Ajuda do papagaio conforme seu acesso',
    description: 'Sugestões e orientações administrativas agora respeitam as permissões da conta. O assistente bloqueia pedidos identificados de informações internas e traz instruções revisadas para ativar o checkout na Shopify.',
    publishedAt: new Date('2026-09-18T21:00:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-assistant-recovery',
    category: 'FIX' as const,
    title: 'Mais estabilidade nas respostas do papagaio',
    description: 'O assistente tenta novamente quando a IA enfrenta uma falha temporária. Os avisos agora distinguem demora, indisponibilidade e limite de uso, mantendo sua pergunta para tentar de novo.',
    publishedAt: new Date('2026-09-18T19:40:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-assistant',
    category: 'NEWS' as const,
    title: 'Um papagaio para tirar suas dúvidas',
    description: 'Converse por texto com o assistente da Pirat sobre os recursos do painel. O papagaio acompanha a conversa com novas expressões, nos temas claro e escuro. As respostas usam IA e não alteram configurações nem pedidos da sua loja.',
    publishedAt: new Date('2026-09-18T20:00:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-panel-domain',
    category: 'IMPROVEMENT' as const,
    title: 'Novo endereço do painel Pirat',
    description: 'Acesse seu painel em app.apirat.io, com conexão segura e os mesmos dados da sua loja. O endereço anterior continua disponível durante a transição.',
    publishedAt: new Date('2026-09-18T18:15:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-tablet-layout',
    category: 'FIX' as const,
    title: 'Painel mais confortável no celular e tablet',
    description: 'O painel aproveita toda a largura em tablets, sem faixa vazia na lateral. No celular, a busca ganhou uma barra maior e resultados em tela cheia, com mais espaço para ler e tocar.',
    publishedAt: new Date('2026-09-18T17:30:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-dark-mode',
    category: 'IMPROVEMENT' as const,
    title: 'Seu painel, claro ou escuro',
    description: 'Alterne entre os modos claro e escuro no login, no painel e no editor. Sua preferência fica salva neste navegador, com cores adaptadas para leitura. A aparência dos checkouts da sua loja continua como você configurou.',
    publishedAt: new Date('2026-09-18T17:20:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-site-identity',
    category: 'IMPROVEMENT' as const,
    title: 'O site também está de cara nova',
    description: 'Conheça a apresentação da Pirat, com novas cores, tipografia e o papagaio da marca. Explore os recursos e a demonstração do checkout no computador ou no celular.',
    publishedAt: new Date('2026-09-18T17:00:00.000Z'),
  },
  {
    publicId: 'auto-20260918-pirat-app-identity',
    category: 'IMPROVEMENT' as const,
    title: 'Uma nova identidade: Pirat Checkout',
    description: 'Login e painel ganham a marca Pirat, com o papagaio, novas cores e tipografia. A navegação e as configurações das suas lojas continuam no mesmo lugar.',
    publishedAt: new Date('2026-09-18T12:00:00.000Z'),
  },
  {
    publicId: 'auto-20260912-meta-browser-pixel',
    category: 'FIX' as const,
    title: 'Pixel da Meta com configuração simplificada',
    description: 'Ative o Pixel em todos os checkouts da loja usando apenas o ID. O token é opcional, sem teste obrigatório. Corrigimos o bloqueio do script e melhoramos o carregamento dos eventos de navegação e pagamento.',
    publishedAt: new Date('2026-09-12T21:00:00.000Z'),
  },
  {
    publicId: 'auto-20260912-meta-connection-validation',
    category: 'FIX' as const,
    title: 'Validação da conexão com a Meta mais clara',
    description: 'Conecte o Pixel com validação por Eventos de teste e mensagens específicas para token, permissões e indisponibilidade da Meta.',
    publishedAt: new Date('2026-09-12T20:00:00.000Z'),
  },
  {
    publicId: "auto-20260912-full-support-administrators",
    category: "IMPROVEMENT" as const,
    title: "Acesso completo de suporte e gestão de administradores",
    description: "Administradores podem gerenciar as configurações e operações da loja durante o suporte e adicionar ou remover outros administradores em Equipe e permissões. A confirmação usa a senha do operador e mantém o histórico de acessos e alterações.",
    publishedAt: new Date("2026-09-12T19:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-exit-offer-pointer-detection",
    category: "FIX" as const,
    title: "Detecção de saída mais consistente",
    description: "A oferta agora reconhece o mouse mesmo quando ele já está perto do Voltar. Ao chegar antes do tempo mínimo, o popup aguarda esse prazo enquanto o cursor permanecer nessa região, mantendo o limite de uma exibição por sessão.",
    publishedAt: new Date("2026-09-12T18:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-exit-offer-back-approach",
    category: "IMPROVEMENT" as const,
    title: "Oferta antecipada ao aproximar do Voltar",
    description: "O popup de desconto agora detecta a aproximação do mouse ao canto superior esquerdo do checkout, em direção ao botão Voltar. O disparo acontece antes de sair da página e mantém o prazo configurado e o limite de uma oferta por sessão.",
    publishedAt: new Date("2026-09-12T17:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-support-entry-validation",
    category: "FIX" as const,
    title: "Orientações no acesso de suporte",
    description: "A entrada de suporte agora informa o que falta preencher no motivo, na senha e no código do autenticador. Mensagens de falha ficam visíveis e permitem corrigir os dados antes de tentar novamente.",
    publishedAt: new Date("2026-09-12T14:30:00.000Z"),
  },
  {
    publicId: "auto-20260912-exit-offer-coupon-validation",
    category: "FIX" as const,
    title: "Orientação ao ativar a oferta de saída",
    description: "Ao ativar a oferta sem selecionar um cupom, o editor agora indica o campo pendente antes de salvar ou publicar. Suas alterações ficam preservadas enquanto você escolhe o desconto.",
    publishedAt: new Date("2026-09-12T14:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-exit-offer-timer",
    category: "IMPROVEMENT" as const,
    title: "Oferta de desconto também por tempo",
    description: "O popup de desconto agora pode abrir automaticamente após o prazo definido na personalização, no computador e no celular. A aproximação do mouse ao topo também pode acionar a oferta, sem exigir um clique antes, mantendo uma exibição por sessão.",
    publishedAt: new Date("2026-09-12T12:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-marketing-site",
    category: "NEWS" as const,
    title: "Conheça o site da SOLID",
    description: "Uma nova apresentação da SOLID, com demonstração interativa do checkout, recursos da plataforma, integrações e respostas às dúvidas mais comuns.",
    publishedAt: new Date("2026-09-12T05:10:00.000Z"),
  },
  {
    publicId: "auto-20260912-checkout-steps",
    category: "IMPROVEMENT" as const,
    title: "Etapas alinhadas ao formulário",
    description: "Os indicadores de etapas agora ficam na coluna do formulário, com o resumo do pedido separado e alinhado mais acima. A prévia da personalização acompanha o novo layout no computador e no celular.",
    publishedAt: new Date("2026-09-12T05:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-exit-offer",
    category: "IMPROVEMENT" as const,
    title: "Oferta de saída no checkout",
    description: "Personalize um popup com cupom para recuperar compradores que demonstram intenção de sair. Ajuste textos, cores e exibição no celular, com prévia e contagem da validade real do desconto.",
    publishedAt: new Date("2026-09-12T04:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-support-roles",
    category: "SECURITY" as const,
    title: "Suporte com acesso controlado",
    description: "A equipe SOLID agora pode ajudar na dashboard por acessos temporários de consulta ou manutenção, com motivo e histórico das ações. Novos perfis definem as permissões da equipe técnica e de compliance.",
    publishedAt: new Date("2026-09-12T03:00:00.000Z"),
  },
  {
    publicId: "auto-20260912-globe-3d",
    category: "IMPROVEMENT" as const,
    title: "Seu alcance em um globo 3D",
    description: "Explore as localizações das visitas em um globo interativo no Início e em Análises. Selecione uma cidade ou região, pause a rotação e volte ao Brasil com um toque. O mapa plano continua disponível, e a localização permanece aproximada por IP.",
    publishedAt: new Date("2026-09-12T01:00:00.000Z"),
  },
  {
    publicId: "auto-20260911-geography",
    category: "FIX" as const,
    title: "Pontos do mapa geográfico corrigidos",
    description: "Os marcadores agora seguem a mesma projeção dos continentes, no computador e no celular. Localizações sem coordenadas válidas deixam de receber pontos artificiais, e a lista de cidades e regiões volta a aparecer no alcance geográfico. A localização continua sendo aproximada por IP.",
    publishedAt: new Date("2026-09-12T00:00:00.000Z"),
  },
  {
    publicId: "auto-20260911-roadmap",
    category: "IMPROVEMENT" as const,
    title: "Roadmap com gestão completa",
    description: "A administração agora pode criar e editar itens do roadmap, organizar o que está aguardando, planejado, em andamento ou concluído e escolher o que fica visível para os lojistas.",
    publishedAt: new Date("2026-09-11T23:15:00.000Z"),
  },
  {
    publicId: "auto-20260911-analytics",
    category: "IMPROVEMENT" as const,
    title: "Análises com filtros mais úteis",
    description:
      "Escolha um período personalizado de até 366 dias, consulte a receita e os pedidos pagos por dia e acompanhe os indicadores com uma leitura melhor no celular. A troca de loja e de período limpa os dados anteriores, e falhas de carregamento permitem tentar novamente.",
    publishedAt: new Date("2026-09-11T23:00:00.000Z"),
  },
  {
    publicId: "auto-20260911-google",
    category: "INTEGRATION" as const,
    title: "Google conectado à sua loja",
    description:
      "Configure o GA4, o Google Ads ou o Tag Manager em Integrações para acompanhar visitas e compras do checkout na sua conta Google. As configurações ficam separadas por loja, e gerar um Pix não é contado como compra. A administração também pode personalizar as imagens dessas integrações.",
    publishedAt: new Date("2026-09-11T22:24:00.000Z"),
  },
  {
    publicId: "auto-20260911-tracking-fixes",
    category: "FIX" as const,
    title: "Webhooks e ChromaSense mais consistentes",
    description:
      "O histórico de webhooks mostra as tentativas e falhas de envio com mais clareza. O ChromaSense ganhou correções na profundidade de rolagem, nos filtros e no isolamento das visitas entre checkouts. A prévia do mapa de calor continua sendo uma aproximação do layout atual.",
    publishedAt: new Date("2026-09-11T22:23:00.000Z"),
  },
  {
    publicId: "auto-20260903-payment-actions-aligned",
    category: "FIX" as const,
    title: "Ações de pagamento alinhadas",
    description:
      "Os botões Voltar e Gerar Pix agora ocupam colunas iguais e mantêm exatamente a mesma altura no desktop e no celular.",
    publishedAt: new Date("2026-09-03T23:00:00.000Z"),
  },
  {
    publicId: "auto-20260903-payment-data-preserved",
    category: "FIX" as const,
    title: "Pagamento preserva os dados de entrega",
    description:
      "Corrigimos a confirmação do CPF para manter o endereço e a forma de entrega já escolhidos. Quando alguma informação realmente estiver pendente, o checkout agora indica exatamente qual dado precisa ser confirmado antes de gerar o Pix.",
    publishedAt: new Date("2026-09-03T22:30:00.000Z"),
  },
  {
    publicId: "auto-20260903-direct-checkout-payment-layout",
    category: "IMPROVEMENT" as const,
    title: "Pagamento refinado nos links diretos",
    description:
      "O checkout de link direto ganhou uma etapa de pagamento mais compacta e equilibrada. Pix, ofertas adicionais, CPF e ações agora seguem uma hierarquia mais clara no desktop e no celular, sem alterar a experiência já otimizada da Shopify.",
    publishedAt: new Date("2026-09-03T21:00:00.000Z"),
  },
  {
    publicId: "auto-20260903-checkout-visual-rhythm",
    category: "IMPROVEMENT" as const,
    title: "Checkout com nova régua visual",
    description:
      "As etapas de entrega e pagamento agora compartilham a mesma largura, hierarquia e espaçamento. Campos, fretes, ofertas, CPF, ações e resumo do pedido também foram refinados para oferecer leitura mais clara, melhor equilíbrio no desktop e uma experiência compacta e confortável no celular.",
    publishedAt: new Date("2026-09-03T19:30:00.000Z"),
  },
  {
    publicId: "auto-20260903-premium-checkout-flow",
    category: "IMPROVEMENT" as const,
    title: "Entrega e pagamento com uma jornada mais clara",
    description:
      "O checkout agora revela as formas de entrega somente depois da validação do endereço, mantém o resumo do pedido visível durante a rolagem no desktop e apresenta o Pix em experiências próprias para computador e celular. A etapa de pagamento também ganhou ofertas mais completas e coleta limpa do CPF apenas antes de gerar o Pix.",
    publishedAt: new Date("2026-09-03T17:30:00.000Z"),
  },
  {
    publicId: "auto-20260903-checkout-flow",
    category: "IMPROVEMENT" as const,
    title: "Checkout mais rápido e logística pronta",
    description:
      "O preenchimento do checkout ficou mais fluido com sugestões de e-mail, telefone brasileiro validado e CPF solicitado somente antes do pagamento. As sessões agora permanecem válidas por pelo menos 30 minutos, pedidos pendentes exibem o PIX copia e cola em tempo real e a logística ganhou modelos visuais para Full, PAC e Sedex.",
    publishedAt: new Date("2026-09-03T12:00:00.000Z"),
  },
  {
    publicId: "auto-20260902-optional-gateway-mfa",
    category: "IMPROVEMENT" as const,
    title: "Integrações sem 2FA obrigatório",
    description:
      "Conectar e administrar gateways não exige mais ativar o aplicativo autenticador. O segundo fator continua disponível como uma proteção opcional e recomendada para a conta.",
    publishedAt: new Date("2026-09-02T21:30:00.000Z"),
  },
  {
    publicId: "auto-20260902-testimonial-avatar",
    category: "IMPROVEMENT" as const,
    title: "Depoimentos com visual mais autêntico",
    description:
      "Fotos enviadas nos elementos de depoimento e avaliações agora são otimizadas e exibidas como avatares circulares, com enquadramento consistente na personalização, no celular e no checkout publicado.",
    publishedAt: new Date("2026-09-02T20:00:00.000Z"),
  },
  {
    publicId: "auto-20260902-checkout-seo",
    category: "IMPROVEMENT" as const,
    title: "SEO e identidade do checkout",
    description:
      "A personalização agora permite definir o título da aba, a descrição para buscadores e um favicon próprio para cada checkout. Também corrigimos a publicação de blocos de texto que usam somente título ou somente descrição.",
    publishedAt: new Date("2026-09-02T18:30:00.000Z"),
  },
  {
    publicId: "auto-20260902-checkout-text-element",
    category: "IMPROVEMENT" as const,
    title: "Novo elemento de texto no checkout",
    description:
      "O editor ganhou um bloco de texto que pode ser usado na faixa superior, no conteúdo principal ou abaixo do resumo lateral. Título e descrição têm cores, tamanhos, peso, altura de linha, alinhamento, fundo e espaçamento próprios, com o mesmo resultado na prévia e no checkout publicado.",
    publishedAt: new Date("2026-09-02T16:00:00.000Z"),
  },
  {
    publicId: "auto-20260902-checkout-footer",
    category: "IMPROVEMENT" as const,
    title: "Rodapé avançado no checkout",
    description:
      "O rodapé agora permite escolher cores, alinhamento, espaçamento e organização. Também é possível selecionar formas de pagamento, informar dados da empresa, exibir selo de segurança e controlar os links legais, com o mesmo resultado na personalização e no checkout publicado.",
    publishedAt: new Date("2026-09-02T14:30:00.000Z"),
  },
  {
    publicId: "auto-20260902-checkout-publish",
    category: "FIX" as const,
    title: "Publicação do checkout corrigida",
    description:
      "Corrigimos a validação do estilo de etapas com ícones. Personalizações que usam “Ícones com contorno” agora são salvas e publicadas normalmente.",
    publishedAt: new Date("2026-09-02T12:00:00.000Z"),
  },
  {
    publicId: "auto-20260902-full-audit",
    category: "SECURITY" as const,
    title: "Revisão completa de estabilidade e segurança",
    description:
      "Revalidamos a plataforma com análise estática, auditoria de dependências, 144 testes e build completo. Corrigimos respostas HTTP inválidas, preservamos os cabeçalhos de segurança junto ao cache e tornamos a publicação automática das novidades mais resiliente.",
    publishedAt: new Date("2026-09-02T04:15:00.000Z"),
  },
  {
    publicId: "auto-20260902-domain-checkout-guard",
    category: "SECURITY" as const,
    title: "Domínio obrigatório e checkout Shopify mais estável",
    description:
      "A SOLID agora exige um domínio ativo antes de criar, publicar ou abrir sessões de checkout. A configuração de domínio ganhou instruções mais claras e verificação automática do CNAME a cada 15 segundos. Também corrigimos carrinhos Shopify com vários produtos, removemos a autenticação administrativa da página pública e liberamos o beacon oficial de métricas da Cloudflare na política de segurança.",
    publishedAt: new Date("2026-09-02T03:20:00.000Z"),
  },
  {
    publicId: "auto-20260902-shopify-theme-code",
    category: "FIX" as const,
    title: "Ativação da Shopify explicada no tutorial",
    description:
      "O tutorial agora destaca que apps próprios não aparecem em Incorporações de apps e mostra, com o código pronto para copiar, como ativar a ponte da SOLID em layout/theme.liquid.",
    publishedAt: new Date("2026-09-02T01:15:00.000Z"),
  },
  {
    publicId: "auto-20260902-checkout-modes",
    category: "IMPROVEMENT" as const,
    title: "Checkout automático da Shopify e links para infoprodutos",
    description:
      "Agora você escolhe entre um modelo único que recebe o carrinho real da Shopify ou um link independente vinculado a um infoproduto. O tutorial também ganhou a jornada completa de criação do app, proxy, sincronização, personalização e ativação no tema.",
    publishedAt: new Date("2026-09-02T00:30:00.000Z"),
  },
  {
    publicId: "auto-20260901-shopify-menu",
    category: "FIX" as const,
    title: "Tutorial Shopify com os menus corretos",
    description:
      "O passo a passo agora separa claramente as telas do Dev Dashboard: permissões em Versões, instalação em Início e ID do cliente e chave secreta em Configurações → Credenciais.",
    publishedAt: new Date("2026-09-01T23:45:00.000Z"),
  },
  {
    publicId: "auto-20260901-shopify-guide",
    category: "INTEGRATION" as const,
    title: "Conexão Shopify com app próprio e renovação automática",
    description:
      "O tutorial agora ensina cada lojista a criar e instalar seu próprio app no Dev Dashboard, liberar somente produtos e pedidos, conectar Client ID e Client secret com criptografia e sincronizar o catálogo. Os tokens de 24 horas são renovados automaticamente pela SOLID.",
    publishedAt: new Date("2026-09-01T23:30:00.000Z"),
  },
  {
    publicId: "auto-20260901-first-store",
    category: "IMPROVEMENT" as const,
    title: "Primeira loja criada por você",
    description:
      "Novas contas agora começam sem uma loja automática. Após confirmar o e-mail, cada pessoa escolhe o nome da primeira operação em uma etapa guiada, com um novo seletor de lojas mais claro e compacto.",
    publishedAt: new Date("2026-09-01T22:45:00.000Z"),
  },
  {
    publicId: "auto-20260901-domain-mfa",
    category: "IMPROVEMENT" as const,
    title: "Domínios sem autenticação em duas etapas obrigatória",
    description:
      "Adicionar, validar, trocar e remover o domínio do checkout não exige mais ativar o aplicativo autenticador. O segundo fator continua disponível como proteção opcional da conta.",
    publishedAt: new Date("2026-09-01T22:15:00.000Z"),
  },
  {
    publicId: "auto-20260901-social-proof",
    category: "IMPROVEMENT" as const,
    title: "Prova social com vendas confirmadas",
    description:
      "A nova área de Escassez permite ativar notificações de compra no checkout, personalizar posição, intervalo e aparência. No checkout publicado, os avisos usam somente pagamentos reais e dados anonimizados.",
    publishedAt: new Date("2026-09-01T21:30:00.000Z"),
  },
  {
    publicId: "auto-20260901-admin-testing",
    category: "IMPROVEMENT" as const,
    title: "Testes administrativos sem cadastro comercial",
    description:
      "Administradores da plataforma agora podem criar, publicar e testar checkouts em suas próprias lojas sem preencher dados comerciais. As exigências de ativação continuam válidas para as contas dos lojistas.",
    publishedAt: new Date("2026-09-01T20:45:00.000Z"),
  },
  {
    publicId: "auto-20260901-hardening",
    category: "SECURITY" as const,
    title: "Cadastro e análises mais seguros",
    description:
      "Dados cadastrais sensíveis agora usam criptografia, a ativação da loja é revalidada antes de publicar ou cobrar e o ChromaSense ganhou visitas mais precisas e coleta com privacidade reforçada.",
    publishedAt: new Date("2026-09-01T20:30:00.000Z"),
  },
  {
    publicId: "auto-20260901-integrations-ui",
    category: "IMPROVEMENT" as const,
    title: "Novo diretório de integrações",
    description:
      "A central de integrações ganhou busca, filtro por categoria, status de conexão e ações mais claras para configurar ou gerenciar cada serviço.",
    publishedAt: new Date("2026-09-01T19:15:00.000Z"),
  },
  {
    publicId: "auto-20260901-home-alert",
    category: "IMPROVEMENT" as const,
    title: "Pendências de ativação agora visíveis no Início",
    description:
      "O aviso de cadastro pendente foi centralizado na tela principal, com contagem atualizada das informações necessárias para ativar a loja.",
    publishedAt: new Date("2026-09-01T18:45:00.000Z"),
  },
  {
    publicId: "auto-20260901-semgrep-review",
    category: "SECURITY" as const,
    title: "Nova revisão automatizada de segurança",
    description:
      "Executamos uma nova análise estática completa com Semgrep e revalidamos as proteções de código e da cadeia de build do painel.",
    publishedAt: new Date("2026-09-01T18:15:00.000Z"),
  },
  {
    publicId: "auto-20260901-onboarding",
    category: "IMPROVEMENT" as const,
    title: "Ativação guiada da loja",
    description:
      "Novas contas podem explorar o painel após verificar o e-mail e recebem um checklist para concluir o cadastro antes de publicar checkouts e processar pagamentos.",
    publishedAt: new Date("2026-09-01T17:30:00.000Z"),
  },
  {
    publicId: "auto-20260901-settings",
    category: "IMPROVEMENT" as const,
    title: "Central de configurações renovada",
    description:
      "Dados da loja e do responsável, domínios, usuários, segurança e preferências de notificações agora ficam reunidos em uma central completa.",
    publishedAt: new Date("2026-09-01T12:45:00.000Z"),
  },
  {
    publicId: "auto-20260831-integrations",
    category: "NEWS" as const,
    title: "Catálogo de integrações renovado",
    description:
      "Agora você encontra, pesquisa e gerencia integrações e gateways em uma central organizada.",
    publishedAt: new Date("2026-08-31T21:00:00.000Z"),
  },
  {
    publicId: "auto-20260831-search",
    category: "IMPROVEMENT" as const,
    title: "Busca avançada no painel",
    description:
      "Use Ctrl K para encontrar páginas, recursos e ações por nome ou palavras relacionadas.",
    publishedAt: new Date("2026-08-31T20:00:00.000Z"),
  },
  {
    publicId: "auto-20260831-checkout",
    category: "IMPROVEMENT" as const,
    title: "Checkout responsivo e personalizável",
    description:
      "Novos controles visuais, elementos editáveis e melhorias de compatibilidade para checkouts publicados.",
    publishedAt: new Date("2026-08-31T19:00:00.000Z"),
  },
  {
    publicId: "auto-20260831-gateway",
    category: "INTEGRATION" as const,
    title: "Prioridade e contingência de gateways",
    description:
      "Defina o gateway principal e organize alternativas para manter os pagamentos disponíveis.",
    publishedAt: new Date("2026-08-31T18:00:00.000Z"),
  },
  {
    publicId: "auto-20260830-webhooks",
    category: "INTEGRATION" as const,
    title: "Webhooks duráveis por loja",
    description:
      "Envie eventos de pedidos para sistemas externos com assinatura, tentativas e histórico de entrega.",
    publishedAt: new Date("2026-08-30T22:00:00.000Z"),
  },
  {
    publicId: "auto-20260830-security",
    category: "SECURITY" as const,
    title: "Proteções de conta ampliadas",
    description:
      "Fluxos de recuperação, sessão protegida e verificações adicionais para ações sensíveis.",
    publishedAt: new Date("2026-08-30T21:00:00.000Z"),
  },
];
const releaseSelect = {
  publicId: true,
  category: true,
  title: true,
  description: true,
  imageUrl: true,
  videoUrl: true,
  published: true,
  publishedAt: true,
} as const;
const withReleaseSource = <T extends { publicId: string }>(
  item: T,
): T & { automatic: boolean } => ({
  ...item,
  automatic: item.publicId.startsWith("auto-"),
});
const destinations = [
  "Início",
  "Novidades",
  "Análises",
  "Pedidos",
  "Carrinhos",
  "Produtos",
  "Integrações",
  "Webhooks",
] as const;

export function registerAdminContentRoutes(
  app: FastifyInstance,
  environment: AppEnvironment,
  auth: AuthRepository,
  db: PrismaClient,
): void {
  const push = createStorePushDispatcher(environment, db, app.log);
  const secure = environment.NODE_ENV === "production";
  const sessionCookie = secure ? "__Host-solid_session" : "solid_session";
  const csrfCookie = secure ? "__Host-solid_csrf" : "solid_csrf";
  const session = async (
    request: FastifyRequest,
  ): Promise<SessionUser | null> => {
    const token = request.cookies[sessionCookie];
    return token ? auth.findActiveSession(sha256(token), new Date()) : null;
  };
  const admin = async (
    request: FastifyRequest,
  ): Promise<SessionUser | null> => {
    const current = await session(request);
    return current && !current.support && hasPlatformPermission(current.user, 'content.manage') ? current : null;
  };
  const mutationAllowed = (
    request: FastifyRequest,
    current: SessionUser,
  ): boolean => {
    const origin = request.headers.origin;
    const header = request.headers["x-csrf-token"];
    const cookie = request.cookies[csrfCookie];
    return (
      typeof origin === "string" &&
      environment.CORS_ORIGINS.includes(origin) &&
      typeof header === "string" &&
      Boolean(cookie) &&
      same(cookie!, header) &&
      same(sha256(header), current.csrfTokenHash)
    );
  };
  const ensureAutomaticReleases = async (): Promise<void> => {
    const results = await Promise.allSettled(
      automaticReleases.map((release) => {
        const publicId =
          release.publicId.length <= 32
            ? release.publicId
            : `${release.publicId.slice(0, 23)}-${sha256(release.publicId).slice(0, 8)}`;
        return db.productRelease.upsert({
          where: { publicId },
          create: { ...release, publicId, published: true },
          update: {},
        });
      }),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected")
        app.log.error(
          { err: result.reason, publicId: automaticReleases[index]?.publicId },
          "automatic_release_upsert_failed",
        );
    });
  };

  app.get("/platform-content", async (request, reply) => {
    if (!(await session(request)))
      return reply
        .code(401)
        .send(failure(request, "UNAUTHENTICATED", "Autenticação necessária."));
    if (!request.supportSession) await ensureAutomaticReleases();
    const [releases, assets] = await Promise.all([
      db.productRelease.findMany({
        where: { published: true },
        orderBy: { publishedAt: "desc" },
        take: 50,
        select: releaseSelect,
      }),
      db.integrationCatalogAsset.findMany({
        select: { integrationKey: true, imageUrl: true, altText: true },
      }),
    ]);
    return reply
      .header("cache-control", "private, no-store")
      .send({
        releases: releases.map(withReleaseSource),
        integrationAssets: assets,
      });
  });

  app.get("/admin/content", async (request, reply) => {
    if (!(await admin(request)))
      return reply
        .code(403)
        .send(
          failure(request, "FORBIDDEN", "Acesso administrativo necessário."),
        );
    await ensureAutomaticReleases();
    const [feedback, releases, assets] = await Promise.all([
      db.productFeedback.findMany({
        orderBy: [
          { approved: "asc" },
          { status: "asc" },
          { createdAt: "desc" },
        ],
        take: 200,
        select: {
          publicId: true,
          type: true,
          status: true,
          approved: true,
          title: true,
          description: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          store: { select: { name: true } },
          _count: { select: { votes: true } },
        },
      }),
      db.productRelease.findMany({
        orderBy: { publishedAt: "desc" },
        take: 100,
        select: releaseSelect,
      }),
      db.integrationCatalogAsset.findMany({
        orderBy: { integrationKey: "asc" },
        select: {
          integrationKey: true,
          imageUrl: true,
          altText: true,
          updatedAt: true,
        },
      }),
    ]);
    return reply
      .header("cache-control", "private, no-store")
      .send({
        feedback: feedback.map((item) => ({
          ...item,
          author: item.user.name,
          email: item.user.email,
          store: item.store?.name ?? "Sem loja",
          votes: item._count.votes,
          user: undefined,
          _count: undefined,
        })),
        releases: releases.map(withReleaseSource),
        integrationAssets: assets,
      });
  });

  app.post<{ Body: unknown }>("/admin/content/feedback", async (request, reply) => {
    const current = await admin(request);
    if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, "FORBIDDEN", "Acesso negado."));
    let data: RoadmapData;
    try { data = roadmapData(request.body); }
    catch (error) { return reply.code(400).send(failure(request, "VALIDATION_ERROR", (error as Error).message)); }
    if (!data.title || !data.description) return reply.code(400).send(failure(request, "VALIDATION_ERROR", "Informe título e descrição."));
    const feedback = await db.productFeedback.create({ data: { ...data, title: data.title, description: data.description, userId: current.userId, storeId: null }, select: { publicId: true } });
    return reply.code(201).send({ feedback });
  });

  app.patch<{
    Params: { feedbackId: string };
    Body: unknown;
  }>("/admin/content/feedback/:feedbackId", async (request, reply) => {
    const current = await admin(request);
    if (!current || !mutationAllowed(request, current))
      return reply
        .code(403)
        .send(failure(request, "FORBIDDEN", "Acesso negado."));
    let data: RoadmapData;
    try { data = roadmapData(request.body); }
    catch (error) { return reply.code(400).send(failure(request, "VALIDATION_ERROR", (error as Error).message)); }
    const result = await db.productFeedback.updateMany({
      where: { publicId: clean(request.params.feedbackId, 32) },
      data,
    });
    if (!result.count)
      return reply
        .code(404)
        .send(failure(request, "NOT_FOUND", "Feedback não encontrado."));
    return reply.send({ updated: true });
  });

  app.delete<{ Params: { feedbackId: string } }>(
    "/admin/content/feedback/:feedbackId",
    async (request, reply) => {
      const current = await admin(request);
      if (!current || !mutationAllowed(request, current))
        return reply
          .code(403)
          .send(failure(request, "FORBIDDEN", "Acesso negado."));
      const result = await db.productFeedback.deleteMany({
        where: { publicId: clean(request.params.feedbackId, 32) },
      });
      if (!result.count)
        return reply
          .code(404)
          .send(failure(request, "NOT_FOUND", "Feedback não encontrado."));
      return reply.code(204).send();
    },
  );

  app.post<{
    Body: {
      category?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      videoUrl?: string;
      published?: boolean;
    };
  }>("/admin/content/releases", async (request, reply) => {
    const current = await admin(request);
    if (!current || !mutationAllowed(request, current))
      return reply
        .code(403)
        .send(failure(request, "FORBIDDEN", "Acesso negado."));
    const title = clean(request.body?.title, 140);
    const description = clean(request.body?.description, 4000);
    const imageUrl = optionalUrl(request.body?.imageUrl);
    const videoUrl = optionalUrl(request.body?.videoUrl);
    if (
      title.length < 5 ||
      description.length < 10 ||
      imageUrl === undefined ||
      videoUrl === undefined
    )
      return reply
        .code(400)
        .send(
          failure(
            request,
            "VALIDATION_ERROR",
            "Revise título, descrição e URLs HTTPS.",
          ),
        );
    const category = categories.includes(
      request.body?.category as (typeof categories)[number],
    )
      ? (request.body.category as (typeof categories)[number])
      : "NEWS";
    const release = await db.productRelease.create({
      data: {
        category,
        title,
        description,
        imageUrl,
        videoUrl,
        published: request.body?.published !== false,
      },
      select: releaseSelect,
    });
    return reply.code(201).send({ release: withReleaseSource(release) });
  });

  app.patch<{
    Params: { releaseId: string };
    Body: {
      category?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      videoUrl?: string;
      published?: boolean;
    };
  }>("/admin/content/releases/:releaseId", async (request, reply) => {
    const current = await admin(request);
    if (!current || !mutationAllowed(request, current))
      return reply
        .code(403)
        .send(failure(request, "FORBIDDEN", "Acesso negado."));
    const publicId = clean(request.params.releaseId, 32);
    const data: {
      category?: (typeof categories)[number];
      title?: string;
      description?: string;
      imageUrl?: string | null;
      videoUrl?: string | null;
      published?: boolean;
    } = {};
    if (request.body?.category !== undefined) {
      if (
        !categories.includes(
          request.body.category as (typeof categories)[number],
        )
      )
        return reply
          .code(400)
          .send(failure(request, "VALIDATION_ERROR", "Categoria inválida."));
      data.category = request.body.category as (typeof categories)[number];
    }
    if (request.body?.title !== undefined) {
      data.title = clean(request.body.title, 140);
      if (data.title.length < 5)
        return reply
          .code(400)
          .send(failure(request, "VALIDATION_ERROR", "Título muito curto."));
    }
    if (request.body?.description !== undefined) {
      data.description = clean(request.body.description, 4000);
      if (data.description.length < 10)
        return reply
          .code(400)
          .send(failure(request, "VALIDATION_ERROR", "Descrição muito curta."));
    }
    if (request.body?.imageUrl !== undefined) {
      const imageUrl = optionalUrl(request.body.imageUrl);
      if (imageUrl === undefined)
        return reply
          .code(400)
          .send(failure(request, "VALIDATION_ERROR", "Imagem HTTPS inválida."));
      data.imageUrl = imageUrl;
    }
    if (request.body?.videoUrl !== undefined) {
      const videoUrl = optionalUrl(request.body.videoUrl);
      if (videoUrl === undefined)
        return reply
          .code(400)
          .send(failure(request, "VALIDATION_ERROR", "Vídeo HTTPS inválido."));
      data.videoUrl = videoUrl;
    }
    if (typeof request.body?.published === "boolean")
      data.published = request.body.published;
    if (!Object.keys(data).length)
      return reply
        .code(400)
        .send(
          failure(request, "VALIDATION_ERROR", "Nenhuma alteração informada."),
        );
    const existing = await db.productRelease.findUnique({
      where: { publicId },
      select: { id: true },
    });
    if (!existing)
      return reply
        .code(404)
        .send(failure(request, "NOT_FOUND", "Publicação não encontrada."));
    const release = await db.productRelease.update({
      where: { publicId },
      data,
      select: releaseSelect,
    });
    return reply.send({ release: withReleaseSource(release) });
  });

  app.delete<{ Params: { releaseId: string } }>(
    "/admin/content/releases/:releaseId",
    async (request, reply) => {
      const current = await admin(request);
      if (!current || !mutationAllowed(request, current))
        return reply
          .code(403)
          .send(failure(request, "FORBIDDEN", "Acesso negado."));
      const publicId = clean(request.params.releaseId, 32);
      if (publicId.startsWith("auto-"))
        return reply
          .code(400)
          .send(
            failure(
              request,
              "AUTOMATIC_RELEASE",
              "Atualizações automáticas podem ser editadas ou ocultadas, mas não excluídas.",
            ),
          );
      await db.productRelease.deleteMany({ where: { publicId } });
      return reply.code(204).send();
    },
  );

  app.put<{
    Params: { integrationKey: string };
    Body: { imageUrl?: string; altText?: string };
  }>("/admin/content/integrations/:integrationKey", async (request, reply) => {
    const current = await admin(request);
    if (!current || !mutationAllowed(request, current))
      return reply
        .code(403)
        .send(failure(request, "FORBIDDEN", "Acesso negado."));
    const integrationKey = clean(
      request.params.integrationKey,
      64,
    ).toLowerCase();
    const imageUrl = optionalUrl(request.body?.imageUrl);
    const altText = clean(request.body?.altText, 160);
    if (!/^[a-z0-9-]{2,64}$/.test(integrationKey) || !imageUrl)
      return reply
        .code(400)
        .send(
          failure(
            request,
            "VALIDATION_ERROR",
            "Integração ou imagem HTTPS inválida.",
          ),
        );
    const asset = await db.integrationCatalogAsset.upsert({
      where: { integrationKey },
      create: { integrationKey, imageUrl, altText },
      update: { imageUrl, altText },
      select: {
        integrationKey: true,
        imageUrl: true,
        altText: true,
        updatedAt: true,
      },
    });
    return reply.send({ asset });
  });

  app.post<{
    Body: { title?: string; message?: string; destination?: string };
  }>("/admin/content/broadcasts", async (request, reply) => {
    const current = await admin(request);
    if (!current || !mutationAllowed(request, current))
      return reply
        .code(403)
        .send(failure(request, "FORBIDDEN", "Acesso negado."));
    const title = clean(request.body?.title, 120);
    const message = clean(request.body?.message, 300);
    const destination = destinations.includes(
      request.body?.destination as (typeof destinations)[number],
    )
      ? (request.body.destination as (typeof destinations)[number])
      : "Novidades";
    if (title.length < 4 || message.length < 8)
      return reply
        .code(400)
        .send(
          failure(
            request,
            "VALIDATION_ERROR",
            "Informe título e mensagem da notificação.",
          ),
        );
    const stores = await db.store.findMany({
      where: { active: true },
      select: { id: true },
    });
    const targetId = randomUUID();
    if (stores.length)
      await db.auditLog.createMany({
        data: stores.map((store) => ({
          storeId: store.id,
          actorUserId: current.userId,
          actorType: "USER",
          action: "platform.announcement",
          targetType: "platform_release",
          targetId,
          metadata: { title, message, destination },
        })),
      });
    if (push)
      await Promise.all(
        stores.map((store) =>
          push(
            store.id,
            "platform.announcement",
            { title, message, destination },
            targetId,
          ),
        ),
      );
    return reply.code(201).send({ deliveredToStores: stores.length });
  });
}
