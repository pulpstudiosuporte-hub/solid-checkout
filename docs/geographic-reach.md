# Alcance geográfico

## Correções

O Início e Análises agora usam um globo 3D como visualização principal. Consulte [Globo 3D](globe-3d.md) para implementação, dependências, estilos e validação. As regras de projeção e recorte abaixo continuam aplicáveis à alternativa **Mapa plano**; o globo usa a esfera completa com textura equiretangular.

O fundo estático foi gerado com dotted-map 3.1.0, projeção Mercator elipsoidal WGS84 e recorte de latitude -56 a 71 e longitude -168 a 168. Os marcadores usavam anteriormente uma projeção linear de latitude/longitude e limites mundiais diferentes. O módulo `world-map-projection.js` usa os limites e a projeção do fundo. Ambos agora estão no mesmo SVG, evitando divergências de escala no celular. A projeção foi confrontada com pontos de terra do próprio SVG para São Paulo, Manaus, Brasília, Nova York, Londres e Tóquio.

Coordenadas nulas, vazias, inválidas, o par 0/0 e pontos fora do recorte não viram marcadores. Regiões sem cidade não são descartadas quando têm coordenadas válidas. O alcance mostra a lista de cidades/regiões e informa quando uma localização não tem ponto disponível.

Na consulta de geografia, somente pares completos e válidos contribuem para a média da cidade/região. O servidor não completa coordenadas com o centro do país. Dados históricos sem coordenadas permanecem sem ponto; não são retroativamente geolocalizados. Os totais de visitantes e localidades continuam contando os metadados identificados.

## Configuração em produção

No domínio Cloudflare que recebe as chamadas da API, habilite **Add visitor location headers** em Managed Transforms. O recurso envia `cf-ipcity`, `cf-region`, `cf-region-code`, `cf-iplatitude` e `cf-iplongitude`. Apenas ativar IP Geolocation pode fornecer somente o país. Confira se o proxy até a API preserva esses cabeçalhos e se o acesso ao servidor de origem está restrito ao tráfego confiável da Cloudflare.

A geolocalização por IP é aproximada: operadora, VPN e rede móvel podem indicar outra cidade. O painel não solicita GPS nem garante rua, residência ou cidade exata. Se a origem dos dados informar uma localização errada, acertar a projeção não corrige essa origem.

Fontes: [Cloudflare — IP geolocation](https://developers.cloudflare.com/network/ip-geolocation/), [Managed Transforms](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/), [projeção e limites do dotted-map](https://github.com/NTag/dotted-map/blob/main/src/with-countries.ts).

## Validação

- `npm.cmd run check`: tipos, lint, testes unitários, builds e limites dos bundles.
- `npx.cmd playwright test --config scripts/geography-ui.config.mjs`: pontos e lista, coordenadas ausentes, período e layout desktop/mobile com dados simulados.
- `npm.cmd run test:integration`: valida pares incompletos no PostgreSQL usando `TEST_DATABASE_URL` em banco isolado `*_test`.
- Capturas: `.visual-check/desktop.png` e `.visual-check/mobile.png`.

A configuração dos cabeçalhos e a localização fornecida para visitas reais ainda precisam ser conferidas em produção. A entrada nas Novidades está preparada junto desta correção.
