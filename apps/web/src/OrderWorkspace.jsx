import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Globe2,
  History,
  Link2,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Package,
  PencilLine,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  getOrder,
  saveOrderTracking,
  setOrderVisitorBlocked,
  updateOrderStatus,
} from "./api";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const orderCode = (value = "") => `#SLD-${value.slice(-8).toUpperCase()}`;
const initials = (name = "Cliente") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
const statusLabels = {
  PENDING: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
};
const fulfillmentLabels = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PREPARING: "Produtos em separação",
  IN_TRANSIT: "Produtos em transporte",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
const fulfillmentSteps = [
  "AWAITING_PAYMENT",
  "PAYMENT_APPROVED",
  "PREPARING",
  "IN_TRANSIT",
  "DELIVERED",
];
const tabs = [
  ["summary", "Resumo"],
  ["transactions", "Transações"],
  ["tracking", "Rastreamento"],
  ["status", "Status"],
  ["customer", "Histórico do cliente"],
  ["utm", "Parâmetros UTM"],
  ["additional", "Inf. adicionais"],
];

function useOrderWorkspace(orderId) {
  const [state, setState] = useState({ loading: true, error: "", order: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (quiet = false) => {
      if (!quiet)
        setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const order = await getOrder(orderId, controller.signal);
        if (active) setState({ loading: false, error: "", order });
      } catch (error) {
        if (active && error?.name !== "AbortError")
          setState((current) => ({
            ...current,
            loading: false,
            error: error?.message || "Não foi possível carregar o pedido.",
          }));
      }
    };
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [orderId, revision]);
  return { ...state, refresh: () => setRevision((value) => value + 1) };
}

function CopyButton({ value, label = "Copiar", compact = false }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(String(value));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      className={`ow-copy${compact ? " is-compact" : ""}`}
      onClick={copy}
      aria-label={copied ? "Copiado" : label}
      title={copied ? "Copiado" : label}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {!compact ? <span>{copied ? "Copiado" : label}</span> : null}
    </button>
  );
}

function StatusPill({ value }) {
  return (
    <span className={`ow-pill ${String(value || "").toLowerCase()}`}>
      {statusLabels[value] ||
        fulfillmentLabels[value] ||
        value ||
        "Não informado"}
    </span>
  );
}

function Empty({ icon: Icon = FileText, title, text }) {
  return (
    <div className="ow-empty">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function Address({ address }) {
  if (!address?.street) return <span>Endereço não informado.</span>;
  return (
    <address>
      {address.street}
      {address.number ? `, ${address.number}` : ""}
      {address.complement ? ` — ${address.complement}` : ""}
      <br />
      {address.neighborhood ? `${address.neighborhood} · ` : ""}
      {address.city || ""}
      {address.state ? ` - ${address.state}` : ""}
      <br />
      {address.postalCode ? `CEP ${address.postalCode}` : ""}
    </address>
  );
}

function SummaryTab({ order }) {
  const currentIndex = fulfillmentSteps.indexOf(order.fulfillment?.status);
  return (
    <div className="ow-stack">
      <section className="ow-summary-grid card">
        <article>
          <span className="ow-section-label">Cliente</span>
          <strong>{order.customer?.name || "Cliente não identificado"}</strong>
          <small>{order.customer?.email || "E-mail não informado"}</small>
          <small>{order.customer?.phone || "Telefone não informado"}</small>
          {order.customer?.documentMasked && (
            <small>CPF/CNPJ: {order.customer.documentMasked}</small>
          )}
        </article>
        <article>
          <span className="ow-section-label">Pagamento</span>
          <strong>{order.paymentProvider || "Pix"}</strong>
          <small>Pagamento à vista</small>
          <small>Moeda: {order.currency || "BRL"}</small>
        </article>
        <article>
          <span className="ow-section-label">Entrega</span>
          <strong>
            {order.shippingAddress?.recipient ||
              order.customer?.name ||
              "Destinatário"}
          </strong>
          <Address address={order.shippingAddress} />
          <small>{order.shippingMethodName || "Método não informado"}</small>
        </article>
        <article className="ow-total">
          <span className="ow-section-label">Valor total</span>
          <strong>{money.format((order.totalCents || 0) / 100)}</strong>
          <dl>
            <div>
              <dt>Produtos</dt>
              <dd>{money.format((order.subtotalCents || 0) / 100)}</dd>
            </div>
            <div>
              <dt>Frete</dt>
              <dd>
                {order.shippingPriceCents
                  ? money.format(order.shippingPriceCents / 100)
                  : "Grátis"}
              </dd>
            </div>
            {order.discountCents > 0 && (
              <div className="discount">
                <dt>Desconto</dt>
                <dd>- {money.format(order.discountCents / 100)}</dd>
              </div>
            )}
          </dl>
        </article>
      </section>
      <section className="card ow-fulfillment" aria-label="Progresso do pedido">
        {fulfillmentSteps.map((step, index) => (
          <div className={index <= currentIndex ? "done" : ""} key={step}>
            <span>
              {index < currentIndex ? (
                <Check size={15} />
              ) : (
                <Circle size={15} />
              )}
            </span>
            <small>{fulfillmentLabels[step]}</small>
          </div>
        ))}
      </section>
      <section className="card ow-card-section">
        <header>
          <div>
            <h2>Produtos</h2>
            <span>{order.items?.length || 0} itens no pedido</span>
          </div>
        </header>
        <div className="ow-products">
          {order.items?.map((item, index) => (
            <article key={`${item.titleSnapshot}-${index}`}>
              <span className="ow-product-image">
                {item.imageUrlSnapshot ? (
                  <img src={item.imageUrlSnapshot} alt="" />
                ) : (
                  <Package />
                )}
              </span>
              <div>
                <strong>{item.titleSnapshot}</strong>
                {item.variantSnapshot && <small>{item.variantSnapshot}</small>}
                <small>Quantidade: {item.quantity}</small>
                {item.isOrderBump && (
                  <span className="ow-mini-pill">Order bump</span>
                )}
              </div>
              <b>
                {item.totalCents === 0
                  ? "Grátis"
                  : money.format(item.totalCents / 100)}
              </b>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function TransactionsTab({ order }) {
  const [showPix, setShowPix] = useState(false);
  return (
    <div className="ow-stack">
      <section className="card ow-card-section">
        <header>
          <div>
            <h2>Identificação</h2>
            <span>Referências técnicas do pedido</span>
          </div>
        </header>
        <div className="ow-facts ow-facts-transaction">
          <div>
            <span>ID do pedido</span>
            <strong>{order.publicId}</strong>
            <CopyButton value={order.publicId} />
          </div>
          <div>
            <span>Criado em</span>
            <strong>{dateTime(order.createdAt)}</strong>
          </div>
          <div>
            <span>Atualizado em</span>
            <strong>{dateTime(order.updatedAt)}</strong>
          </div>
          <div>
            <span>Checkout</span>
            <strong>{order.checkout?.name || "Link direto"}</strong>
            {order.checkout?.slug && (
              <a
                href={`/pay/${order.checkout.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir checkout <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div>
            <span>Loja</span>
            <strong>{order.store?.name || "—"}</strong>
          </div>
          <div>
            <span>Origem</span>
            <strong>{order.source || "CHECKOUT"}</strong>
          </div>
        </div>
      </section>
      <div className="ow-two-columns">
        <section className="card ow-card-section">
          <header>
            <div>
              <h2>Tentativas de processamento</h2>
              <span>Resumo por adquirente, ID e status</span>
            </div>
            <span>{order.paymentAttempts?.length || 0} tentativas</span>
          </header>
          {order.paymentAttempts?.length ? (
            <div className="ow-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Provedor</th>
                    <th>ID</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Atualização</th>
                  </tr>
                </thead>
                <tbody>
                  {order.paymentAttempts.map((attempt) => (
                    <tr key={attempt.publicId}>
                      <td>
                        <b>{attempt.provider}</b>
                      </td>
                      <td>
                        <span className="ow-mono">
                          {attempt.providerTransactionId || attempt.publicId}
                        </span>
                      </td>
                      <td>{money.format((attempt.amountCents || 0) / 100)}</td>
                      <td>
                        <StatusPill value={attempt.status} />
                      </td>
                      <td>{dateTime(attempt.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={ReceiptText}
              title="Nenhuma tentativa registrada"
              text="A tentativa aparecerá quando o cliente gerar o pagamento."
            />
          )}
        </section>
        <aside className="card ow-payment-aside">
          <div className="ow-payment-heading">
            <CreditCard />
            <span>Pagamento</span>
          </div>
          <h3>{order.paymentProvider || "Pix"}</h3>
          <StatusPill value={order.status} />
          {order.pixCode && (
            <>
              <button
                className="secondary"
                type="button"
                onClick={() => setShowPix((value) => !value)}
              >
                <QrCode size={17} />{" "}
                {showPix ? "Ocultar QR Code" : "Ver QR Code Pix"}
              </button>
              {showPix && (
                <div className="ow-qr">
                  <QRCodeSVG
                    value={order.pixCode}
                    size={164}
                    includeMargin
                    level="M"
                  />
                  <CopyButton value={order.pixCode} label="Copiar Pix" />
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function TrackingTab({ order, csrfToken, refresh, setNotice }) {
  const [form, setForm] = useState({
    carrier: "",
    code: "",
    url: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      setForm({
        carrier: order.fulfillment?.carrier || "",
        code: order.fulfillment?.code || "",
        url: order.fulfillment?.url || "",
        note: order.fulfillment?.note || "",
      }),
    [order],
  );
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveOrderTracking(order.publicId, form, csrfToken);
      setNotice("Rastreio salvo com sucesso.");
      refresh();
    } catch (error) {
      setNotice(error?.message || "Não foi possível salvar o rastreio.", true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ow-stack">
      <section className="card ow-card-section">
        <header>
          <div>
            <h2>Endereço de entrega</h2>
            <span>Destino informado no checkout</span>
          </div>
        </header>
        <div className="ow-address-row">
          <MapPin />
          <div>
            <Address address={order.shippingAddress} />
            <span>
              {order.shippingMethodName || "Método de entrega não informado"}
            </span>
          </div>
        </div>
      </section>
      <section className="card ow-card-section">
        <header>
          <div>
            <h2>Rastreio da entrega</h2>
            <span>Cadastre a transportadora e o código enviado ao cliente</span>
          </div>
        </header>
        <form className="ow-form" onSubmit={save}>
          <label>
            <span>Transportadora</span>
            <input
              aria-label="Transportadora"
              value={form.carrier}
              onChange={(event) =>
                setForm({ ...form, carrier: event.target.value })
              }
              placeholder="Ex.: Correios"
            />
          </label>
          <label>
            <span>Código de rastreio</span>
            <input
              aria-label="Código de rastreio"
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
              placeholder="Código da remessa"
            />
          </label>
          <label className="wide">
            <span>Link de acompanhamento</span>
            <input
              aria-label="Link de acompanhamento"
              type="url"
              value={form.url}
              onChange={(event) =>
                setForm({ ...form, url: event.target.value })
              }
              placeholder="https://..."
            />
          </label>
          <label className="wide">
            <span>Observação</span>
            <textarea
              aria-label="Observação do rastreio"
              value={form.note}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
              placeholder="Informação opcional para a operação"
            />
          </label>
          <button className="primary" disabled={busy || !order.canManage}>
            {busy ? <LoaderCircle className="spin" /> : <Truck />} Salvar
            rastreio
          </button>
        </form>
      </section>
    </div>
  );
}

function StatusTab({ order, csrfToken, refresh, setNotice }) {
  const [status, setStatus] = useState(
    order.fulfillment?.status || "AWAITING_PAYMENT",
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => setStatus(order.fulfillment?.status || "AWAITING_PAYMENT"),
    [order],
  );
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await updateOrderStatus(order.publicId, { status, note }, csrfToken);
      setNotice("Status atualizado com sucesso.");
      setNote("");
      refresh();
    } catch (error) {
      setNotice(error?.message || "Não foi possível atualizar o status.", true);
    } finally {
      setBusy(false);
    }
  };
  const events = order.fulfillment?.events || [];
  return (
    <section className="card ow-card-section">
      <header>
        <div>
          <h2>Linha do tempo do pedido</h2>
          <span>Alterações manuais e automáticas ficam registradas aqui</span>
        </div>
      </header>
      {events.length ? (
        <div className="ow-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Atualizado em</th>
                <th>Status</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              {[...events].reverse().map((event, index) => (
                <tr key={`${event.at}-${index}`}>
                  <td>{dateTime(event.at)}</td>
                  <td>
                    <StatusPill value={event.status} />
                  </td>
                  <td>{event.note || "Atualização do pedido"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={History}
          title="Sem alterações manuais"
          text="O histórico começará na primeira atualização."
        />
      )}
      <form className="ow-inline-form" onSubmit={save}>
        <label>
          <span>Novo status</span>
          <select
            aria-label="Novo status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {fulfillmentSteps.map((value) => (
              <option key={value} value={value}>
                {fulfillmentLabels[value]}
              </option>
            ))}
            <option value="CANCELLED">Cancelado</option>
          </select>
        </label>
        <label>
          <span>Observação</span>
          <input
            aria-label="Observação do status"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Motivo ou informação da atualização"
          />
        </label>
        <button className="secondary" disabled={busy || !order.canManage}>
          {busy ? <LoaderCircle className="spin" /> : <RefreshCw />} Atualizar
          status
        </button>
      </form>
    </section>
  );
}

function CustomerTab({ order, csrfToken, refresh, setNotice }) {
  const [busy, setBusy] = useState(false);
  const phone = String(order.customer?.phone || "").replace(/\D/g, "");
  const whatsapp = phone
    ? `https://wa.me/${phone.length <= 11 ? `55${phone}` : phone}`
    : "";
  const toggleBlock = async () => {
    setBusy(true);
    try {
      await setOrderVisitorBlocked(
        order.publicId,
        !order.visitor?.blocked,
        csrfToken,
      );
      setNotice(
        order.visitor?.blocked
          ? "Sinalização removida."
          : "Visitante sinalizado para revisão.",
      );
      refresh();
    } catch (error) {
      setNotice(
        error?.message || "Não foi possível alterar a sinalização.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ow-stack">
      <section className="card ow-card-section">
        <header>
          <div>
            <h2>Cliente</h2>
            <span>Contato e compras relacionadas</span>
          </div>
          {whatsapp && (
            <a
              className="ow-whatsapp"
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          )}
        </header>
        <div className="ow-customer">
          <span className="ow-avatar">{initials(order.customer?.name)}</span>
          <div>
            <strong>
              {order.customer?.name || "Cliente não identificado"}
            </strong>
            <a
              href={
                order.customer?.email
                  ? `mailto:${order.customer.email}`
                  : undefined
              }
            >
              {order.customer?.email || "E-mail não informado"}
            </a>
            <span>{order.customer?.phone || "Telefone não informado"}</span>
            <span>
              {order.customer?.documentMasked
                ? `Documento: ${order.customer.documentMasked}`
                : "Documento não informado"}
            </span>
          </div>
        </div>
        {order.customerHistory?.length ? (
          <div className="ow-history-list">
            {order.customerHistory.map((item) => (
              <article key={item.publicId}>
                <div>
                  <strong>{orderCode(item.publicId)}</strong>
                  <small>{dateTime(item.createdAt)}</small>
                </div>
                <StatusPill value={item.status} />
                <b>{money.format(item.totalCents / 100)}</b>
              </article>
            ))}
          </div>
        ) : (
          <p className="ow-muted">
            Este é o primeiro pedido identificado deste cliente.
          </p>
        )}
      </section>
      <section className="card ow-card-section">
        <header>
          <div>
            <h2>Informações do dispositivo</h2>
            <span>Dados reduzidos para segurança e privacidade</span>
          </div>
        </header>
        <div className="ow-facts">
          <div>
            <span>IP</span>
            <strong>{order.visitor?.ip || "Não disponível"}</strong>
          </div>
          <div>
            <span>Navegador</span>
            <strong>{order.visitor?.browser || "Não identificado"}</strong>
          </div>
          <div>
            <span>Localização</span>
            <strong>
              {[
                order.visitor?.city,
                order.visitor?.state,
                order.visitor?.country,
              ]
                .filter(Boolean)
                .join(", ") || "Não localizada"}
            </strong>
          </div>
          <div>
            <span>Situação</span>
            <strong>{order.visitor?.blocked ? "Sinalizado" : "Normal"}</strong>
          </div>
        </div>
        <div className="ow-danger-row">
          <span>
            {order.visitor?.blocked
              ? "Remover a sinalização deste visitante."
              : "Sinalizar este visitante para revisão da operação."}
          </span>
          <button
            className={order.visitor?.blocked ? "secondary" : "danger"}
            type="button"
            disabled={busy || !order.canManage || !order.visitor?.ip}
            onClick={toggleBlock}
          >
            <Ban size={16} />{" "}
            {order.visitor?.blocked
              ? "Remover sinalização"
              : "Sinalizar visitante"}
          </button>
        </div>
      </section>
    </div>
  );
}

function UtmTab({ order }) {
  const entries = Object.entries(order.utm || {}).filter(([, value]) => value);
  return (
    <section className="card ow-card-section">
      <header>
        <div>
          <h2>Página de origem e campanha</h2>
          <span>Atribuição capturada no início da sessão</span>
        </div>
      </header>
      {entries.length ? (
        <div className="ow-utm-list">
          {entries.map(([key, value]) => (
            <article key={key}>
              <span>
                {key === "url"
                  ? "URL"
                  : key === "referrer"
                    ? "Referenciador"
                    : key.replace(/^utm/, "UTM ").toUpperCase()}
              </span>
              <strong>{value}</strong>
              <CopyButton value={value} />
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Globe2}
          title="Nenhum parâmetro de campanha"
          text="Este pedido não recebeu UTMs ou referência de origem."
        />
      )}
    </section>
  );
}

function AdditionalTab({ order }) {
  const jobs = order.integrationJobs || [];
  return (
    <section className="card ow-card-section">
      <header>
        <div>
          <h2>Histórico de integrações</h2>
          <span>O que cada serviço conectado tentou fazer com este pedido</span>
        </div>
      </header>
      {jobs.length ? (
        <div className="ow-jobs">
          {jobs.map((job) => {
            const failed =
              job.status === "FAILED" || job.status === "DEAD" || job.lastError;
            return (
              <article
                className={failed ? "failed" : "success"}
                key={job.publicId}
              >
                <header>
                  <div>
                    <strong>{job.provider || job.event || "Integração"}</strong>
                    <StatusPill value={failed ? "FAILED" : job.status} />
                  </div>
                  <small>{dateTime(job.updatedAt || job.createdAt)}</small>
                </header>
                <div>
                  <b>
                    {failed ? "O que aconteceu" : "Processamento concluído"}
                  </b>
                  <p>
                    {failed
                      ? job.lastError ||
                        "A integração não conseguiu processar este pedido."
                      : `${job.event || "Evento"} processado com sucesso.`}
                  </p>
                  {failed && (
                    <aside>
                      <ShieldCheck size={17} />
                      <span>
                        Revise as credenciais e o status desta integração antes
                        de tentar novamente.
                      </span>
                    </aside>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={Link2}
          title="Sem tentativas de integração"
          text="Nenhum serviço externo processou este pedido até agora."
        />
      )}
    </section>
  );
}

export default function OrderWorkspace({ orderId, onBack, csrfToken }) {
  const { loading, error, order, refresh } = useOrderWorkspace(orderId);
  const [activeTab, setActiveTab] = useState("summary");
  const [notice, setNoticeState] = useState(null);
  const setNotice = (message, errorNotice = false) => {
    setNoticeState({ message, error: errorNotice });
    window.setTimeout(() => setNoticeState(null), 4500);
  };
  const whatsApp = useMemo(() => {
    const digits = String(order?.customer?.phone || "").replace(/\D/g, "");
    return digits
      ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
      : "";
  }, [order]);
  const content = order
    ? {
        summary: <SummaryTab order={order} />,
        transactions: <TransactionsTab order={order} />,
        tracking: (
          <TrackingTab
            order={order}
            csrfToken={csrfToken}
            refresh={refresh}
            setNotice={setNotice}
          />
        ),
        status: (
          <StatusTab
            order={order}
            csrfToken={csrfToken}
            refresh={refresh}
            setNotice={setNotice}
          />
        ),
        customer: (
          <CustomerTab
            order={order}
            csrfToken={csrfToken}
            refresh={refresh}
            setNotice={setNotice}
          />
        ),
        utm: <UtmTab order={order} />,
        additional: <AdditionalTab order={order} />,
      }[activeTab]
    : null;
  return (
    <main className="page orders-page ow-page">
      <button className="back-link" type="button" onClick={onBack}>
        <ArrowLeft size={17} /> Voltar para pedidos
      </button>
      {loading && !order && (
        <section className="card orders-state">
          <LoaderCircle className="spin" /> Carregando pedido e cliente...
        </section>
      )}
      {error && !order && (
        <section className="card orders-state error">
          <Package />
          <b>Não foi possível abrir este pedido</b>
          <span>{error}</span>
          <button className="secondary" onClick={refresh}>
            Tentar novamente
          </button>
        </section>
      )}
      {order && (
        <>
          <header className="ow-header">
            <div>
              <div className="ow-title-line">
                <h1>Pedido {orderCode(order.publicId)}</h1>
                <CopyButton value={order.publicId} compact />
                <StatusPill value={order.status} />
                <span className="ow-mini-pill">
                  {order.source === "SHOPIFY" ? "Shopify" : "Link direto"}
                </span>
              </div>
              <p>
                {order.items?.length || 0} itens ·{" "}
                {order.paymentProvider || "Pix"} · {dateTime(order.createdAt)}
              </p>
            </div>
            <div className="ow-actions">
              {whatsApp && (
                <a
                  className="secondary"
                  href={whatsApp}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={17} /> WhatsApp
                </a>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setActiveTab("tracking")}
              >
                <PencilLine size={17} /> Adicionar rastreio
              </button>
            </div>
          </header>
          <nav className="ow-tabs" aria-label="Detalhes do pedido">
            {tabs.map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={activeTab === key ? "active" : ""}
                aria-current={activeTab === key ? "page" : undefined}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {notice && (
            <div
              className={`ow-notice ${notice.error ? "error" : "success"}`}
              role="status"
            >
              {notice.error ? <Circle /> : <CheckCircle2 />}
              {notice.message}
            </div>
          )}
          {content}
        </>
      )}
    </main>
  );
}
