# Próxima etapa: composição compartilhada

## Primeiro incremento local

CheckoutProgress reúne o indicador de etapas usado pelo editor, prévia da IA e
checkout público. O componente recebe estado, rótulos e necessidade de entrega;
não navega, não calcula valores e não executa pagamentos. A indicação de entrega
desaparece para produtos digitais conhecidos na prévia. Essa extração é o início,
não um construtor universal concluído.

## Contrato a desenvolver

- Composição versionada com regiões, colunas e ordem de blocos nativos.
- Migração não destrutiva da configuração atual; checkout publicado só muda na publicação explícita.
- Blocos nativos únicos: identificação, entrega, pagamento, produtos e totais.
- Estado comercial, preços, frete e validações pertencem à sessão/API, nunca ao tema.
- Esquema e catálogo de capacidades compartilhados entre validação, editor e IA.
- Valores responsivos limitados para desktop e celular, com herança documentada.
- Prévia interativa usando os componentes públicos com um adaptador de dados fictícios.
- Edição simples por bloco; controles avançados sob demanda; histórico existente preservado.

## Sequência de migração

1. Extrair blocos sem mudar a configuração salva, começando pelas etapas.
2. Compartilhar cabeçalho, produtos, totais e campos entre prévia e publicação.
3. Adicionar composição versionada, inicialmente convertendo os modelos atuais.
4. Liberar posições e larguras no editor; validar combinações pela API.
5. Permitir à IA gerar a mesma composição, com validação e prévia antes de salvar.
6. Salvar temas reutilizáveis e adicionar variantes. Importação/CLI fica posterior.

## Critérios de aceite

Testar carrinho direto e Shopify, com e sem entrega, resumo oculto, cupom,
ofertas, erros, Pix pendente/expirado/pago; três larguras e teclado. Nenhuma
combinação pode ocultar um campo obrigatório, duplicar uma cobrança ou mostrar
valores diferentes da sessão. Referências de plataformas orientam a composição;
a identidade é a da loja e os meios de pagamento são os realmente suportados.
