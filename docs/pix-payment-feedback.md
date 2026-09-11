# Pix: expiração, cópia e comprovantes

O checkout deixa de oferecer QR Code e código copiável quando o prazo do Pix termina ou o provedor informa EXPIRED, FAILED, CANCELLED ou REFUNDED. A expiração do contador é apenas um estado da interface: enquanto o provedor mantém PENDING, a consulta automática continua para reconhecer confirmação tardia. O botão “Verificar pagamento” permite uma nova consulta e informa falhas de conexão. Nenhuma nova cobrança é criada por esse botão.

Se a área de transferência estiver indisponível ou recusar a cópia, o checkout mostra um campo selecionável com o código completo. O sucesso da cópia é anunciado em desktop e celular.

## Comprovantes privados

- O comprador escolhe o arquivo e confirma o envio em uma ação separada. A interface só confirma o recebimento depois da resposta da API.
- Formatos: JPG, PNG, WebP ou PDF, até 3 MB. Imagens são decodificadas, convertidas para WebP e têm metadados removidos. PDFs passam por conferência de assinatura e terminador; isso não é uma varredura de malware. São entregues somente como anexos para download, nunca embutidos na página.
- A autorização exige o token da sessão e o identificador do pagamento pertencente a ela, com transação do provedor registrada. Aceita comprovantes até 30 dias após a criação da tentativa, inclusive depois da expiração da sessão de compra.
- Armazenamento criptografado no PostgreSQL com a chave `APP_ENCRYPTION_KEY`. Não utiliza a biblioteca pública de mídia.
- Um comprovante por tentativa de pagamento; repetir o mesmo arquivo é idempotente. Um arquivo diferente recebe conflito. Limite de 100 MB de conteúdo por loja, serializado por transação para evitar corrida de quota.
- A equipe acessa os arquivos em **Pedido → Transações → Comprovantes enviados**, com consulta e download vinculados à loja ativa. O botão Atualizar consulta novos envios.
- A limpeza periódica remove comprovantes com mais de 30 dias desde o envio. A janela efetiva pode incluir o intervalo de seis horas do trabalho de limpeza.
- O comprovante não altera status, estoque, integração ou confirmação financeira. A confirmação continua vindo dos processos existentes de webhook e reconciliação.

## Implantação

Antes de iniciar a API atualizada, aplique a migration `20260911190000_payment_receipts` no ambiente escolhido com `npm run db:deploy`. O build e os testes não executam migrations. A migration cria apenas a nova tabela e seus índices; não transforma pagamentos existentes.

## Verificação local

`npm.cmd run check` valida lint, tipos, testes unitários, build e limites dos bundles. `npm.cmd run test:checkout` executa os testes interativos e grava `.visual-check/pix-desktop.png` e `.visual-check/pix-mobile.png`.

A página de teste `/ui-tests/pix-review.html`, disponível somente no servidor de desenvolvimento, monta os componentes reais com respostas fictícias de API. Nenhuma chamada fetch alcança gateways ou APIs reais. Ela não é uma entrada do build de produção. Os testes de rota usam `Fastify.inject` e um repositório em memória; aplicar a migration, validar persistência real e confirmar pagamento no gateway ainda exige um ambiente de integração configurado.
