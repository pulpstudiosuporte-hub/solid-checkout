import { useEffect, useState } from "react";
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, QrCode, RefreshCw, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { getOrders } from "./api";
import OrderWorkspace from "./OrderWorkspace";
import "./orders-page.css";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
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
const countryFlag = (country) =>
  country === "BR"
    ? "🇧🇷"
    : country === "US"
      ? "🇺🇸"
      : country === "PT"
        ? "🇵🇹"
        : country || "—";
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
