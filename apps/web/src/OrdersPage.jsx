import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { getOrder, getOrders } from "./api";
import OrderWorkspace from "./OrderWorkspace";
import "./orders-page.css";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const statusLabels = {
  PAID: "Pago",
  PENDING: "Aguardando Pix",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
};
const statusTones = {
  PAID: "paid",
  PENDING: "pending",
  FAILED: "failed",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  REFUNDED: "refunded",
};
const orderCode = (publicId) => `#SLD-${publicId.slice(-6).toUpperCase()}`;
const initials = (name) =>
  (name || "Cliente")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const countryFlag = (country) =>
  country === "BR"
    ? "🇧🇷"
    : country === "US"
      ? "🇺🇸"
      : country === "PT"
        ? "🇵🇹"
        : country || "—";
const whatsappNumber = (phone) => {
  let digits = String(phone || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^\d{12,15}$/.test(digits) ? digits : null;
};
const whatsappUrl = (order) => {
  const number = whatsappNumber(order.customer?.phone);
  if (!number) return null;
  const firstName = order.customer?.name?.trim().split(/\s+/)[0];
  const product = order.items?.[0]?.titleSnapshot || "seu produto";
  const extra =
    order.items?.length > 1 ? " e os outros itens da sua compra" : "";
  const greeting = firstName
    ? `Olá, ${firstName}! Tudo bem?`
    : "Olá! Tudo bem?";
  const message = `${greeting} Estou entrando em contato sobre sua compra de ${product}${extra} em nossa loja.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};

function relativeDate(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relative.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return Math.abs(hours) < 24
    ? relative.format(hours, "hour")
    : relative.format(Math.round(hours / 24), "day");
}
function PaymentStatus({ status }) {
  return (
    <span className={`payment-status ${statusTones[status] || "neutral"}`}>
      <i />
      {statusLabels[status] || status}
    </span>
  );
}

export function OrdersTable({
  items,
  loading,
  error,
  onRetry,
  onOpen,
  showGateway = true,
}) {
  if (loading)
    return (
      <div className="orders-state" role="status">
        <RefreshCw className="orders-spinner" />
        <span>Carregando pedidos...</span>
      </div>
    );
  if (error)
    return (
      <div className="orders-state error" role="alert">
        <ShoppingBag />
        <b>Não foi possível carregar os pedidos</b>
        <span>{error}</span>
        <button className="secondary" onClick={onRetry}>
          <RefreshCw size={16} /> Tentar novamente
        </button>
      </div>
    );
  if (!items.length)
    return (
      <div className="orders-state">
        <ShoppingBag />
        <b>Nenhum pedido ainda</b>
        <span>
          Quando um cliente gerar um Pix, o pedido aparecerá aqui
          automaticamente.
        </span>
      </div>
    );
  return (
    <div className="orders-table-wrap">
      <table className="orders-table orders-table-dense">
        <thead>
          <tr>
            <th>Pedido / cliente</th>
            <th>País</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Status</th>
            <th>Pagamento</th>
            {showGateway && <th>Gateway</th>}
            {onOpen && (
              <th>
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((order) => {
            const itemCount = order.items.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0,
            );
            return (
              <tr key={order.publicId}>
                <td>
                  <button
                    className="order-identity"
                    onClick={() => onOpen?.(order.publicId)}
                  >
                    <strong>{orderCode(order.publicId)}</strong>
                    <span>
                      {order.customer?.name || "Cliente não identificado"}
                    </span>
                    <small>
                      {order.customer?.email || "E-mail indisponível"}
                    </small>
                  </button>
                </td>
                <td>
                  <span className="country-flag" title={order.country || "BR"}>
                    {countryFlag(order.country)}
                  </span>
                </td>
                <td>
                  <time dateTime={order.createdAt}>
                    <b>
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </b>
                    <small>
                      {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </time>
                </td>
                <td className="orders-center">{itemCount}</td>
                <td>
                  <strong>{currency.format(order.totalCents / 100)}</strong>
                </td>
                <td>
                  <PaymentStatus status={order.status} />
                </td>
                <td>
                  <span className="payment-method">
                    <QrCode size={16} /> Pix
                  </span>
                </td>
                {showGateway && (
                  <td>
                    <b className="gateway-name">
                      {order.paymentProvider || "Gateway"}
                    </b>
                  </td>
                )}
                {onOpen && (
                  <td>
                    <button
                      className="order-open"
                      onClick={() => onOpen(order.publicId)}
                      aria-label={`Abrir detalhes do pedido ${orderCode(order.publicId)}`}
                    >
                      Detalhes <ExternalLink size={14} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function useOrders(storeKey, page, pageSize, filters = {}) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
    total: 0,
    pages: 1,
  });
  const [refresh, setRefresh] = useState(0);
  const { search, status, from, to, sort } = filters;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (initial) => {
      if (initial)
        setState((current) => ({
          ...current,
          loading: true,
          error: "",
          ...(refresh === 0 ? { items: [] } : {}),
        }));
      try {
        const result = await getOrders(
          { page, pageSize, search, status, from, to, sort },
          controller.signal,
        );
        if (active)
          setState({
            loading: false,
            error: "",
            items: result.items,
            total: result.total,
            pages: result.pages,
          });
      } catch (error) {
        if (active && error.name !== "AbortError" && initial)
          setState({
            loading: false,
            error: error.message,
            items: [],
            total: 0,
            pages: 1,
          });
      }
    };
    void load(true);
    const interval = window.setInterval(() => void load(false), 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      controller.abort();
    };
  }, [page, pageSize, storeKey, refresh, search, status, from, to, sort]);
  return [state, () => setRefresh((value) => value + 1)];
}

function useOrderDetail(orderId) {
  const [state, setState] = useState({ loading: true, error: "", order: null });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (initial) => {
      if (initial) setState({ loading: true, error: "", order: null });
      try {
        const order = await getOrder(orderId, controller.signal);
        if (active) setState({ loading: false, error: "", order });
      } catch (error) {
        if (active && error.name !== "AbortError" && initial)
          setState({ loading: false, error: error.message, order: null });
      }
    };
    void load(true);
    const interval = window.setInterval(() => void load(false), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      controller.abort();
    };
  }, [orderId]);
  return state;
}

export function RecentOrders({ storeKey, onViewAll }) {
  const [state, load] = useOrders(storeKey, 1, 5);
  return (
    <section className="card orders-card">
      <div className="card-head">
        <div>
          <h2>Pedidos recentes</h2>
          <p>Últimas movimentações reais do checkout</p>
        </div>
        <button className="ghost" onClick={onViewAll}>
          Ver todos
        </button>
      </div>
      <OrdersTable {...state} onRetry={load} />
    </section>
  );
}

function Address({ address }) {
  if (!address?.street) return <span>Endereço não informado</span>;
  return (
    <span>
      {address.street}, {address.number}
      {address.complement ? ` — ${address.complement}` : ""}
      <br />
      {address.neighborhood && `${address.neighborhood} — `}
      {address.city}/{address.state}
      <br />
      {address.postalCode && `CEP ${address.postalCode}`}
    </span>
  );
}

function LegacyOrderDetail({ orderId, onBack }) {
  const { loading, error, order } = useOrderDetail(orderId);
  const [copied, setCopied] = useState(false);
  const copyPix = async () => {
    if (!order?.pixCode) return;
    await navigator.clipboard.writeText(order.pixCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <main className="page orders-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={17} /> Voltar para pedidos
      </button>
      {loading && (
        <section className="card orders-state" role="status">
          <RefreshCw className="orders-spinner" />
          <span>Carregando detalhes do pedido...</span>
        </section>
      )}
      {error && (
        <section className="card orders-state error" role="alert">
          <ShoppingBag />
          <b>Não foi possível abrir este pedido</b>
          <span>{error}</span>
          <button className="secondary" onClick={onBack}>
            Voltar para pedidos
          </button>
        </section>
      )}
      {order && (
        <>
          <section className="page-title order-detail-title">
            <div>
              <p className="eyebrow">PEDIDO</p>
              <h1>{orderCode(order.publicId)}</h1>
              <p>
                Criado em {new Date(order.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <PaymentStatus status={order.status} />
          </section>
          <section className="order-detail-grid">
            <div className="order-detail-main">
              <section className="card detail-card">
                <div className="detail-card-head">
                  <div>
                    <Package size={19} />
                    <h2>Itens do pedido</h2>
                  </div>
                  <strong>{currency.format(order.subtotalCents / 100)}</strong>
                </div>
                {order.items.map((item, index) => (
                  <article
                    className="detail-item"
                    key={`${item.titleSnapshot}-${index}`}
                  >
                    <span className="detail-product-image">
                      {item.imageUrlSnapshot ? (
                        <img src={item.imageUrlSnapshot} alt="" />
                      ) : (
                        <Package size={19} />
                      )}
                    </span>
                    <div>
                      <b>{item.titleSnapshot}</b>
                      {item.variantSnapshot && (
                        <small>{item.variantSnapshot}</small>
                      )}
                      <small>
                        {item.quantity}{" "}
                        {item.quantity === 1 ? "unidade" : "unidades"}
                      </small>
                    </div>
                  </article>
                ))}
              </section>
              <section className="card detail-card">
                <div className="detail-card-head">
                  <div>
                    <UserRound size={19} />
                    <h2>Cliente</h2>
                  </div>
                </div>
                <div className="detail-info">
                  <b>{order.customer?.name || "Cliente não identificado"}</b>
                  <span>{order.customer?.email || "E-mail não informado"}</span>
                  {order.customer?.phone && <span>{order.customer.phone}</span>}
                  {whatsappUrl(order) && (
                    <a
                      className="whatsapp-link"
                      href={whatsappUrl(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={16} /> Chamar no WhatsApp
                    </a>
                  )}
                </div>
              </section>
              <section className="card detail-card">
                <div className="detail-card-head">
                  <div>
                    <MapPin size={19} />
                    <h2>Entrega</h2>
                  </div>
                </div>
                <div className="detail-info">
                  <b>{order.shippingMethodName || "Frete não informado"}</b>
                  <Address address={order.shippingAddress} />
                </div>
              </section>
            </div>
            <aside className="card payment-detail">
              <div className="payment-detail-icon">
                <CreditCard size={22} />
              </div>
              <p className="eyebrow">PAGAMENTO</p>
              <h2>{order.paymentProvider || "Pix"}</h2>
              <PaymentStatus status={order.status} />
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{currency.format(order.subtotalCents / 100)}</dd>
                </div>
                {order.discountCents > 0 && (
                  <div className="payment-discount">
                    <dt>
                      Desconto{order.couponCode ? ` (${order.couponCode})` : ""}
                    </dt>
                    <dd>-{currency.format(order.discountCents / 100)}</dd>
                  </div>
                )}
                <div>
                  <dt>Frete</dt>
                  <dd>
                    {order.shippingPriceCents === 0
                      ? "Grátis"
                      : currency.format(order.shippingPriceCents / 100)}
                  </dd>
                </div>
                <div className="payment-total">
                  <dt>Total</dt>
                  <dd>{currency.format(order.totalCents / 100)}</dd>
                </div>
              </dl>
              {order.pixCode && order.status === "PENDING" && (
                <div className="payment-code-card">
                  <div>
                    <span>PIX copia e cola</span>
                    <small>
                      Atualizado automaticamente enquanto estiver pendente.
                    </small>
                  </div>
                  <button
                    type="button"
                    className="copy-payment-code"
                    onClick={copyPix}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Copiado" : "Copiar código PIX"}
                  </button>
                </div>
              )}
              {order.paidAt && (
                <p className="payment-confirmed">
                  Confirmado em {new Date(order.paidAt).toLocaleString("pt-BR")}
                </p>
              )}
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

export default function OrdersPage({ storeKey, csrfToken }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    from: "",
    to: "",
    sort: "newest",
  });
  const [exporting, setExporting] = useState(false);
  const [showGateway, setShowGateway] = useState(true);
  const [state, load] = useOrders(storeKey, page, pageSize, filters);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setFilters((current) => ({ ...current, search: searchInput.trim() }));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => {
    setSelectedOrder(null);
    setPage(1);
  }, [storeKey]);
  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const first = await getOrders({ ...filters, page: 1, pageSize: 100 });
      const all = [...first.items];
      for (let next = 2; next <= first.pages; next += 1)
        all.push(
          ...(await getOrders({ ...filters, page: next, pageSize: 100 })).items,
        );
      const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = [
        [
          "Pedido",
          "Cliente",
          "E-mail",
          "País",
          "Data",
          "Itens",
          "Total",
          "Status",
          "Pagamento",
          "Gateway",
        ],
        ...all.map((order) => [
          orderCode(order.publicId),
          order.customer?.name || "",
          order.customer?.email || "",
          order.country || "BR",
          new Date(order.createdAt).toLocaleString("pt-BR"),
          order.items.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0,
          ),
          (order.totalCents / 100).toFixed(2),
          statusLabels[order.status] || order.status,
          "Pix",
          order.paymentProvider || "",
        ]),
      ];
      const blob = new Blob(
        [`\uFEFF${rows.map((row) => row.map(quote).join(";")).join("\n")}`],
        { type: "text/csv;charset=utf-8" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };
  if (selectedOrder)
    return (
      <OrderDetail
        orderId={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        csrfToken={csrfToken}
      />
    );
  return (
    <main className="page orders-page orders-management">
      <section className="page-title orders-title">
        <div>
          <h1>Pedidos</h1>
          <p>
            {state.total.toLocaleString("pt-BR")} pedidos · Acompanhe e gerencie
            as vendas da sua loja
          </p>
        </div>
        <button
          className="secondary export-orders"
          onClick={exportCsv}
          disabled={exporting || state.loading}
        >
          <Download size={16} /> {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </section>
      <section className="card orders-list">
        <div className="orders-toolbar">
          <label className="orders-search">
            <Search size={17} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por ID ou e-mail..."
              aria-label="Buscar pedidos"
            />
          </label>
          <button
            className={`orders-columns ${showGateway ? "active" : ""}`}
            type="button"
            onClick={() => setShowGateway((value) => !value)}
            aria-pressed={showGateway}
          >
            <SlidersHorizontal size={16} /> Gateway
          </button>
        </div>
        <div className="orders-filters">
          <label>
            <SlidersHorizontal size={15} />
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
              <option value="FAILED">Falhou</option>
              <option value="EXPIRED">Expirado</option>
              <option value="REFUNDED">Reembolsado</option>
            </select>
          </label>
          <label>
            <CalendarDays size={15} />
            <span>De</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>
          <label>
            <CalendarDays size={15} />
            <span>Até</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>
          <label>
            <ArrowUpDown size={15} />
            <span>Ordenar</span>
            <select
              value={filters.sort}
              onChange={(event) => updateFilter("sort", event.target.value)}
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="highest">Maior valor</option>
              <option value="lowest">Menor valor</option>
            </select>
          </label>
          <button
            className="filter-refresh"
            onClick={load}
            disabled={state.loading}
            aria-label="Atualizar pedidos"
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <OrdersTable
          {...state}
          onRetry={load}
          onOpen={setSelectedOrder}
          showGateway={showGateway}
        />
        {!state.loading && !state.error && (
          <div className="orders-pagination">
            <div>
              <span>
                Resultado{" "}
                {state.total
                  ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, state.total)}`
                  : "0"}{" "}
                de {state.total.toLocaleString("pt-BR")}
              </span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
                aria-label="Pedidos por página"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
            <div>
              <button
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                Página {page} de {state.pages}
              </span>
              <button
                aria-label="Próxima página"
                disabled={page >= state.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function OrderDetail({ orderId, onBack, csrfToken }) {
  return (
    <OrderWorkspace
      orderId={orderId}
      onBack={onBack}
      csrfToken={csrfToken}
    />
  );
}
