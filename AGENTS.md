# Revisão visual

Para inspecionar interfaces, tente primeiro o navegador integrado seguindo a skill Browser disponível na sessão. Se ele falhar antes de abrir páginas, use a alternativa documentada em `docs/visual-review.md`: `npm.cmd run visual:check` no Windows, ou `npm run visual:check` em outros sistemas.

Abra as capturas `.visual-check/desktop.png` e `.visual-check/mobile.png` com a ferramenta de imagens antes de afirmar que fez uma revisão visual. O comando sozinho não verifica a aparência nem o fluxo de pagamento. Informe separadamente o que foi visualizado e o que ainda depende de API, autenticação ou teste interativo. Não repita indefinidamente a inicialização de um componente que continua retornando o mesmo erro.
