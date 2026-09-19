# Pirat CLI conectada

Requer Node.js 22.12 ou superior. Extraia o kit e abra o terminal na pasta. O kit já inclui a CLI e a prévia, sem instalação de dependências.

Também disponível por NPX, usando o pacote hospedado pela Pirat:

```sh
npx --yes --package=https://docs.apirat.io/downloads/pirat-cli-0.1.0.tgz pirat login
npx --yes --package=https://docs.apirat.io/downloads/pirat-cli-0.1.0.tgz pirat checkout pull ID_DO_CHECKOUT minha-loja --template retail
```

Em Checkouts, a área **Seu checkout. Na sua IDE.** monta esses comandos com o checkout e o modelo escolhidos. Modelos: `minimal`, `retail`, `marketplace`; sem `--template`, preserva o visual atual. O modelo altera apenas o projeto local até você enviar o rascunho.

```sh
node cli.mjs login
node cli.mjs checkout list
node cli.mjs checkout pull ID_DO_CHECKOUT minha-loja
cd minha-loja
npm run dev
```

O login exibe um código. Abra a página indicada, entre na sua conta, selecione a loja, confira o código e autorize. Publicar é uma permissão opcional. Em Configurações → CLI e temas você pode revogar conexões. O token dura 30 dias e fica no perfil do usuário, fora do projeto; não envie credenciais para sua IA.

Abra **a pasta inteira** na IDE de sua preferência. Edite `src/theme.mjs` para identidade, textos, estrutura, etapas, resumo, imagens e recursos. Edite `src/elements.mjs` para banners, depoimentos, FAQ e outros blocos já suportados pelo editor. É JavaScript local: você pode dividir em módulos e usar funções que retornam a configuração. A prévia usa o renderizador do editor da Pirat e atualiza ao salvar.

```sh
npm run build
npm run validate
npm run push
npm run publish
```

`build` compila no computador. `validate` consulta o validador real da API sem salvar. `push` atualiza somente o rascunho. `publish` publica o **rascunho já enviado**, sem enviar edições locais pendentes. O script `npm run publish` contém a confirmação `--yes`: execute apenas depois da revisão. As regras de loja, domínio, produto e permissão continuam valendo.

Para conferir versões e restaurar um rascunho:

```sh
node .pirat/tool/cli.mjs checkout versions
node .pirat/tool/cli.mjs checkout restore . ID_DA_VERSAO
```

Os registros guardam o estado anterior às alterações feitas pela CLI. Restaurar não publica e preserva seus arquivos locais; baixe em uma nova pasta para continuar. Uma alteração concorrente no painel ou em outra IDE bloqueia o envio: use `pull` em outra pasta e compare. Não existe `--force` para apagar o trabalho de outra pessoa.

## Escopo desta versão

A CLI está conectada e edita a configuração completa aceita pelo editor, incluindo textos e blocos. O JavaScript do projeto executa **apenas na sua máquina**, como em qualquer projeto de desenvolvimento. A API recebe a configuração resultante, nunca executa o código. Isso ainda não é upload de componentes React/HTML/CSS arbitrários ou substituição do motor de pagamento. Preços, fretes e transações continuam no sistema. A prévia é visual e não testa cobranças reais.

O pacote tem o nome preparado para npm, mas **não está publicado no registro público**. Use o ZIP ou instale o pacote localmente; não execute `npx @pirat/cli` até a publicação oficial. Para um ambiente próprio de testes, use `login --api http://127.0.0.1:3333`. A origem fica vinculada à conexão; o projeto não pode redirecionar a credencial para outro servidor.

Documentação: https://docs.apirat.io/#/docs/cli-conectada
