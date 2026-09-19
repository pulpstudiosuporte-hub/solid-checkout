# Projeto de checkout Pirat

- A fonte é `src/theme.mjs`, que exporta um objeto ou função retornando a configuração do checkout. Os blocos ficam em `src/elements.mjs`. Abra esta pasta inteira na IDE.
- Preserve os campos existentes. Use os componentes já suportados pelo editor da Pirat. Não invente propriedades, componentes React, CSS ou HTML: o servidor rejeita campos desconhecidos.
- `npm run dev` abre a prévia local; `npm run build` gera `dist/checkout.json`; `npm run validate` verifica na API; `npm run push` envia somente ao rascunho.
- Publicação é separada: `npm run publish` publica o último rascunho enviado. Não publique sem a orientação do proprietário.
- Não altere os arquivos em `.pirat/tool`. Não inclua senhas, tokens ou dados de compradores no projeto. O login é autorizado pelo proprietário no navegador.
- Não mude preços, fretes ou integrações por meio de textos do tema. Não fabrique avaliações ou vendas.
- Em conflito, preserve os arquivos e baixe a versão remota em outra pasta. Compare antes de reenviar. Após restaurar uma versão, faça um novo pull.
- Revise no computador e no celular. A prévia não valida o pagamento; essa verificação é separada.
