# Criar checkout com IA

Em Checkouts → Criar com IA, escolha loja Shopify ou produto de link direto,
descreva o visual e gere uma prévia. Novas instruções ajustam a configuração
anterior. Salvar rascunho e abrir editor usa o fluxo existente; não publica.

O papagaio conduz uma conversa guiada, com uma pergunta por vez sobre marca,
ideia, cores, tipo, estrutura, imagens e recursos. As perguntas iniciais são
determinísticas: o Gemini recebe as escolhas somente ao gerar ou ajustar a prévia.
As respostas ficam em um histórico editável e em um resumo; revisar uma delas
preserva as demais. Produto e organização aparecem conforme o tipo e modelo.
Enter envia a ideia ou o ajuste; Shift+Enter insere uma linha. Perguntas opcionais
aceitam continuar sem imagem, depoimentos ou cores definidas.
Varejo (três colunas) e Marketplace (cartões) também estão no editor manual.
A prévia alterna computador/celular e pode ser ampliada. Alterar as escolhas
exige regenerar antes de salvar, para o rascunho corresponder à prévia.
Logos e banners reais são enviados à biblioteca e mantidos para publicação;
seus endereços não vão ao Gemini. Ofertas e outros blocos continuam no editor.
Avisos de compras usam apenas as vendas reais disponíveis. Preços e
produtos continuam vindo do catálogo/carrinho, nunca do modelo. Depoimentos
fornecidos pelo lojista são preservados, sem envio ao Gemini. Sem depoimentos,
a seção permanece desativada. A prévia é ilustrativa e não cria pagamentos.

## Referência temporária

PNG, JPEG ou WebP até 2 MB e 16 megapixels. A API valida, remove metadados e
reduz a imagem para até 1280 pixels em memória antes de enviar como inlineData.
Não usa disco, biblioteca de mídia, banco nem a Files API. Ao sair da criação
ou salvar, a referência é removida do estado do navegador. Cancelar uma geração
interrompe a requisição, preservando a ideia e a referência para outra tentativa.
Fechar a aba descarta o estado. Não há promessa de remoção imediata nos sistemas
do Google; o processamento segue os termos do provedor.

## Limites e acesso

`POST /checkouts/ai/preview` exige sessão, CSRF/origem válidos e papel OWNER ou
ADMIN na loja ativa. Sessões de suporte não geram checkouts. O produto é buscado
no contexto da loja; somente o título é enviado ao modelo. Limite de 10 pedidos
por conta/hora, corpo de 3 MB e até duas tentativas de 20 segundos, separadas por
500 ms. Somente falhas de conexão, timeout e HTTP 408/500/502/503/504 são repetidas;
cotas e erros permanentes não. Cancelar interrompe também a recuperação.
A chave e o modelo
usam as variáveis da API já configuradas para o papagaio.

A saída passa por uma lista explícita de campos visuais. URLs, scripts, preços,
descontos e depoimentos gerados não são aceitos. Uma falha mantém os dados do
conversa. Saídas e referências não são registradas nos logs da rota.

## Verificação

- API: autenticação, loja, imagem, limite, cancelamento, saída inválida e campos permitidos.
- Interface: prévia, ajustes, rascunho, referência temporária, cancelamento e falha;
  temas claro/escuro, celular e auditoria automática de acessibilidade.
- Os testes de interface usam respostas simuladas. A geração real depende do
  Gemini configurado e deve ser conferida separadamente após publicação.

Contrato oficial: [imagens no Gemini](https://ai.google.dev/gemini-api/docs/image-understanding).
