# Auditoria técnica e de experiência — SOLID

> Registro histórico da análise. As alterações posteriores e suas verificações estão em [Correções da auditoria](REMEDIACAO-2026-09-10.md).

Data: 10/09/2026. Referência Git: `main`, commit `b3044d0`, incluindo a árvore de trabalho local existente no momento da análise.

O sistema tem uma base funcional, controles de segurança relevantes e testes passando. Os maiores riscos encontrados estão na consistência dos pagamentos, na distribuição do trabalho de reconciliação e em verificações de segurança que não refletem necessariamente o ambiente publicado. A recomendação é corrigir esses pontos antes de ampliar efeitos visuais ou adicionar novas integrações.

Foram organizados **16 pontos: 5 de alta prioridade, 8 de média e 3 de baixa**. Prioridade considera impacto e urgência de correção; não equivale a uma classificação CVSS. Não foi comprovada exploração, vazamento ou cobrança duplicada real em produção.

## Escopo e evidências

- Revisão de API, autenticação, autorização por loja, checkout público, gateways, webhooks, reconciliação, recuperação de carrinho, métricas, mídia, frontend, CI e configuração de deploy.
- A landing page separada tem alterações locais anteriores. Não foi republicada nem incluída como objeto de uma nova aprovação visual institucional. O foco desta auditoria é o sistema SOLID.
- `npm run check`: **exit code 0**, com **214 testes passando**, typecheck e builds concluídos. ESLint: **209 avisos, nenhum erro**. Os testes incluem 142 da API, 64 do frontend, 4 de configuração e 4 de autorização.
- Playwright: **24 testes de interface passando**. A suíte usa APIs simuladas e `bypassCSP: true`; portanto, não valida autenticação real, pagamentos reais ou a política CSP do ambiente publicado.
- Quatro testes adicionais de investigação reproduziram comportamentos incorretos: concorrência na criação de Pix, nova cobrança após falha de persistência, falta de alternância na reconciliação e receita de produto sem pagamento. Esses testes passam porque confirmam a existência dos problemas, não porque os corrigem.
- Semgrep Community Edition 1.177.0: **131 regras, 227 arquivos**, usando `p/security-audit` e `p/owasp-top-ten`. Um alerta automático foi revisado e não sustentou uma vulnerabilidade no uso encontrado.
- `npm audit --omit=dev --json`, com acesso efetivo ao registro: **6 pacotes classificados como high e 1 como moderate; nenhum critical**. Há dependências transitivas e exceções documentadas; não são sete vulnerabilidades independentes e comprovadamente exploráveis na aplicação.
- Consulta pública, somente leitura, a `https://app.solidcheckout.xyz/` e `/index.html`: ambas responderam HTTP 200. Cabeçalhos e HTML foram preservados localmente.
- Revisão visual: foram abertas as capturas de login `desktop.png` e `mobile.png`, além do editor em viewports reais de 390 e 768 px. A captura nativa `mobile.png` apresenta recorte da janela; esse recorte não foi classificado como defeito responsivo. As capturas Playwright são a referência para o editor em celular/tablet.

O navegador integrado estava indisponível antes de abrir páginas. Foi usada a alternativa local documentada, sem insistir na mesma inicialização. Não houve acesso ao banco de produção, alteração de dados de clientes, envio real de e-mail ou geração de Pix real.

## Prioridades

| ID | Prioridade | Ponto | Base da conclusão |
| --- | --- | --- | --- |
| 01 | Alta | Duas solicitações podem criar dois Pix para a mesma sessão | Reprodução com provedores/repositório simulados + código |
| 02 | Alta | Reconciliação pode atender repetidamente os mesmos pagamentos | Reprodução com relógio simulado + consulta do repositório |
| 03 | Alta | Dependências de produção com alertas de segurança | Consulta atual ao npm e avisos dos projetos |
| 04 | Alta | Auditoria de dependências pode aprovar quando a consulta falha | Reprodução determinística + falha real de consulta |
| 05 | Alta | Cabeçalhos previstos no projeto ausentes na resposta pública | GET de duas URLs públicas |
| 06 | Média | Estorno parcial convertido em estorno total | Inspeção de regras e lançamentos |
| 07 | Média | Pagamento tardio não conclui sessão já expirada | Inspeção de transição e limpeza |
| 08 | Média | Recuperação de carrinho pode ficar presa em processamento | Inspeção de seleção e tomada do trabalho |
| 09 | Média | Receita por produto inclui itens não pagos | Reprodução da resposta da API |
| 10 | Média | Dashboard carrega todos os registros do período | Inspeção de consultas; impacto de escala estimado |
| 11 | Média | Imagens acumulam sem ciclo de exclusão; cota não é atômica | Inspeção de upload e busca de rotinas de remoção |
| 12 | Média | CI não cobre banco real, concorrência e interface | Inspeção do workflow e dos testes |
| 13 | Média | Acessibilidade precisa de revisão sistemática | Avisos de lint e inspeção visual parcial |
| 14 | Baixa | Frontend pouco verificado por tipos e componentes extensos | Configuração e leitura do código |
| 15 | Baixa | CSS e alguns módulos oferecem espaço para otimização | Tamanhos do build; sem medição de campo |
| 16 | Baixa | Documentação de ameaças não acompanha o sistema atual | Comparação do documento inicial com a implementação |

## 01 — Idempotência da criação de Pix

**Gatilhos:** duas requisições enquanto a primeira cobrança ainda está sendo criada; ou o gateway cria o Pix, a gravação no banco falha e o cliente tenta novamente.

Em [public-checkout-routes.ts](../../apps/api/src/public-checkout-routes.ts), linhas 220–262, a reutilização depende de uma tentativa anterior com código Pix já persistido. A chave da nova tentativa inclui `Date.now()`. A sequência de consulta/criação não reserva atomicamente a operação. O tratamento `providerCreated` protege a requisição corrente, mas não resolve sozinho a tentativa seguinte após resultado incerto.

**Reprodução:** duas chamadas concorrentes chegaram ao provedor simulado e responderam 201; a função de criação foi executada duas vezes. No segundo cenário, a primeira resposta foi 503 por falha de persistência e a repetição respondeu 201, também com duas criações no provedor simulado.

**Impacto:** possibilidade de múltiplos códigos/cobranças para uma compra, cobrança externa sem associação local e conciliação difícil. O ensaio não usou PostgreSQL nem gateway real; demonstra a ausência de coordenação no fluxo da aplicação, não um incidente financeiro ocorrido.

**Correção:** criar uma identidade durável para cada intenção de pagamento, reservar sua criação atomicamente no banco e reutilizá-la nas repetições. Encaminhar uma chave estável ao gateway quando o contrato permitir. Quando o resultado externo for incerto, consultar/reconciliar a operação antes de autorizar outra criação.

**Aceite:** com PostgreSQL real e gateway controlado, chamadas simultâneas para a mesma intenção produzem uma cobrança. Queda após sucesso externo e antes da gravação recupera a cobrança original. Nova cobrança legítima após expiração continua possível por regra explícita.

## 02 — Reconciliação sem alternância suficiente

Em [roas-reconciliation.ts](../../apps/api/src/roas-reconciliation.ts), linhas 28–42, cada execução verifica até cinco registros; pendências voltam a ficar elegíveis após dois minutos. [gateway-repository.ts](../../apps/api/src/gateway-repository.ts), linhas 194–195, sempre seleciona os 50 mais antigos na janela de 24 horas.

**Reprodução:** com 50 transações que continuam pendentes, cinco minutos de relógio simulado produziram 30 consultas, mas somente dez transações distintas foram consultadas. As outras 40 não receberam consulta nesse período. Se as primeiras mantiverem esse comportamento, a repetição pode continuar; registros fora dos primeiros 50 também não entram na seleção. A janela de 24 horas limita ainda mais a recuperação de pendências antigas.

**Correção:** persistir `nextCheckAt`, buscar registros efetivamente vencidos para verificação e ordenar pela próxima execução. Usar lotes com alternância entre lojas e manter uma política explícita para pendências antigas. Limites do provedor devem controlar o ritmo sem impedir que outros registros sejam atendidos.

**Aceite:** um lote de 100 pendências recebe consultas distribuídas dentro do prazo definido; reinício do processo mantém os agendamentos; existe alerta para idade da pendência mais antiga. Webhooks continuam como caminho rápido, sem serem a única forma de evitar atraso.

## 03 — Atualização de dependências

A consulta encontrou sete pacotes sinalizados. Quatro dos seis classificados como high estão abrangidos pela exceção temporária de Prisma: `prisma`, `@prisma/config`, `deepmerge-ts` e `mysql2`. O projeto usa PostgreSQL e a presença de `mysql2` na cadeia do CLI não comprova exposição de um servidor MySQL na aplicação.

Os dois high fora da exceção são **`sharp` e `fast-uri`**. **`fastify`** aparece como moderate. Com a consulta funcionando, `npm run audit:prod` retorna falha corretamente para os alertas fora da exceção.

- `sharp` instalado: 0.35.3; o aviso indica correção em 0.35.4. A aplicação processa imagens enviadas por usuários em [media-routes.ts](../../apps/api/src/media-routes.ts), linhas 18–22. A declaração MIME vem do cliente, enquanto o decodificador identifica os bytes; restringir o MIME anunciado não elimina por si só o risco de um decodificador vulnerável. Não foi executada imagem maliciosa. [Aviso de segurança do sharp](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).
- `fast-uri`: atualizar a versão transitiva conforme a linha compatível e verificar novamente a árvore. Há avisos envolvendo interpretação de endereços; não foi comprovada exploração dessas falhas no código SOLID. A proteção de webhooks de saída também faz suas próprias verificações de URL/DNS. [Aviso do fast-uri](https://github.com/advisories/GHSA-f65p-4m7j-42xc).
- `fastify` instalado: 5.12.0; a consulta oferece atualização para 5.12.3. Validar rotas, hooks e tratamento de requisições após atualizar. [Aviso do Fastify](https://github.com/advisories/GHSA-w2qp-rph6-63g4).

**Aceite:** atualizar versões compatíveis e lockfile, executar os testes e a auditoria online. Não aplicar `npm audit fix --force` indiscriminadamente: a solução sugerida para parte da cadeia Prisma envolve mudança incompatível. Exceções remanescentes devem registrar aviso, versão, exposição e expiração.

## 04 — Verificação de segurança aceita erro como sucesso

[scripts/audit-production.mjs](../../scripts/audit-production.mjs), linhas 14–32, interpreta JSON e usa `report.vulnerabilities ?? {}`. Um JSON de erro do npm, sem esse campo, vira uma lista vazia e pode gerar `No high or critical production vulnerabilities found.` com saída 0.

O comportamento apareceu durante uma consulta sem acesso efetivo ao registro e foi reproduzido separadamente com uma resposta de erro controlada. Portanto, um resultado verde desse script não prova que a consulta ocorreu.

A exceção também é baseada em nomes de pacotes. O uso de `.some(...)` para encontrar o aviso esperado permite que outro aviso do mesmo pacote coexista sem necessariamente invalidar a exceção.

**Correção:** validar erro de execução, resposta de erro, estrutura e metadados do relatório. Distinguir o código de saída esperado por vulnerabilidades de uma falha de infraestrutura. Autorizar somente os avisos e versões explicitamente revisados, com prazo de validade.

**Aceite:** rede indisponível, JSON inválido, JSON de erro e relatório incompleto falham; relatório válido sem vulnerabilidades passa; novo aviso em pacote já excepcionado falha.

## 05 — Configuração de segurança divergente no domínio público

Em 10/09/2026, às 23:18 UTC, as respostas públicas de `/` e `/index.html` não continham `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` ou `Cache-Control`.

[deploy/nginx-web.conf](../../deploy/nginx-web.conf), linhas 30–36, prevê cabeçalhos de segurança, e [Dockerfile.web](../../Dockerfile.web), linha 16, copia essa configuração. A observação confirma divergência na resposta final, mas não identifica se a origem é imagem publicada, configuração ativa, hospedagem ou proxy.

**O HTML contém CSP em meta tag.** Portanto, não se trata de ausência completa de CSP. Entretanto, `frame-ancestors` não funciona por meta tag; deve ser enviado por cabeçalho. [Documentação de frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

**Correção:** verificar qual configuração realmente atende o domínio e aplicar os cabeçalhos na resposta final. Definir cache do HTML administrativo de forma explícita, mantendo cache longo para assets com hash. Ajustar política de incorporação por superfície: painel e checkout podem ter necessidades diferentes.

**Aceite:** um teste HTTP após o deploy, passando pelo domínio público/CDN, verifica os cabeçalhos. Validar login, editor, checkout e integrações com CSP ativa, sem o bypass usado na suíte local.

## 06 — Estorno parcial perde o valor efetivamente devolvido

[payment-rules.ts](../../apps/api/src/payment-rules.ts), linha 9, e [roas-reconciliation.ts](../../apps/api/src/roas-reconciliation.ts), linha 14, convertem `PARTIALLY_REFUNDED` em `REFUNDED`. O lançamento em [gateway-repository.ts](../../apps/api/src/gateway-repository.ts), linhas 247–256, usa o valor integral da taxa original para o crédito.

Isso elimina a distinção entre devolução parcial e total na representação local e pode distorcer indicadores e créditos de taxa. A política comercial de devolução de taxas precisa ser confirmada; o problema comprovado é a perda da informação de parcialidade.

**Correção e aceite:** persistir valor devolvido, identificar cada evento de estorno e representar saldo líquido. Testar devolução parcial, segunda devolução, repetição do mesmo evento e estorno total, com política de taxa explícita e sem crédito duplicado.

## 07 — Pagamento após expiração deixa estados contraditórios

Em [gateway-repository.ts](../../apps/api/src/gateway-repository.ts), linhas 232–241, a tentativa pode transicionar para `PAID`, mas a sessão só muda para `COMPLETED` se ainda estiver `OPEN`. Uma sessão já `EXPIRED` permanece expirada.

[security-cleanup.ts](../../apps/api/src/security-cleanup.ts), linhas 46–50, seleciona sessões expiradas/canceladas para anonimização sem excluir pagamentos confirmados. A combinação pode classificar uma compra paga como expirada e, futuramente, aplicar a retenção de abandono a seus dados.

**Correção e aceite:** definir o tratamento de confirmação oficial tardia, sincronizar os estados e excluir compras pagas da limpeza de abandonos. Testar expiração antes do webhook, confirmação após a expiração, uso de cupom e execução da limpeza. A rotina de envio de recuperação já verifica pagamento; não foi concluído que ela envia e-mails para compras pagas.

## 08 — Trabalho interrompido pode permanecer em PROCESSING

[abandoned-recovery.ts](../../apps/api/src/abandoned-recovery.ts), linhas 78–80, busca somente `PENDING` e altera o registro para `PROCESSING`. Se o processo cair após essa alteração, o filtro de `claimedAt` antigo não o recupera, pois o status já não é `PENDING`.

Além disso, a chamada de envio na linha 63 não tem prazo máximo explícito. Há padrão semelhante no envio de confirmação de compra. Uma requisição muito demorada pode prolongar o bloqueio da execução.

**Correção e aceite:** recuperar `PROCESSING` com reserva expirada, usar um identificador da reserva para impedir finalizações de execuções antigas e impor timeout aos serviços externos. Preservar a idempotência já presente no envio. Matar o worker após a reserva deve permitir a retomada e uma única entrega lógica.

## 09 — Receita por produto inclui carrinho não pago

[dashboard-routes.ts](../../apps/api/src/dashboard-routes.ts), linhas 135–138, soma itens de todas as sessões criadas ao montar `analytics.products`, sem filtrar confirmação de pagamento.

**Reprodução:** uma sessão sem qualquer pagamento, com item de R$ 100, retornou receita geral igual a zero e receita de produto igual a R$ 100.

**Correção e aceite:** separar interesse no produto/valor em carrinhos de quantidade vendida/receita paga. Definir datas e tratamento de descontos, frete e estornos. Uma sessão não paga não deve aumentar uma métrica apresentada como receita; caso a intenção seja medir carrinhos, nomear o campo e o rótulo de acordo.

## 10 — Custo do dashboard cresce com todo o histórico consultado

[dashboard-routes.ts](../../apps/api/src/dashboard-routes.ts), a partir da linha 64, carrega sessões, itens, parâmetros de rastreamento e tentativas do período, além dos pagamentos, para agregar em JavaScript. O cache curto ajuda repetições, mas não limita o custo da primeira consulta nem substitui agregação no banco.

**Correção:** agregar valores e contagens no PostgreSQL; avaliar consolidação diária para períodos longos. Limitar consultas detalhadas, definir índices a partir das consultas reais e medir memória/latência por volume.

**Aceite:** comparar resultados com fixtures conhecidas e medir um cenário representativo de loja grande. Não foi executado teste de carga no banco real; o risco de lentidão é inferido da estratégia de consulta, não de uma queda observada.

## 11 — Mídia sem limpeza e cota sujeita a concorrência

[media-routes.ts](../../apps/api/src/media-routes.ts), linhas 51–57, soma o uso e depois insere o arquivo. A cota é 100 MB por loja e 250 MB para mídia da plataforma. Não foi encontrada uma rotina correspondente de exclusão/coleta de arquivos sem referência; remover a imagem da configuração não libera por si só o registro armazenado.

Uploads concorrentes também podem aprovar a mesma disponibilidade, pois a soma e a gravação não reservam espaço atomicamente.

**Correção e aceite:** biblioteca com reutilização e exclusão segura, verificação de referências antes de remover, período de proteção para rascunhos e contabilização atômica. Testar troca repetida de banner, imagem compartilhada por dois checkouts e uploads concorrentes próximos da cota. Avaliar armazenamento de objetos quando o volume justificar, sem exigir migração imediata.

## 12 — Ampliar as verificações obrigatórias do CI

[.github/workflows/ci.yml](../../.github/workflows/ci.yml) executa build, `check` e auditoria de dependências. Não executa os testes Playwright nem sobe PostgreSQL/Redis para validar comportamento integrado. Os testes com repositórios simulados são úteis, mas não verificam isolamento de transações, restrições reais ou recuperação após falhas.

**Próxima cobertura:** testes de concorrência de pagamentos no PostgreSQL, eventos repetidos/fora de ordem, acesso negado entre lojas, migrações e retomada de filas. Adicionar a suíte de interface em um job separado e uma análise estática com triagem explícita.

**Aceite:** uma regressão em qualquer cenário financeiro reproduzido nesta auditoria impede o merge; o teste da correção deve afirmar o comportamento correto, invertendo a expectativa dos testes de investigação.

## 13 — Acessibilidade e pequenos ajustes de experiência

O lint retorna 209 avisos. Entre eles há 161 de controles sem nome associado, oito de autofocus e avisos de interação sem semântica adequada. Esses números são sinais de triagem: não equivalem a 161 falhas de acessibilidade verificadas, pois componentes intermediários podem exigir interpretação.

Visualmente, o editor mantém boa organização em celular e tablet, com alternância de personalização/prévia e ações fixas no celular. Um ajuste concreto: em 390 px, a instrução ainda diz “acompanhe o resultado ao lado”, embora a prévia esteja em outra aba. Adaptar o texto ao modo móvel.

**Correção e aceite:** nomes acessíveis em botões de ícone, labels nos campos, foco visível e retorno de foco ao fechar diálogos. Verificar teclado, leitor de tela e contraste dos temas reais; acrescentar análise automatizada com axe. Testar teclado virtual, zoom, orientação horizontal e preferência de movimento reduzido. Esta revisão visual parcial não constitui certificação WCAG.

## 14 — Tipagem, divisão de componentes e estados de requisição

[apps/web/tsconfig.json](../../apps/web/tsconfig.json), linha 5, usa `checkJs: false`. Assim, o typecheck aprovado não valida a maior parte da lógica escrita em JSX/JavaScript.

`CheckoutEditor.jsx` tem aproximadamente 2.057 linhas, `PublicCheckout.jsx` 1.446 e `OrderWorkspace.jsx` 1.006. A complexidade dificulta revisar estados e manter coerência entre prévia e checkout real.

**Melhoria:** introduzir tipos primeiro nos contratos de API/configuração/pagamento; extrair responsabilidades conforme os arquivos forem alterados. Compartilhar regras e elementos entre prévia e checkout onde isso preservar o comportamento real. Em [api.js](../../apps/web/src/api.js), a camada de fetch não fornece timeout geral: definir cancelamento e recuperação contextual para ações que podem ficar aguardando, evitando repetição automática de mutações financeiras.

**Aceite:** contratos inválidos são detectados antes do build; salvar/publicar exibem erro recuperável em conexão interrompida e preservam o rascunho. Não é necessário reescrever todo o frontend para obter esses ganhos.

## 15 — Otimização orientada a medidas

No build observado, o CSS administrativo ficou em cerca de 366,21 kB (66,66 kB gzip), e o CSS público em 104,42 kB (17,47 kB gzip). O módulo do mapa ficou em aproximadamente 395,84 kB (152,43 kB gzip). Esses tamanhos são do build, não métricas de experiência real.

O mapa e o editor já usam carregamento sob demanda; o tamanho de um chunk não significa que toda página o baixe inicialmente. O módulo principal administrativo está em cerca de 127,36 kB, resultado de otimizações anteriores.

**Melhoria e aceite:** medir LCP, INP e CLS por rota em dispositivo móvel; dividir estilos por funcionalidade, remover regras redundantes e priorizar os recursos efetivamente usados acima da dobra. Definir orçamento de transferência e latência depois da medição inicial. Efeitos e gráficos devem pausar fora da tela e respeitar movimento reduzido.

## 16 — Atualizar o modelo de ameaças e os procedimentos operacionais

[THREAT_MODEL.md](THREAT_MODEL.md) se identifica como documento inicial, anterior à autenticação, banco e pagamentos. Isso preserva o contexto histórico, mas deixa sem cobertura documentada grande parte do sistema atual.

**Melhoria:** criar a versão atual do modelo, incluindo limites entre lojas, gateways, checkout público, provedores de mensagens, mídia, dados pessoais, filas e administração. Documentar recuperação de criação de Pix com resultado incerto e critérios para interromper/retomar processamentos.

Há orientações de backup no repositório; sua existência não prova que os backups estejam sendo executados ou que uma restauração funcione. Registrar teste de restauração, responsável e prazo de recuperação. Redis, confiança em proxy, restrições de ingresso, alertas e configuração efetiva do deploy precisam ser verificados no ambiente operacional, sem presumir que estejam incorretos.

## Controles positivos observados

- Sessões com tokens opacos armazenados como hash, expiração e revogação; cookies de produção com proteções adequadas e senhas com scrypt.
- Verificação de origem e token CSRF vinculado à sessão nas operações revisadas.
- Resolução de contexto e associação do usuário à loja nas rotas administrativas inspecionadas.
- Cálculo de valores no servidor e consulta ao provedor para confirmar pagamentos, em vez de confiar somente no conteúdo recebido no webhook.
- Proteções de URL/DNS nos webhooks de saída, persistência de entregas e tentativas limitadas.
- Criptografia de credenciais e dados sensíveis, limites de upload e de pixels, conversão de imagens para WebP.
- Separação de módulos frontend e testes locais de editor, navegação e responsividade.

Essas observações não substituem testes completos de autorização ou uma avaliação ofensiva. O único alerta do Semgrep foi `request-host-used` em `deploy/nginx-web.conf:9`: nesse trecho, `$host` seleciona documentos locais fixos via `map`. Não foi encontrada interpolação do host em redirecionamento ou destino arbitrário que sustentasse a vulnerabilidade sugerida. O alerta não foi contado entre os 16 pontos.

## Ordem sugerida de execução

1. **Segurança e integridade imediatas:** corrigir a auditoria que aceita erro, atualizar dependências compatíveis e alinhar os cabeçalhos publicados; em paralelo de planejamento, preparar a correção de idempotência e da reconciliação com testes de banco real.
2. **Consistência operacional:** resolver estornos parciais, pagamentos tardios e retomada de trabalhos interrompidos. Corrigir as métricas de produto e colocar esses cenários no CI.
3. **Escala e experiência:** melhorar consultas do dashboard, ciclo de mídia, acessibilidade, estados de erro e mensagens móveis; depois otimizar os recursos medidos como gargalo.
4. **Manutenção contínua:** atualizar documentação, ampliar tipagem gradualmente e estabelecer métricas de tempo de confirmação, idade das filas, falhas por provedor e desempenho móvel.

## Artefatos locais e limites de reprodução

Os arquivos abaixo ficam em `.visual-check/`, diretório ignorado pelo Git. Permanecem disponíveis nesta máquina, mas não acompanham automaticamente o versionamento deste relatório.

| Artefato | Conteúdo |
| --- | --- |
| `audit-check-verified.json` / `audit-check-verified.log` | Saída real e log de `npm run check` |
| `audit-ui.log` | Resultado dos 24 testes Playwright |
| `audit-payment-probes.test.ts` | Três reproduções de pagamentos/reconciliação |
| `audit-dashboard-probe.test.ts` | Reprodução de receita de produto não pago |
| `audit-false-success-probe.mjs` | Reprodução da aprovação indevida da auditoria |
| `audit-npm-online.json` | Relatório completo de dependências na data |
| `audit-semgrep.json` | Resultado de análise estática |
| `audit-live-app-headers.txt` / `audit-live-index-headers.txt` | Respostas públicas observadas |
| `desktop.png` / `mobile.png` | Login; captura móvel nativa sujeita a recorte |
| `responsive-editor-390.png` / `responsive-editor-768.png` | Editor em viewports reais do Playwright |

Comandos principais de verificação no Windows:

```powershell
npm.cmd run check
npm.cmd run audit:prod
npx.cmd playwright test --config scripts/admin-ui.config.mjs
npx.cmd vitest run .visual-check/audit-payment-probes.test.ts .visual-check/audit-dashboard-probe.test.ts
node .visual-check/audit-false-success-probe.mjs
```

Não foram validados nesta auditoria: liquidação/reembolso com gateway real, autenticação real em produção, carga de banco, migração em cópia de produção, restauração de backup, configuração interna do proxy/CDN, comportamento de e-mail real ou todos os fluxos com tecnologia assistiva. Os pontos que dependem dessas verificações estão identificados acima.

Esta entrega registra a auditoria e suas reproduções locais. As correções de produto e infraestrutura descritas ainda precisam ser implementadas e verificadas; nenhum push ou deploy foi realizado por esta auditoria.
