# Temas Pirat v1

Edite `theme.json`. Este tema é uma configuração visual declarativa dos componentes da Pirat. Não é uma aplicação React nem aceita JavaScript, CSS, HTML, Liquid ou dependências executáveis.

- Preserve `schemaVersion: 1`, `name` (1–80 caracteres) e `config.template`.
- Consulte `theme.schema.json` no kit para todos os campos, limites e valores aceitos. Não invente propriedades: campos desconhecidos são rejeitados.
- Cores usam #RRGGBB. Mantenha contraste e confira celular e computador na prévia do editor.
- Escolha a estrutura em `template`: minimal, conversion, showcase, compact, retail ou marketplace. Mudar este campo não cria uma estrutura nova.
- Só os campos presentes são aplicados. Complete cores relacionadas (botão/fundo/texto e etapas ativas/inativas) para um resultado consistente.
- Logos, banners, depoimentos, blocos, ofertas, dados da empresa e integrações são configurados no editor da loja. Não inclua dados de compradores, chaves, preços, frete ou meios de pagamento no tema.
- Use a CLI do kit para validar e gerar o arquivo. Corrija os erros antes de importar.
- Importe `dist/theme.pirat.json` em Modelos → Importar tema. Confira a prévia, salve o rascunho e publique somente depois da revisão.
- Os temas não alteram os produtos ou a lógica de pagamento. A CLI trabalha localmente, sem login e sem publicar na conta.

Pedido sugerido para sua IA: “Leia AGENTS.md e o schema do kit. Ajuste theme.json para minha marca, mantendo o contrato v1. Use somente propriedades suportadas, valide com a CLI e explique as alterações.”
