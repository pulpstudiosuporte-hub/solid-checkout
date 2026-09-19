# Revisão visual

Para inspecionar interfaces, tente primeiro o navegador integrado seguindo a skill Browser disponível na sessão. Se ele falhar antes de abrir páginas, use a alternativa documentada em `docs/visual-review.md`: `npm.cmd run visual:check` no Windows, ou `npm run visual:check` em outros sistemas.

Abra as capturas `.visual-check/desktop.png` e `.visual-check/mobile.png` com a ferramenta de imagens antes de afirmar que fez uma revisão visual. O comando sozinho não verifica a aparência nem o fluxo de pagamento. Informe separadamente o que foi visualizado e o que ainda depende de API, autenticação ou teste interativo. Não repita indefinidamente a inicialização de um componente que continua retornando o mesmo erro.

Para o site institucional, prefira `npm.cmd run test:site` (ou `npm run test:site`) e inspecione `.visual-check/site-desktop.png` e `.visual-check/site-mobile-topo.png`. Essa suíte define o viewport real com Playwright; o capturador nativo pode recortar janelas estreitas. Veja `docs/marketing-site.md`.

# Publicação e novidades

Toda nova capacidade de integração, CLI ou mudança de contrato para desenvolvedores deve atualizar a documentação pública correspondente no mesmo conjunto de alterações. Inclua exemplos executáveis, requisitos e limites reais; não documente capacidades planejadas como disponíveis.

A documentação pública é exclusiva para desenvolvedores: ensine a integrar e estender a Pirat com CLI, temas, contratos, autenticação, webhooks, exemplos executáveis, erros e limites. Atualize-a quando uma implementação mudar o que um desenvolvedor pode fazer ou como integrar. Não inclua tutoriais gerais de lojista, histórico de novidades, anúncios ou descrições de redesign. Mudanças apenas visuais não exigem atualização dos guias. Anúncios e melhorias entregues pertencem à área Novidades.

A cada deploy com mudanças para o usuário, inclua no mesmo conjunto de alterações uma publicação em `automaticReleases` (`apps/api/src/admin-content-routes.ts`) descrevendo as funcionalidades, melhorias ou correções entregues. Use identificador estável e único, categoria adequada e texto curto em português voltado ao lojista. Preserve publicações e edições manuais existentes; não envie notificações em massa sem pedido explícito. Confirme separadamente push, deploy e validação em produção.

Toda nova integração do catálogo deve aparecer também no seletor de imagens em Administração → Conteúdo → Integrações. Mantenha `apps/web/src/integration-catalog.js` como fonte compartilhada desses itens e reutilize a imagem cadastrada nas telas da integração.
