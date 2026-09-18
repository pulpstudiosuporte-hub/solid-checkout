# Site institucional Pirat — deploy separado

Esta pasta é um projeto independente. Pode ser copiada para outro local ou repositório sem os demais arquivos do aplicativo. Contém a página institucional, a demonstração interativa e as imagens utilizadas pelo site.

## Publicar no Dokploy por arrastar e soltar

1. Crie uma **Application** separada para o site.
2. Selecione o provedor **Drag and Drop .zip**.
3. Configure o build como **Dockerfile**, com caminho `Dockerfile`, contexto `.` e build path `/` (raiz do ZIP).
4. Envie `solid-site-dokploy.zip`, entregue ao lado desta pasta. O Dockerfile está diretamente na raiz do arquivo.
5. No domínio da aplicação, use a porta interna **80** e configure `solidcheckout.xyz` e, se desejar, `www.solidcheckout.xyz`, com HTTPS.

O build instala as dependências e compila o site dentro do Docker. Não precisa de variáveis de ambiente, banco de dados ou API para exibir a página. O DNS do domínio deve apontar para o servidor do Dokploy. Se esse domínio já estiver vinculado ao serviço web do app, transfira somente o domínio institucional para esta nova aplicação; mantenha `app.solidcheckout.xyz` no serviço do aplicativo.

Referências oficiais: [upload de ZIP](https://docs.dokploy.com/docs/core/providers) e [configuração de build Dockerfile](https://docs.dokploy.com/docs/core/deno).

## Rodar e editar localmente

Requer Node.js 22.12 ou superior. Dentro desta pasta:

```sh
npm ci
npm run dev
```

Abra o endereço indicado pelo Vite. Para compilar e visualizar o resultado:

```sh
npm run build
npm run preview
```

No Windows, use `npm.cmd` se o PowerShell bloquear `npm.ps1`.

- Conteúdo: `src/LandingPage.jsx`.
- Componentes interativos: `src/SiteInteractions.jsx`.
- Animações e gráficos: `src/SiteMotion.jsx`.
- Estilos: `src/landing.css`, `src/interactions.css` e `src/motion.css`.
- Links de cadastro/login: `src/site-route.js`, sempre apontando para `https://app.solidcheckout.xyz`, inclusive no preview e em domínios temporários.
- Metadados e domínio canônico: `index.html`.

O site independente abre na raiz `/`. As cópias anteriores em `apps/web` permanecem no aplicativo; alterações futuras nesta pasta devem ser publicadas pelo serviço separado.

## Interações da landing page

- **Painel animado em destaque:** curva com transições entre conjuntos de dados, barras que acompanham o volume, contadores animados, períodos de 7/30 dias, seleção entre receita/pedidos e pontos exploráveis com mouse, toque e teclado. O botão “Simular nova venda” acrescenta um pedido fictício de R$ 149. Há uma tabela alternativa para leitura dos dados.
- **Efeitos visuais:** luzes e partículas no hero, cards flutuantes, texto com gradiente em movimento, traçado animado, entradas ao rolar a página, brilho que acompanha o cursor, inclinação dos cards, conexões orbitais, respostas de botões, scanner ilustrativo no Pix e confetes na conclusão simulada.
- **Controle de movimento:** “Pausar efeitos” interrompe animações e atualizações automáticas sem bloquear os controles. A preferência `prefers-reduced-motion` é respeitada. O gráfico atualiza a cada três segundos somente enquanto visível e ativo; pausa ao explorar seus pontos ou abrir a tabela. A atualização também para quando a aba do navegador fica oculta.

- **Demonstração de compra:** quantidade entre 1 e 5 kits, ecobag opcional, cupom `BEMVINDO` com 10% nos produtos, dados fictícios editáveis, entrega padrão ou expressa e revisão do pedido. É possível voltar nas etapas, corrigir dados, cancelar a simulação, copiar um texto de exemplo, simular a aprovação e reiniciar com ou sem preservar as escolhas.
- **Recursos:** prévia com nome e cores da marca, oferta complementar com total atualizado, resumo de gestão com períodos de 7 ou 30 dias e explicações clicáveis das etapas do checkout. Os dados de gestão são fictícios.
- **Detalhes da plataforma:** explicações expansíveis sobre domínio, produtos físicos/digitais e acessos da equipe.
- **Como funciona:** quatro etapas navegáveis, checklist de 12 itens, indicador de progresso e opção para limpar a lista. As marcações servem como planejamento local e não representam configurações realizadas na conta.
- **Integrações:** selecione Shopify, UTMify, Meta, Roas/WestPay ou Webhooks para ler a finalidade e os preparativos da conexão.
- **Dúvidas:** busca sem distinção de acentos, expansão e recolhimento das respostas, mensagem de busca vazia e botão para limpar.
- **Celular e teclado:** menu com acesso ao painel, fechamento por Escape, foco visível e controles nativos de formulário.

Não há criação de Pix, envio de formulários, autenticação, armazenamento de dados pessoais ou conexão com gateways na demonstração. O símbolo de QR Code e o texto copiável não são instrumentos de pagamento. Os preços, descontos e prazos do exemplo não representam condições comerciais da Pirat. Os links de cadastro e painel continuam apontando para o aplicativo real.

## Verificar

```sh
npm run test:site
```

A suíte usa o Chrome instalado e valida cálculos, cupom válido/inválido, limites de quantidade, validação de campos, preservação de dados ao voltar, simulação de pagamento, falha de cópia, editor, ofertas, períodos, checklist, integrações, FAQ, teclado, menu mobile, destinos de cadastro/login e a largura entre 320 e 1440 pixels. As capturas ficam em `.visual-check/`, incluindo `site-desktop.png`, `site-mobile-topo.png` e `site-mobile-demo-review.png`. Abra as imagens para revisar a aparência. Para Edge, defina `VISUAL_BROWSER_CHANNEL=msedge`.

O checkout apresentado é uma simulação. Os testes locais não autenticam no app nem validam pagamentos reais, DNS, HTTPS ou a publicação no Dokploy.

Para testar o contêiner em uma máquina com Docker:

```sh
docker build -t solid-site .
docker run --rm -p 8080:80 solid-site
```

Abra `http://localhost:8080`. O endpoint `/healthz` responde `ok`.

## Atualizar o ZIP

Na raiz do projeto original, execute no PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-site.ps1
```

O script inclui o código e a configuração, sem `node_modules`, builds, capturas ou arquivos de ambiente. Se copiar esta pasta para outro local, compacte seu conteúdo com o Dockerfile na raiz do ZIP, incluindo `.dockerignore` e excluindo essas pastas geradas.

## Fundo Glow Horizon e componentes

O fundo está em `src/components/ui/glow-horizon.tsx`, aplicado somente à abertura do site. Recebe `variant` (`top`, `bottom`, `left`, `right`; padrão `top`) e `className`. Não requer imagens, dados, providers ou estado de negócio. A animação respeita a preferência de movimento reduzido. O título animado do exemplo não foi incluído, para preservar o conteúdo existente.

Os estilos gerais continuam em `src/landing.css`, `src/interactions.css` e `src/motion.css`. O posicionamento do fundo está em `src/components/ui/glow-horizon.css`. Criamos `src/components/ui` para manter componentes visuais reutilizáveis no caminho convencional do shadcn, separado das seções da página. Os imports atuais são relativos; não há alias `@` configurado.

TypeScript e os tipos React estão instalados; execute `npm run typecheck`. O projeto usa CSS próprio, sem Tailwind ou configuração shadcn. As poucas classes utilitárias do exemplo foram convertidas em estilos equivalentes, evitando alterações globais nesta integração.

### Configuração opcional de Tailwind e shadcn

Para uma futura adoção, a partir de `solid-site`:

1. Execute `npm install tailwindcss @tailwindcss/vite`.
2. Em `vite.config.js`, importe `tailwindcss` de `@tailwindcss/vite` e adicione `tailwindcss()` aos plugins existentes.
3. Crie `src/tailwind.css` com `@import "tailwindcss";` e importe-o em `src/main.jsx`. Preserve os demais arquivos CSS e revise o efeito do reset global antes de publicar.
4. Adicione `"paths": { "@/*": ["./src/*"] }` a `compilerOptions` no `tsconfig.json`. No Vite, configure `resolve.alias` com `@` apontando para `src` via `fileURLToPath(new URL('./src', import.meta.url))`, importado de `node:url`.
5. Execute `npx shadcn@latest init` e use `src/tailwind.css` como CSS global e `@/components/ui` como alias de UI.

Referências: [shadcn com Vite](https://ui.shadcn.com/docs/installation/vite), [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite) e [movimento reduzido](https://motion.dev/docs/react-use-reduced-motion).
