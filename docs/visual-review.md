# Visualização local

Tente primeiro o navegador integrado disponível na sessão. Se a conexão falhar antes de abrir a página, há uma alternativa independente, usando o modo headless do Chrome/Edge instalado:

```powershell
npm.cmd run visual:check
npm.cmd run visual:check -- /c/loja/checkout
```

O comando compila o frontend, inicia um preview acessível apenas em `127.0.0.1`, captura desktop (1440×1000) e uma janela estreita (390×844), e encerra o preview. As imagens ficam em `.visual-check/desktop.png` e `.visual-check/mobile.png`. Abra as duas imagens para inspecioná-las; a execução bem-sucedida não aprova automaticamente o layout. Uma janela estreita não equivale à emulação completa de um celular.

Para o site institucional, prefira `npm.cmd run test:site`: a nova suíte Playwright define a largura real da página, espera a interface carregar, testa cliques e gera capturas completas. O capturador nativo acima pode recortar a imagem em janelas menores que o mínimo aceito pelo Chrome; por isso não deve ser usado sozinho para aprovar o layout mobile. Consulte `docs/marketing-site.md`.

O navegador usa um perfil novo em `.visual-check/run-*`, sem reutilizar o perfil pessoal ou sessões autenticadas. Essa pasta é ignorada pelo Git. As capturas podem conter dados da página escolhida. O processo não realiza login, envia formulários ou gera pagamentos. O endereço de API continua sendo o configurado no build; páginas com dados reais precisam da API disponível e da rota correta. Por padrão, a captura mostra o login.

Não é necessário instalar Playwright nem baixar outro navegador. Se o executável não estiver em um dos caminhos usuais, configure `VISUAL_BROWSER_PATH`. Se o Windows bloquear os subprocessos gráficos dentro do sandbox, solicite a execução autorizada de `node scripts/visual-check.mjs` fora dessa restrição, depois do build. Não desative o sandbox do Chrome.

## Diagnóstico do navegador integrado em 10/09/2026

Nas capturas Playwright de página inteira, use `animations: 'disabled'`: foi reproduzido um recuo incorreto do conteúdo durante a captura de uma transição de `margin-left`, embora o viewport normal e as posições medidas estivessem corretos. Confira também a imagem do viewport e os limites da barra lateral antes de atribuir o resultado a um defeito da aplicação. A suíte administrativa agora verifica a posição do conteúdo em relação ao menu e estabiliza as animações nas capturas completas.

O componente retornou `failed to write kernel assets ... (os error 3)` até em um comando mínimo, antes de importar o controlador de navegador. Reiniciar a sessão de automação não resolveu. Os caminhos configurados para Node e seus módulos existiam; havia processos de duas versões do componente em execução. Isso não estabelece a causa exata. Fechar e reabrir completamente o aplicativo é a próxima tentativa para recarregar os componentes. A conexão integrada ainda precisa ser retestada após isso.

A alternativa de capturas foi executada com sucesso no Windows e as duas imagens da tela de login foram abertas para inspeção. Ela resolve a visualização estática; não substitui testes interativos de login, carrinho e pagamento.

Referências: [navegador integrado da OpenAI](https://learn.chatgpt.com/docs/browser?surface=app) e [modo headless do Chrome](https://developer.chrome.com/docs/automation-and-testing/headless).
