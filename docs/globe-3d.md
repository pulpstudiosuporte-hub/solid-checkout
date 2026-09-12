# Globo 3D

O componente fornecido foi adaptado em `apps/web/src/components/ui/3d-globe.tsx`. O painel usa `WorldMap.jsx` para carregar o 3D apenas quando o mapa entra na tela, tanto no Início quanto em Análises. `3d-globe-demo.tsx` contém uma demonstração separada; os pontos de demonstração não são usados no painel.

## Estrutura e estilos

O projeto usa React 19, Vite e TypeScript, com componentes compartilhados em **`apps/web/src/components/ui`**. Esse é o equivalente a `/components/ui` dentro do workspace web, e mantém os componentes reutilizáveis separados das páginas. Os estilos gerais ficam em `apps/web/src/styles.css`, `admin-styles.css` e `admin-refresh.css`; os estilos do globo ficam em `3d-globe.css` e `world-map.css`, ao lado dos componentes.

O projeto existente não usa Tailwind nem tem uma configuração shadcn. A integração usa o CSS atual, sem aplicar um reset global que alteraria os demais componentes. TypeScript já está configurado, e não são necessários providers globais: Canvas fornece o contexto de Three.js.

Para adotar Tailwind/shadcn posteriormente, seguindo a [instalação oficial para Vite](https://ui.shadcn.com/docs/installation/vite):

1. Na raiz, execute `npm.cmd install --workspace=@solid/web tailwindcss @tailwindcss/vite`.
2. Adicione `tailwindcss()` ao array `plugins` de `apps/web/vite.config.ts`. Crie um arquivo de estilos dedicado com `@import "tailwindcss";` e importe-o na entrada da aplicação. Revise o efeito do Preflight nos estilos existentes antes de publicar; não substitua os CSS atuais.
3. Em `apps/web/tsconfig.json`, adicione `"baseUrl": "."` e `"paths": { "@/*": ["./src/*"] }` em `compilerOptions`. No Vite, adicione `resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }`.
4. Execute `npx.cmd shadcn@latest init -c apps/web`, selecionando o CSS dedicado e o alias `@/components/ui`. Revise o diff dos tokens gerados. Os imports atuais são relativos e continuam funcionando; futuros componentes podem usar `@/components/ui` e o utilitário `cn` gerado em `@/lib/utils`.

## Dados e comportamento

- `markers`: latitude e longitude numéricas, rótulo e tamanho opcional; `src` permite uma imagem opcional. No painel, os marcadores representam localidades reais com contagem de visitantes, sem fotos fictícias.
- `config`: mantém as opções de textura, relevo, atmosfera, cores, iluminação, rotação inicial, zoom e movimento do componente original. O painel começa voltado ao Brasil. O seletor centraliza a cidade/região e pausa a rotação.
- Os callbacks `onMarkerClick` e `onMarkerHover` são opcionais. `active` interrompe a animação fora da tela/aba; `onUnavailable` e `onReady` permitem integrar carregamento e alternativa visual.
- Latitude/longitude inválidas e o par 0/0 não geram pontos. O globo aceita o mundo inteiro, incluindo localidades fora do recorte do mapa plano. O teste lança raios sobre a SphereGeometry e compara os UVs encontrados com a posição esperada na textura equiretangular.
- Acessibilidade: seletor de localidades utilizável por teclado, botões para pausar e centralizar, rotação desativada com movimento reduzido. Layout de 400px no desktop e 370px em telas pequenas. A localização continua aproximada por IP.
- Renderização sob demanda quando pausado, DPR limitado a 1,5, texturas locais menores e geometria descartada pelo Fiber ao desmontar. O chunk 3D fica separado do React compartilhado e não é carregado pelo checkout.
- Sem WebGL2, falha de textura, perda do contexto gráfico ou carregamento maior que 25s, o painel mostra o mapa plano. O botão **Mapa plano** também permite alternar manualmente.

## Dependências e texturas

Dependências fixadas em `apps/web/package.json`: `three@0.180.0`, `@react-three/fiber@9.4.0`, `@react-three/drei@10.7.6` e tipos `@types/three@0.180.0`. O override dos tipos evita duas versões incompatíveis no workspace. React 19 usa Fiber 9, conforme a [documentação do Fiber](https://github.com/pmndrs/react-three-fiber/blob/master/docs/getting-started/installation.mdx). A renderização segue as [orientações de desempenho](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx).

As duas texturas fornecidas no prompt ficam em `apps/web/public/illustrations/globe/` e são servidas pelo próprio domínio, sem alterar CSP. A imagem da Terra foi reduzida a 2048×1024 e o relevo a 1024×512, cerca de 487 KB combinados. Originais fornecidos:

- [Terra](https://cdn.21st.dev/assets/localized/228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01.jpg)
- [Relevo](https://cdn.21st.dev/assets/localized/839b12da2e4dd346b256cebae72e10c479a102c8980a22084c41275e4b9a0e12.png)

## Validação

`npm.cmd run check` valida tipos, lint, testes e build. `npx.cmd playwright test --config scripts/geography-ui.config.mjs` cobre o globo, seletores, período, movimento reduzido, contexto perdido, textura indisponível, ausência de WebGL e o mapa plano. As capturas principais são `.visual-check/desktop.png` e `.visual-check/mobile.png`.

Os testes de interface usam dados simulados. A origem das coordenadas e as visitas reais dependem da API e dos cabeçalhos de geolocalização em produção; consulte `geographic-reach.md`. A publicação das Novidades está incluída nas alterações, para o próximo deploy.
