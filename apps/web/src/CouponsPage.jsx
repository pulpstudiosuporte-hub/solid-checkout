import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createCoupon, deleteCoupon, getCoupons, updateCoupon } from "./api";

const empty = {
  code: "",
  type: "PERCENT",
  value: "10",
  minimum: "0",
  maxDiscount: "",
  maxRedemptions: "",
  startsAt: "",
  expiresAt: "",
  active: true,
};

const numberValue = (value) => Number(String(value).replace(",", "."));
const cents = (value) => Math.round(numberValue(value) * 100);
const percentUnits = (value) => Math.round(numberValue(value) * 100);
const percentLabel = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    value / 100,
  );
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const date = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const inputOf = (coupon) =>
  coupon
    ? {
        code: coupon.code,
        type: coupon.type,
        value: String(coupon.value / 100).replace(".", ","),
        minimum: String(coupon.minimumSubtotalCents / 100).replace(".", ","),
        maxDiscount: coupon.maxDiscountCents
          ? String(coupon.maxDiscountCents / 100).replace(".", ",")
          : "",
        maxRedemptions: coupon.maxRedemptions ?? "",
        startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 16) : "",
        expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "",
        active: coupon.active,
      }
    : { ...empty };

const payloadOf = (form) => ({
  code: form.code.trim().toUpperCase(),
  type: form.type,
  value: form.type === "PERCENT" ? percentUnits(form.value) : cents(form.value),
  minimumSubtotalCents: cents(form.minimum || 0),
  maxDiscountCents: form.maxDiscount ? cents(form.maxDiscount) : null,
  maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
  startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
  expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  active: form.active,
});

function CouponStatus({ coupon }) {
  const now = Date.now();
  const scheduled =
    coupon.startsAt && new Date(coupon.startsAt).getTime() > now;
  const expired =
    coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now;
  const exhausted =
    coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions;
  const label = !coupon.active
    ? "Inativo"
    : expired
      ? "Expirado"
      : exhausted
        ? "Esgotado"
        : scheduled
          ? "Agendado"
          : "Ativo";
  return (
    <span className={`coupon-status status-${label.toLowerCase()}`}>
      {label}
    </span>
  );
}

function CouponModal({
  editing,
  form,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  const firstInput = useRef(null);
  const dialog = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    firstInput.current?.focus();
    return () => returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [busy, onClose]);

  return (
    <div
      className="modal-backdrop coupon-modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose()
      }
    >
      <form
        ref={dialog}
        className="coupon-modal coupon-management-modal"
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-modal-title"
      >
        <header className="coupon-modal-header">
          <button
            type="button"
            className="coupon-back-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar formulário"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 id="coupon-modal-title">
            {editing === "new" ? "Criar cupom" : "Editar cupom"}
          </h2>
          <div className="coupon-modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              {editing === "new" ? "Criar cupom" : "Salvar alterações"}
            </button>
          </div>
        </header>

        <div
          className="coupon-modal-tabs"
          role="tablist"
          aria-label="Configuração do cupom"
        >
          <button
            type="button"
            className="active"
            role="tab"
            aria-selected="true"
          >
            Cupom
          </button>
          <span role="tab" aria-selected="false" aria-disabled="true">
            Modal promocional <small>Em breve</small>
          </span>
        </div>

        <div className="coupon-modal-scroll">
          {error && (
            <p className="coupon-form-error" role="alert">
              {error}
            </p>
          )}

          <section className="coupon-form-section">
            <h3>Informações do cupom</h3>
            <div className="coupon-form-grid">
              <div className="coupon-field">
                <label htmlFor="coupon-code">
                  Código do cupom <b aria-hidden="true">*</b>
                </label>
                <input
                  ref={firstInput}
                  id="coupon-code"
                  value={form.code}
                  onChange={(event) =>
                    onChange(
                      "code",
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9_-]/g, ""),
                    )
                  }
                  minLength="3"
                  maxLength="40"
                  autoComplete="off"
                  required
                  placeholder="EX: BEMVINDO10"
                />
              </div>
            </div>
          </section>

          <section className="coupon-form-section">
            <h3>Desconto</h3>
            <div className="coupon-form-grid two-columns">
              <div className="coupon-field">
                <label htmlFor="coupon-type">
                  Tipo de desconto <b aria-hidden="true">*</b>
                </label>
                <select
                  id="coupon-type"
                  value={form.type}
                  onChange={(event) => onChange("type", event.target.value)}
                >
                  <option value="PERCENT">Porcentagem (%)</option>
                  <option value="FIXED">Valor fixo (R$)</option>
                </select>
              </div>
              <div className="coupon-field">
                <label htmlFor="coupon-value">
                  Valor do desconto <b aria-hidden="true">*</b>
                </label>
                <input
                  id="coupon-value"
                  type="number"
                  min="0.01"
                  max={form.type === "PERCENT" ? 100 : 999999}
                  step="0.01"
                  value={form.value}
                  onChange={(event) => onChange("value", event.target.value)}
                  required
                  placeholder={form.type === "PERCENT" ? "Ex: 10" : "Ex: 25,00"}
                />
              </div>
            </div>
          </section>

          <section className="coupon-form-section">
            <h3>Limites e validade</h3>
            <div className="coupon-form-grid three-columns">
              <div className="coupon-field">
                <label htmlFor="coupon-limit">Quantidade máxima de usos</label>
                <input
                  id="coupon-limit"
                  type="number"
                  min="1"
                  value={form.maxRedemptions}
                  onChange={(event) =>
                    onChange("maxRedemptions", event.target.value)
                  }
                  placeholder="Vazio = ilimitado"
                />
              </div>
              <div className="coupon-field">
                <label htmlFor="coupon-start">Data de início</label>
                <input
                  id="coupon-start"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => onChange("startsAt", event.target.value)}
                />
              </div>
              <div className="coupon-field">
                <label htmlFor="coupon-end">Data de término</label>
                <input
                  id="coupon-end"
                  type="datetime-local"
                  min={form.startsAt || undefined}
                  value={form.expiresAt}
                  onChange={(event) =>
                    onChange("expiresAt", event.target.value)
                  }
                />
              </div>
            </div>
          </section>

          <section className="coupon-form-section">
            <h3>Configurações adicionais</h3>
            <div className="coupon-form-grid two-columns">
              <div className="coupon-field">
                <label htmlFor="coupon-minimum">Compra mínima (R$)</label>
                <input
                  id="coupon-minimum"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimum}
                  onChange={(event) => onChange("minimum", event.target.value)}
                />
              </div>
              <div className="coupon-field">
                <label htmlFor="coupon-cap">Desconto máximo (R$)</label>
                <input
                  id="coupon-cap"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.maxDiscount}
                  onChange={(event) =>
                    onChange("maxDiscount", event.target.value)
                  }
                  placeholder="Sem limite"
                />
              </div>
            </div>
            <label className="coupon-switch-row">
              <span>
                <b>Cupom ativo</b>
                <small>Permite que este código seja usado no checkout.</small>
              </span>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => onChange("active", event.target.checked)}
              />
              <i aria-hidden="true" />
            </label>
          </section>
        </div>
      </form>
    </div>
  );
}

export default function CouponsPage({ csrfToken, storeKey }) {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState("");

  const load = () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    getCoupons()
      .then(({ items }) => setState({ items, loading: false, error: "" }))
      .catch((error) =>
        setState({ items: [], loading: false, error: error.message }),
      );
  };

  useEffect(load, [storeKey]);

  const visible = useMemo(() => {
    const search = query.trim().toUpperCase();
    return state.items.filter((item) => {
      if (filter === "active" && !item.active) return false;
      if (filter === "inactive" && item.active) return false;
      return !search || item.code.includes(search);
    });
  }, [filter, query, state.items]);

  const open = (item) => {
    setState((current) => ({ ...current, error: "" }));
    setEditing(item || "new");
    setForm(inputOf(item));
  };
  const close = () => !busy && setEditing(null);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      if (editing === "new") await createCoupon(payloadOf(form), csrfToken);
      else await updateCoupon(editing.publicId, payloadOf(form), csrfToken);
      setEditing(null);
      load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (item, active) => {
    setBusy(true);
    try {
      await updateCoupon(
        item.publicId,
        payloadOf({ ...inputOf(item), active }),
        csrfToken,
      );
      load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir o cupom ${item.code}?`)) return;
    setBusy(true);
    try {
      await deleteCoupon(item.publicId, csrfToken);
      load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    window.setTimeout(() => setCopied(""), 1600);
  };

  return (
    <main className="page coupons-page coupon-management-page">
      <section className="coupon-page-heading">
        <div>
          <p className="eyebrow">MARKETING</p>
          <h1>Cupons de Marketing</h1>
          <p>
            Crie e gerencie descontos validados no servidor antes do pagamento.
          </p>
        </div>
        <div>
          <button className="secondary" onClick={load} disabled={state.loading}>
            <RefreshCw className={state.loading ? "spin" : ""} size={17} />{" "}
            Atualizar lista
          </button>
          <button className="primary" onClick={() => open()}>
            <Plus size={17} /> Criar cupom
          </button>
        </div>
      </section>

      {state.error && !editing && (
        <p className="public-error" role="alert">
          {state.error}
        </p>
      )}

      <section className="coupon-table-card">
        <div className="coupon-table-tools">
          <label className="coupon-search" htmlFor="coupon-search">
            <Search size={17} aria-hidden="true" />
            <input
              id="coupon-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código..."
            />
          </label>
          <div
            className="coupon-filters"
            role="group"
            aria-label="Filtrar cupons por status"
          >
            {[
              ["all", "Todos"],
              ["active", "Ativos"],
              ["inactive", "Inativos"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {state.loading ? (
          <div className="coupon-empty">
            <LoaderCircle className="spin" /> Carregando cupons...
          </div>
        ) : state.items.length === 0 ? (
          <div className="coupon-empty">
            <Clipboard size={34} />
            <h2>Nenhum cupom criado</h2>
            <p>Crie seu primeiro incentivo para aumentar a conversão.</p>
            <button className="primary" onClick={() => open()}>
              <Plus size={16} /> Criar cupom
            </button>
          </div>
        ) : (
          <div className="coupon-table-wrap">
            <table className="coupon-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Desconto</th>
                  <th>Usos</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.publicId}>
                    <td data-label="Código">
                      <span className="coupon-code-pill">{item.code}</span>
                      <button
                        type="button"
                        className="coupon-copy"
                        onClick={() => void copyCode(item.code)}
                        aria-label={`Copiar código ${item.code}`}
                      >
                        {copied === item.code ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                    </td>
                    <td data-label="Desconto">
                      <strong>
                        {item.type === "PERCENT"
                          ? `${percentLabel(item.value)}%`
                          : money.format(item.value / 100)}
                      </strong>
                      {item.minimumSubtotalCents > 0 && (
                        <small>
                          Compra mínima:{" "}
                          {money.format(item.minimumSubtotalCents / 100)}
                        </small>
                      )}
                    </td>
                    <td data-label="Usos">
                      <strong>
                        {item.redemptionCount}{" "}
                        {item.redemptionCount === 1 ? "uso" : "usos"}
                      </strong>
                      <small>
                        Restam:{" "}
                        {item.maxRedemptions
                          ? Math.max(
                              0,
                              item.maxRedemptions - item.redemptionCount,
                            )
                          : "∞"}
                      </small>
                    </td>
                    <td data-label="Validade">
                      {item.expiresAt
                        ? `Até: ${date.format(new Date(item.expiresAt))}`
                        : "Sem expiração"}
                    </td>
                    <td data-label="Status">
                      <CouponStatus coupon={item} />
                    </td>
                    <td className="coupon-actions-cell">
                      <details className="coupon-actions-menu">
                        <summary aria-label={`Ações do cupom ${item.code}`}>
                          <MoreHorizontal size={18} />
                        </summary>
                        <div>
                          <button type="button" onClick={() => open(item)}>
                            <Pencil size={15} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void setActive(item, !item.active)}
                            disabled={busy}
                          >
                            {item.active ? (
                              <X size={15} />
                            ) : (
                              <Check size={15} />
                            )}
                            {item.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void remove(item)}
                            disabled={busy}
                          >
                            <Trash2 size={15} /> Excluir
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <div className="coupon-no-results">
                <Search size={22} />
                <b>Nenhum cupom encontrado</b>
                <span>Ajuste a busca ou selecione outro status.</span>
              </div>
            )}
          </div>
        )}
        {!state.loading && state.items.length > 0 && (
          <footer className="coupon-table-footer">
            {visible.length}{" "}
            {visible.length === 1 ? "cupom encontrado" : "cupons encontrados"}
          </footer>
        )}
      </section>

      {editing && (
        <CouponModal
          editing={editing}
          form={form}
          busy={busy}
          error={state.error}
          onChange={change}
          onClose={close}
          onSubmit={submit}
        />
      )}
    </main>
  );
}
