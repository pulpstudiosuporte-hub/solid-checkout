# Site institucional Pirat

## Versão independente para Dokploy

A pasta `solid-site/` contém uma cópia independente do site, com entrada própria, dependências, imagens, Dockerfile e Nginx. Para publicar separadamente, use `solid-site-dokploy.zip` no provedor **Drag and Drop .zip** de uma nova Application no Dokploy, com build **Dockerfile** e porta **80**. Consulte `../solid-site/README.md` para os passos completos. Gere novamente o ZIP após alterações com `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-site.ps1`, na raiz do projeto.

O cadastro e o login dessa versão sempre apontam para `https://app.apirat.io`, inclusive em domínios temporários. As instruções abaixo descrevem a versão anterior, ainda integrada ao serviço web do aplicativo.

A apresentação institucional usa as cores da Pirat e é carregada separadamente do painel e do checkout público. Inclui demonstração de checkout com mudança de cor, order bump e conclusão simulada, abas de recursos, integrações, passo a passo e perguntas frequentes. A demonstração não chama a API de pagamentos. Preços, indicadores de conversão e depoimentos não foram inventados; as condições comerciais são consultadas no painel.

## Visualizar e testar

```powershell
npm.cmd run dev:web
# Abrir http://127.0.0.1:5173/site.html

npm.cmd run test:site
```

`test:site` compila o frontend, inicia e encerra um preview temporário e usa o Chrome instalado com Playwright. Não é necessário baixar outro navegador. Para usar o Edge, defina `VISUAL_BROWSER_CHANNEL=msedge`. No Windows, a execução pode exigir autorização para iniciar o navegador fora do sandbox de processos.

As capturas verificadas ficam em `.visual-check/site-desktop.png`, `site-mobile.png`, `site-mobile-topo.png` e nos arquivos de seções. O teste aguarda o conteúdo React e as fontes antes de capturar, define a largura real da página e verifica navegação, demonstração e ausência de transbordamento entre 320 e 1440 pixels. Isso não valida pagamentos reais ou o cadastro no servidor de produção.

## Publicação no domínio principal

O `Dockerfile.web` existente gera `index.html` e `site.html`. A configuração Nginx seleciona `site.html` somente para a página inicial de `solidcheckout.xyz` e `www.solidcheckout.xyz`. Os demais hosts e as rotas de checkout mantêm a entrada do aplicativo. O site principal direciona cadastro e login para `https://app.solidcheckout.xyz`, conforme o endereço do aplicativo já definido em `shopify.app.toml`. No preview, esses links usam a entrada local para permitir testes.

Para colocar esta versão no ar:

1. Publicar o commit e reconstruir o serviço web no Dokploy com o `Dockerfile.web` existente.
2. Adicionar `solidcheckout.xyz` e, se desejado, `www.solidcheckout.xyz` como domínios do serviço web na porta 80. Preservar os subdomínios já configurados para painel e checkout.
3. Apontar o DNS desses nomes para a entrada do servidor/reverse proxy responsável pelo serviço. Confirmar o destino na hospedagem; nenhum IP foi presumido no projeto.
4. Emitir/renovar o HTTPS para cada nome e conferir a página inicial, as âncoras, o acesso ao painel e um link de checkout existente.

O domínio canônico, título, descrição e metadados de compartilhamento estão em `apps/web/site.html`. A página institucional não registra o service worker do painel. O build não modifica DNS, certificados, CORS, gateways ou banco de dados. Esta alteração não precisa de migration. A publicação e o domínio real devem ser verificados no ambiente de hospedagem; o teste local não comprova que estão no ar.

## Identidade Pirat

As duas entradas (`apps/web` e `solid-site`) usam as logos originais do papagaio,
vinho, vermelho, marfim e dourado. `pirat-site.css` concentra os tokens e as
fontes locais Bricolage Grotesque e Inter. Mantenha esse arquivo sincronizado
nas duas pastas. Os domínios existentes e os links de acesso ao aplicativo
continuam válidos; a troca visual não migra endereços.

Valide também a versão independente com `npm.cmd run test:site` em `solid-site`.

## Apresentação com personagem e movimento

`PiratExperience.jsx` e `pirat-experience.css` compõem a abertura com o papagaio,
as três cenas de produto controladas pela rolagem e a seção de lojistas.
Mantenha esses arquivos sincronizados entre `solid-site/src` e `apps/web/src`.
As referências CartFlami e Corvex orientam a composição; cores, tipografia,
textos e personagem continuam sendo da Pirat.

O personagem alterna as poses originais e reage ao clique. `SiteMotion` controla
a pausa geral e respeita a preferência por movimento reduzido. As cenas também
podem ser selecionadas por botões; no celular esse é o modo de navegação.
As demonstrações são ilustrativas e não geram pedidos ou cobranças reais.

As fotografias de lojistas são ilustrativas, com créditos visíveis; não são
depoimentos ou identificação de clientes da Pirat. Os arquivos são servidos
localmente em `public/brand/people`, com fontes registradas em `CREDITS.md`.
As poses utilizadas ficam em `public/brand/assistant`.

Além das capturas gerais, os testes produzem `site-hero.png` e `site-people.png`
em `.visual-check`. Verificam reação do mascote, mudança das cenas, teclado,
pausa, movimento reduzido, carregamento das fotos e largura móvel.

`SiteShowcase.jsx` e `site-showcase.css` adicionam o carrossel de artes dos temas
e a área de depoimentos de exemplo, também compartilhados pelas duas entradas.
O carrossel oferece botões, setas do teclado nos cards, gesto horizontal e
reprodução opcional. A reprodução pausa com foco, cursor, aba oculta, seção
fora da tela, movimento reduzido e controle global de efeitos.

As cinco artes em `public/brand/templates/*-art.webp` são composições geradas
por IA, identificadas como ilustrativas na página. Não são novos temas
instalados nem capturas exatas. Prompts e origem estão em
`docs/site-showcase-images.md`. Os depoimentos usam nomes e falas fictícias,
com aviso na seção e em cada card; devem ser substituídos por conteúdo real
autorizado quando estiver disponível.
