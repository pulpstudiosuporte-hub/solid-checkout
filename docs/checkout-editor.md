# Estúdio de personalização do checkout

O editor abre em Checkouts → Personalizar, em uma área que ocupa a tela toda. A navegação agrupa identidade visual, experiência de compra e informações da loja. A busca considera nomes e descrições das configurações, sem diferenciar acentos.

## Edição e publicação

- A prévia acompanha o rascunho. Visualizar e voltar à edição preserva as mudanças. No celular, use Personalizar e Prévia para alternar as áreas.
- Celular, tablet e desktop selecionam a composição e uma largura máxima da prévia; a área se adapta ao espaço disponível. É uma representação visual, com dados de demonstração, sem processamento de pagamento.
- Salvar rascunho persiste a configuração sem mudar a versão publicada. Publicar salva primeiro as alterações pendentes e só informa sucesso após a API confirmar a publicação. Em caso de erro ao salvar, não tenta publicar.
- Durante gravações, os controles ficam indisponíveis para evitar envios duplicados. Ao sair com alterações, é possível continuar editando, descartar ou salvar e sair. Fechar ou recarregar a página aciona a proteção nativa do navegador.
- Desfazer e refazer mantêm até 50 passos. Digitação contínua no mesmo campo é agrupada; modelos e arredondamento global são mudanças únicas. Um salvamento separa os próximos passos de edição.
- Atalhos: Ctrl/Cmd+S salva, Ctrl/Cmd+Z desfaz e Ctrl/Cmd+Shift+Z refaz. Dentro de campos, desfazer/refazer permanece nativo.
- A edição de cores aceita hexadecimal completo; entradas incompletas mantêm a cor anterior. Uploads de logo e banners validam formato e limite de 10 MB antes de enviar. A conversão WebP existente continua no servidor.
- Cancelar um elemento novo remove sua inclusão; cancelar um elemento existente restaura seus valores. Aplicar ao rascunho confirma a edição local do bloco; use Salvar rascunho para persistir.

## Otimizações

O código do editor e da lista de checkouts usa importação sob demanda. As configurações padrão ficam em módulo separado, sem importar a interface inteira. No build local, o chunk principal AdminApp passou de 203,84 kB para 127,36 kB (sem gzip). Essa redução de aproximadamente 37% mede o arquivo principal, não o total transferido nem o tempo de resposta da API.

A prévia usa atualização adiada e callbacks estáveis. Alterar busca ou mensagens não exige renderizar toda a prévia. O histórico usa um reducer limitado, e o estado inicial é normalizado uma vez por montagem. Serviços e ações deixaram de depender de variáveis mutáveis compartilhadas entre instâncias do editor.

## Validação

```powershell
npm.cmd run test --workspace=@solid/web
npm.cmd run typecheck --workspace=@solid/web
npm.cmd run test:ui
```

A suíte `apps/web/ui-tests/editor.spec.mjs` usa o Chrome instalado, viewports reais e respostas de API fictícias. Cobre seções, busca, modelos, desfazer/refazer, prévia, salvamento, publicação, falhas de API, saída com alterações, upload inválido e carregamento sob demanda. As capturas `editor-desktop.png`, `editor-mobile.png`, `editor-mobile-preview.png`, `editor-colors.png` e `editor-element.png` ficam em `.visual-check/` e devem ser abertas para revisão visual.

Login real, persistência no servidor, upload aceito pelo serviço, publicação em domínio real e pagamento ponta a ponta dependem de ambiente integrado e não são comprovados por esses testes simulados.
