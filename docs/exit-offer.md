# Oferta de saída

Em **Personalização → Experiência de compra → Oferta de saída**, o lojista pode ativar o popup, escolher um cupom existente, editar textos e cores, definir o tempo mínimo de permanência (5–120 segundos), habilitar o comportamento no celular e visualizar uma prévia. Salve o rascunho e publique o checkout para aplicar aos compradores. Crie e gerencie os descontos em **Marketing → Cupons**.

## Comportamento

- Por tempo: ativado por padrão nas ofertas habilitadas, abre após 30 segundos, mesmo sem interação. O lojista pode desativar ou ajustar entre 5 e 300 segundos em "Mostrar também por tempo". Funciona no computador e no celular; aguarda se houver outro diálogo aberto ou uma operação em andamento. Esse prazo é independente do tempo mínimo para detectar saída e da validade do desconto.
- Computador: depois do tempo mínimo, detecta o cursor se aproximando dos 24 px superiores ou saindo pelo topo da página, sem exigir clique ou tecla antes.
- Celular: depois do tempo mínimo, detecta a rolagem de mais de 250 px de volta para menos de 80 px do topo. Pode ser desativado pelo lojista.
- Não altera o histórico, intercepta o botão Voltar ou impede fechar a aba. A aproximação do dedo ao botão Voltar não é exposta pelo navegador. Eventos de saída não permitem um popup personalizado confiável, especialmente em celulares; veja [MDN: beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
- Exibe uma vez por sessão de checkout e código de cupom, usando sessionStorage. Se o navegador bloquear esse armazenamento, evita repetição durante a montagem atual da página.
- Não exibe quando já existe cupom, quando o pagamento começou, durante outra operação ou sobre outro dialog aberto.
- Escape, fechar e recusar devolvem o foco ao elemento anterior. O botão ajusta automaticamente a cor do texto ao destaque escolhido.

## Desconto e validade

`GET /public/checkout-sessions/:sessionId/exit-offer` exige o token opaco da sessão, consulta somente o cupom da configuração publicada e da mesma loja e não permite cache. A oferta respeita início, fim, valor mínimo, limite de usos e teto do desconto. Cupons com teto mostram o valor efetivo, sem prometer um percentual integral.

Aceitar chama a aplicação de cupom existente, que revalida o desconto no servidor. O contador termina no menor prazo entre a validade do cupom e a sessão, não reinicia ao recarregar e desabilita a aceitação quando expira. Ele não reserva disponibilidade do cupom. A prévia é identificada como demonstrativa e usa subtotal de R$ 100 com contador de cinco minutos.

A funcionalidade usa as configurações JSON e os cupons existentes, sem migração própria. A entrada automática de Novidades é `auto-20260912-exit-offer`, seguindo a publicação idempotente existente.

## Validação local

```powershell
npm.cmd run check
npx.cmd playwright test --config scripts/exit-offer-ui.config.mjs
```

Os testes de API verificam autenticação, isolamento por loja, elegibilidade, limites, validade e persistência/validação dos campos. A suíte de navegador usa os componentes reais com respostas simuladas: edição e salvamento, aplicação no total, recusa, erro, expiração, foco, ausência de repetição e rolagem mobile sem mudança de histórico. Captura `.visual-check/desktop.png` e `.visual-check/mobile.png` para inspeção.

Esses testes não processam pagamento real. Após o deploy, valide com uma loja de teste um cupom publicado e uma sessão real antes de habilitar em checkouts ativos.
