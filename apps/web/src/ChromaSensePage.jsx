import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Flame,
  HelpCircle,
  ListVideo,
  MousePointerClick,
  RefreshCw,
  ScanSearch,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { getChromaSense } from "./api";
import { CheckoutAnalyticsPreview } from "./CheckoutEditor";
import "./chromasense-page.css";

const empty = {
  summary: {
    sessions: 0,
    clickSessions: 0,
    clicks: 0,
    attentionMs: 0,
    conversionRate: 0,
    insightCount: 0,
  },
  checkouts: [],
  points: { click: [], move: [], attention: [] },
  scroll: { average: 0, distribution: [0, 0, 0, 0] },
  topTargets: [],
  insights: [],
  sessions: [],
};
const periods = [
  ["today", "Hoje"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
];
const views = [
  ["click", "Cliques"],
  ["move", "Movimentos"],
  ["scroll", "Rolagem"],
  ["attention", "Atenção"],
];
const tabs = [
  ["heatmap", "Mapa de calor"],
  ["sessions", "Sessões"],
  ["insights", "Insights"],
  ["help", "Ajuda"],
];
const duration = (value) =>
  value >= 60_000
    ? `${Math.floor(value / 60_000)}min ${Math.round((value % 60_000) / 1000)}s`
    : `${Math.round(value / 1000)}s`;

function HeatPoint({ point, index, type }) {
  const size =
    type === "attention"
      ? Math.min(92, 34 + point.weight * 5)
      : type === "move"
        ? 34
        : 46;
  return (
    <i
      className={`chroma-point ${type}`}
      style={{
        left: `${point.x * 100}%`,
        top: `${point.y * 100}%`,
        width: size,
        height: size,
        "--delay": `${(index % 7) * -0.13}s`,
      }}
      aria-hidden="true"
    />
  );
}

function CheckoutSurface({ points, type, scroll, checkout }) {
  return (
    <div
      className={`chroma-surface view-${type}`}
      aria-label={`Visualização do mapa de ${views.find(([key]) => key === type)?.[1].toLowerCase()}`}
    >
      {checkout?.preview?.config ? (
        <div className="chroma-real-checkout">
          <CheckoutAnalyticsPreview
            config={checkout.preview.config}
            product={checkout.preview.product}
          />
        </div>
      ) : (
        <div className="chroma-preview-empty">
          <ScanSearch />
          <b>Selecione um checkout publicado</b>
          <span>O mapa sera aplicado sobre o layout real em uso.</span>
        </div>
      )}
      {type === "scroll" ? (
        <div className="chroma-scroll-overlay">
          <div style={{ height: `${Math.max(4, scroll.average)}%` }} />
          <span>Profundidade média: {scroll.average}%</span>
        </div>
      ) : (
        points.map((point, index) => (
          <HeatPoint
            key={`${point.x}-${point.y}-${index}`}
            point={point}
            index={index}
            type={type}
          />
        ))
      )}
    </div>
  );
}

export default function ChromaSensePage({ storeKey }) {
  const [period, setPeriod] = useState("7d");
  const [checkoutId, setCheckoutId] = useState("");
  const [tab, setTab] = useState("heatmap");
  const [view, setView] = useState("click");
  const [state, setState] = useState({ ...empty, loading: true, error: "" });
  const load = () => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    getChromaSense({ period, checkoutId }, controller.signal)
      .then((result) => {
        setState({
          ...empty,
          ...result,
          summary: { ...empty.summary, ...result.summary },
          points: { ...empty.points, ...result.points },
          scroll: { ...empty.scroll, ...result.scroll },
          loading: false,
          error: "",
        });
        if (!checkoutId && result.checkouts?.[0]?.publicId)
          setCheckoutId(result.checkouts[0].publicId);
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message,
          }));
      });
    return controller;
  };
  useEffect(() => {
    const controller = load();
    return () => controller.abort();
  }, [period, checkoutId, storeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const points = useMemo(
    () => (Array.isArray(state.points?.[view]) ? state.points[view] : []),
    [state.points, view],
  );
  const selectedCheckout = useMemo(
    () =>
      state.checkouts.find((checkout) => checkout.publicId === checkoutId) ||
      state.checkouts[0] ||
      null,
    [state.checkouts, checkoutId],
  );
  const priority =
    state.insights?.filter((item) => item.severity === "high").length || 0;
  return (
    <main className="page chroma-page">
      <section className="page-title chroma-title">
        <div>
          <p className="eyebrow">COMPORTAMENTO</p>
          <h1>ChromaSense</h1>
          <p>
            Mapas de calor e insights sobre o comportamento real no checkout.
          </p>
        </div>
        <button className="secondary" onClick={load} disabled={state.loading}>
          <RefreshCw size={17} className={state.loading ? "spin" : ""} />{" "}
          Atualizar
        </button>
      </section>
      {state.error && (
        <div className="chroma-error" role="alert">
          <AlertTriangle size={18} />
          <span>
            <b>Não foi possível carregar o ChromaSense.</b>
            {state.error}
          </span>
          <button onClick={load}>Tentar novamente</button>
        </div>
      )}
      <section className="chroma-kpis" aria-label="Resumo do ChromaSense">
        <article>
          <span>Sessões no período</span>
          <ListVideo />
          <strong>{state.summary.sessions.toLocaleString("pt-BR")}</strong>
          <small>{state.summary.clickSessions} com interação</small>
        </article>
        <article>
          <span>Cliques mapeados</span>
          <MousePointerClick />
          <strong>{state.summary.clicks.toLocaleString("pt-BR")}</strong>
          <small>{duration(state.summary.attentionMs)} de atenção</small>
        </article>
        <article>
          <span>Insights prioritários</span>
          <Sparkles />
          <strong>{state.summary.insightCount}</strong>
          <small>{priority} de severidade alta</small>
        </article>
        <article>
          <span>Conversão observada</span>
          <BarChart3 />
          <strong>{state.summary.conversionRate}%</strong>
          <small>Sessões que concluíram</small>
        </article>
      </section>
      <section className="card chroma-workspace">
        <div className="chroma-tabs" role="tablist">
          {tabs.map(([key, label]) => {
            const Icon =
              key === "heatmap"
                ? Flame
                : key === "sessions"
                  ? ListVideo
                  : key === "insights"
                    ? Sparkles
                    : HelpCircle;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                <Icon size={16} />
                {label}
                {key === "insights" && state.summary.insightCount > 0 && (
                  <em>{state.summary.insightCount}</em>
                )}
              </button>
            );
          })}
        </div>
        <div className="chroma-toolbar">
          <div className="chroma-segments" aria-label="Período">
            {periods.map(([key, label]) => (
              <button
                aria-pressed={period === key}
                className={period === key ? "active" : ""}
                key={key}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <label htmlFor="chromasense-checkout">
            <span>Checkout analisado</span>
            <select
              id="chromasense-checkout"
              value={checkoutId}
              onChange={(event) => setCheckoutId(event.target.value)}
              disabled={!state.checkouts.length}
            >
              {!state.checkouts.length && (
                <option value="">Nenhum checkout publicado</option>
              )}
              {state.checkouts.map((checkout) => (
                <option key={checkout.publicId} value={checkout.publicId}>
                  {checkout.name} · {checkout.sessions}
                </option>
              ))}
            </select>
          </label>
        </div>
        {state.loading ? (
          <div className="chroma-loading">
            <RefreshCw className="spin" />
            <b>Processando comportamento...</b>
            <span>Consolidando eventos do checkout.</span>
          </div>
        ) : tab === "heatmap" ? (
          <div className="chroma-heatmap-view">
            <div className="chroma-viewbar">
              <div>
                {views.map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={view === key}
                    className={view === key ? "active" : ""}
                    onClick={() => setView(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span>
                <Activity size={15} />{" "}
                {view === "scroll"
                  ? `${state.scroll.average}% de profundidade média`
                  : `${points.length.toLocaleString("pt-BR")} pontos visíveis`}
              </span>
            </div>
            <div className="chroma-map-grid">
              <aside>
                <h3>
                  {view === "click" ? "Mais clicados" : "Leitura do mapa"}
                </h3>
                <p>
                  {view === "click"
                    ? "Elementos com maior volume no período."
                    : "Coordenadas agregadas e anonimizadas."}
                </p>
                {view === "click" && state.topTargets.length ? (
                  state.topTargets.slice(0, 8).map((target, index) => (
                    <div className="chroma-target" key={target.target}>
                      <b>{index + 1}</b>
                      <span>
                        <strong>{target.label}</strong>
                        <small>
                          {target.clicks} cliques
                          {target.rage ? ` · ${target.rage} repetidos` : ""}
                        </small>
                      </span>
                    </div>
                  ))
                ) : view === "scroll" ? (
                  <div className="scroll-legend">
                    {[25, 50, 75, 100].map((limit, index) => (
                      <span key={limit}>
                        <i style={{ width: `${limit}%` }} />
                        {limit}%{" "}
                        <b>{state.scroll.distribution[index]} sessões</b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="heat-legend">
                    <span>Baixa</span>
                    <i />
                    <span>Alta</span>
                  </div>
                )}
              </aside>
              <CheckoutSurface
                points={points}
                type={view}
                scroll={state.scroll}
                checkout={selectedCheckout}
              />
            </div>
          </div>
        ) : tab === "sessions" ? (
          <div className="chroma-session-panel">
            <header>
              <div>
                <h2>Sessões observadas</h2>
                <p>Resumo técnico sem conteúdo digitado ou dados pessoais.</p>
              </div>
              <b>{state.sessions.length} resultados</b>
            </header>
            {state.sessions.length ? (
              <div className="chroma-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Checkout</th>
                      <th>Dispositivo</th>
                      <th>Eventos</th>
                      <th>Atenção</th>
                      <th>Rolagem</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.sessions.map((session) => (
                      <tr key={session.publicId}>
                        <td>
                          <strong>{session.checkout.name}</strong>
                          <small>
                            {new Date(session.startedAt).toLocaleString(
                              "pt-BR",
                              { dateStyle: "short", timeStyle: "short" },
                            )}
                          </small>
                        </td>
                        <td>
                          <span className="device-pill">{session.device}</span>
                        </td>
                        <td>{session.events}</td>
                        <td>{duration(session.durationMs)}</td>
                        <td>{session.maxScroll}%</td>
                        <td>
                          <span
                            className={
                              session.completed
                                ? "result-pill success"
                                : "result-pill"
                            }
                          >
                            {session.completed ? "Concluída" : "Não concluída"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="chroma-empty">
                <ScanSearch />
                <b>Nenhuma sessão encontrada</b>
                <span>
                  Os novos acessos ao checkout aparecerão aqui automaticamente.
                </span>
              </div>
            )}
          </div>
        ) : tab === "insights" ? (
          <div className="chroma-insights">
            <header>
              <div>
                <h2>Insights automáticos</h2>
                <p>Sinais priorizados para indicar onde agir primeiro.</p>
              </div>
              <span>Base: {state.summary.sessions} sessões</span>
            </header>
            {state.insights.length ? (
              <div className="insight-grid">
                {state.insights.map((item) => {
                  const Icon =
                    item.key === "rage"
                      ? MousePointerClick
                      : item.key === "dead"
                        ? AlertTriangle
                        : item.key === "scroll"
                          ? TrendingDown
                          : Activity;
                  return (
                    <article
                      className={`severity-${item.severity}`}
                      key={item.key}
                    >
                      <span>
                        <Icon size={19} />
                      </span>
                      <div>
                        <small>
                          {item.severity === "high"
                            ? "PRIORITÁRIO"
                            : item.severity === "medium"
                              ? "ATENÇÃO"
                              : "OPORTUNIDADE"}
                        </small>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="chroma-empty">
                <CheckCircle2 />
                <b>Nenhum sinal crítico neste período</b>
                <span>
                  Continue acompanhando conforme novas sessões forem
                  registradas.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="chroma-help">
            <ScanSearch />
            <div>
              <h2>Como o ChromaSense funciona</h2>
              <p>
                Cliques, movimentos, rolagem e tempo de atenção são agrupados
                por checkout e dispositivo. O rastreamento não registra teclas,
                valores de campos, CPF, e-mail ou conteúdo sensível.
              </p>
              <ul>
                <li>
                  <b>Cliques:</b> mostra os pontos e controles mais acionados.
                </li>
                <li>
                  <b>Movimentos:</b> indica por onde o ponteiro percorreu.
                </li>
                <li>
                  <b>Rolagem:</b> revela até onde o conteúdo foi visualizado.
                </li>
                <li>
                  <b>Atenção:</b> estima as regiões em que o visitante
                  permaneceu ativo.
                </li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
