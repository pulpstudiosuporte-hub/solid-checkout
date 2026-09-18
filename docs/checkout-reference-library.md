# Referências e catálogo de evolução do checkout

Levantamento de 18/09/2026, com foco em lojas. Este documento é um catálogo de
possibilidades, não uma lista de funcionalidades já entregues. A IA e o editor
manual devem usar o mesmo esquema de capacidades. Cada modelo usa a identidade
do lojista e os dados reais da sessão.

## Referências e evidência

| Referência | Evidência consultada | O que aproveitar na Pirat |
| --- | --- | --- |
| Nike | Capturas de identificação e entrega, desktop/mobile enviadas pelo usuário | Três colunas, formulário estreito, etapas em faixas, botão arredondado; base Varejo publicada |
| Mercado Livre | Capturas de entrega/pagamento/resumo enviadas pelo usuário | Cartões por seção, resumo lateral, total e ação próximos; base Marketplace publicada |
| Shopify | [Checkout de uma página](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/one-page-checkout) e [detalhes do desenho](https://www.shopify.com/blog/one-page-checkout) | Contato, entrega e pagamento na mesma página; recolher seções concluídas; próximo modelo recomendado |
| Shopee | [Cupons no checkout](https://help.shopee.com.br/portal/4/article/76206-%5BCupons%5D-Como-fa%C3%A7o-para-usar-um-c%C3%B3digo-de-cupom) | Explorar seletor de cupons e discriminação de benefícios reais; layout exato ainda precisa de captura atual |
| TikTok Shop | [Experiência no Brasil](https://newsroom.tiktok.com/tiktok-shop-chega-ao-brasil?lang=pt-BR) | Explorar fluxo compacto para celular e continuidade da compra; documento confirma checkout no aplicativo, não sua geometria atual |
| Stripe Checkout | [Recursos oficiais](https://stripe.com/payments/checkout) | Formulário enxuto, preenchimento de endereço e adaptação entre dispositivos |
| WooCommerce | [Blocos de checkout](https://woocommerce.com/document/woocommerce-store-editing/customizing-cart-and-checkout/checkout-block/) | Blocos de campos/totais, ordem configurável, entrega/retirada e métodos condicionados ao gateway |

Shopify e WooCommerce documentam estruturas úteis para a arquitetura, além da
aparência. Shopee exige conta em sua plataforma; isso não é motivo para impor
cadastro ao comprador da Pirat. Não há nesta pesquisa um ranking comparável de
conversão entre todas essas marcas. Resultados comerciais de terceiros não são
garantia de resultado ao reproduzir um layout.

## Opções a oferecer, por área

As listas abaixo combinam extensões de capacidades existentes e novas propostas.
Não habilitar tudo automaticamente. O lojista escolhe um modelo pronto e abre
os controles avançados quando precisar.

### Estrutura e fluxo

- Uma, duas ou três colunas; proporções e largura máxima.
- Produtos, formulário e resumo em posições configuráveis.
- Página única, seções recolhíveis ou etapas sucessivas.
- Resumo fixo na rolagem ou acompanhando o conteúdo.
- Ordem específica no celular e resumo recolhível.
- Cabeçalho completo, compacto ou apenas marca.
- Espaçamentos por região e alinhamento dos blocos.
- Mostrar entrega apenas quando o carrinho exigir.
- Voltar e editar uma seção sem perder dados.
- Revisão final opcional, com total já conhecido antes da confirmação.

### Identidade, imagens e conteúdo

- Logo em imagem ou texto; posição e tamanho.
- Banner separado para computador e celular; proporção e recorte.
- Imagem do resumo e imagens dos produtos reais.
- Paletas, fontes, hierarquia de títulos e densidade.
- Bordas, sombras e arredondamento por componente.
- Cabeçalho e rodapé com variações de organização.
- Benefícios, perguntas frequentes e políticas acessíveis.
- Depoimentos reais com nota e imagem autorizada.
- Biblioteca de blocos e temas reutilizáveis da loja.
- Presets com prévia antes de aplicar; preservar conteúdo existente.

### Etapas e campos

- Etapas com setas, números, ícones, círculos ou texto.
- Ícones por etapa, tamanho, espaçamento e cores dos estados.
- Orientação horizontal ou vertical conforme dispositivo.
- Campos com rótulo superior ou flutuante.
- Contorno, preenchimento ou linha inferior dos campos.
- Campos em uma ou duas colunas quando comportar.
- Textos de ajuda e indicação clara de obrigatório/opcional.
- Autocompletar e teclado adequados ao tipo de dado.
- Erros junto ao campo, resumo dos erros e foco no primeiro inválido.
- Endereço manual como alternativa à busca por CEP.
- Campos adicionais somente com finalidade e validação definidas.
- Regras do pedido/gateway prevalecem sobre ocultação visual de campos.

### Produtos, resumo e entrega

- Lista compacta, cartões ou linhas de produto.
- Variação, quantidade e imagem com proporção ajustável.
- Detalhamento de subtotal, desconto, frete e total.
- Cupom recolhido, campo aberto ou seletor de cupons elegíveis.
- Resumo editável nos pontos suportados pela sessão.
- Fretes em lista, cartões ou botões de opção.
- Prazo e preço reais, inclusive estados de carregamento e indisponibilidade.
- Retirada quando houver logística integrada para isso.
- Barra de frete grátis somente com regra real da loja.
- Complemento de endereço recolhível.

### Conversão e interação

- Oferta de saída configurável com cupom válido.
- Notificações de compras reais: posição, duração, frequência e aparência.
- Cronômetro associado a uma condição real, sem reinício enganoso.
- Oferta complementar ligada ao catálogo e recalculada no servidor.
- Botão principal no formulário, resumo ou barra móvel fixa.
- Ícone, rótulo, altura e arredondamento da ação principal.
- Movimento reduzido quando solicitado pelo dispositivo.
- Estados de carregamento, indisponibilidade, sucesso e falha.
- Ajuda contextual sem bloquear o preenchimento.
- Limites para sobreposição de pop-ups, teclado e botões no celular.

### Pagamento, gestão e medição

- Variações de apresentação do Pix: QR Code, copiar código, instruções e status.
- Recuperação de falhas mantendo os dados preenchidos.
- Cartão, carteiras e checkout expresso só após integração própria; não basta desenhar o botão.
- Rascunho, histórico, duplicação e restauração de tema.
- Prévia interativa com os mesmos componentes da compra real.
- IA pergunta apenas as escolhas ausentes e usa o mesmo catálogo do editor.
- Referências temporárias; logos/banners usados permanecem na biblioteca.
- Acessibilidade: foco, contraste, nomes de controles e alvos de toque.
- Eventos por etapa, erros e abandono; comparação de temas com dados reais.
- Testes A/B como etapa posterior, sem duplicar eventos ou pedidos.
- Importação de tema/CLI como etapa posterior, com contrato versionado.

## Sequência de entrega

1. Compartilhar blocos entre prévia e compra, conforme `checkout-composition.md`.
2. Composição versionada: regiões, colunas, ordem e limites por dispositivo.
3. Variantes de etapas, campos, produtos, resumo e ação principal.
4. Modelo de página única inspirado na organização Shopify.
5. Modelos móveis após capturar Shopee e TikTok Shop atuais.
6. Biblioteca de temas, medição e experimentos.

Cada incremento precisa funcionar no editor manual, na geração por IA e na
compra real. Validar também cupons, entrega, oferta complementar, retorno às
etapas e Pix pendente/expirado/pago. Recursos novos que dependam de operações
do servidor entram como entregas próprias, não como controles decorativos.

## Critério de qualidade

Mais opções para o lojista, menos esforço desnecessário para o comprador.
A pesquisa de [fluxo de checkout da Baymard](https://baymard.com/learn/checkout-flow-ux-optimization)
orienta campos essenciais, custos claros, compra sem cadastro obrigatório e
recuperação de erros. Esse critério guia os presets; não é uma promessa de
aumento de conversão para a Pirat.
