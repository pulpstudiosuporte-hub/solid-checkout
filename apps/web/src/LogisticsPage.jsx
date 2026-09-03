import { useEffect, useState } from "react";
import {
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  createShippingMethod,
  deleteShippingMethod,
  getShippingMethods,
  updateShippingMethod,
} from "./api";
import "./logistics-page.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const emptyForm = {
  name: "",
  price: "",
  minDays: "1",
  maxDays: "3",
  active: true,
};
const shippingPresets = [
  {
    key: "full",
    name: "Full",
    image: "/shipping/full.webp",
    minDays: 1,
    maxDays: 2,
    description: "Entrega expressa para pedidos elegíveis.",
  },
  {
    key: "sedex",
    name: "Sedex",
    image: "/shipping/sedex.webp",
    minDays: 1,
    maxDays: 4,
    description: "Entrega rápida dos Correios.",
  },
  {
    key: "pac",
    name: "PAC",
    image: "/shipping/pac.png",
    minDays: 5,
    maxDays: 12,
    description: "Entrega econômica dos Correios.",
  },
];
const shippingImage = (name) =>
  shippingPresets.find((item) => name.toLowerCase().includes(item.key))?.image;

export default function LogisticsPage({ csrfToken, storeKey }) {
  const [state, setState] = useState({ loading: true, items: [], error: "" });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const load = () =>
    getShippingMethods()
      .then(({ items }) => setState({ loading: false, items, error: "" }))
      .catch((error) =>
        setState({ loading: false, items: [], error: error.message }),
      );
  useEffect(() => {
    void load();
  }, [storeKey]);
  const open = (method) => {
    setEditing(method || "new");
    setForm(
      method
        ? {
            name: method.name,
            price: (method.priceCents / 100).toFixed(2).replace(".", ","),
            minDays: String(method.minDays),
            maxDays: String(method.maxDays),
            active: method.active,
          }
        : emptyForm,
    );
  };
  const createPreset = (preset) => {
    setEditing("new");
    setForm({
      name: preset.name,
      price: "",
      minDays: String(preset.minDays),
      maxDays: String(preset.maxDays),
      active: true,
    });
  };
  const submit = async (event) => {
    event.preventDefault();
    const price = Number(form.price.replace(",", "."));
    const input = {
      name: form.name.trim(),
      priceCents: Math.round(price * 100),
      minDays: Number(form.minDays),
      maxDays: Number(form.maxDays),
      active: form.active,
    };
    if (
      !input.name ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(input.minDays) ||
      !Number.isInteger(input.maxDays) ||
      input.maxDays < input.minDays
    )
      return;
    setBusy(true);
    try {
      if (editing === "new") await createShippingMethod(input, csrfToken);
      else await updateShippingMethod(editing.publicId, input, csrfToken);
      setEditing(null);
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (method) => {
    setBusy(true);
    try {
      await updateShippingMethod(
        method.publicId,
        {
          name: method.name,
          priceCents: method.priceCents,
          minDays: method.minDays,
          maxDays: method.maxDays,
          active: !method.active,
        },
        csrfToken,
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  const remove = async (method) => {
    if (!window.confirm(`Excluir o frete “${method.name}”?`)) return;
    setBusy(true);
    try {
      await deleteShippingMethod(method.publicId, csrfToken);
      setEditing(null);
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page logistics-page">
      <section className="page-title">
        <div>
          <p className="eyebrow">CHECKOUT</p>
          <h1>Logística</h1>
          <p>
            Escolha uma modalidade pronta ou crie seus próprios métodos de
            entrega.
          </p>
        </div>
        <button className="primary" onClick={() => open()}>
          <Plus size={17} /> Novo frete
        </button>
      </section>
      {state.error && (
        <p className="public-error" role="alert">
          {state.error}
        </p>
      )}
      <section className="shipping-presets" aria-label="Modalidades prontas">
        {shippingPresets.map((preset) => (
          <button
            type="button"
            key={preset.key}
            onClick={() => createPreset(preset)}
          >
            <img src={preset.image} alt="" />
            <span>
              <b>{preset.name}</b>
              <small>{preset.description}</small>
            </span>
            <Plus size={17} />
          </button>
        ))}
      </section>
      <section className="card logistics-card">
        <div className="logistics-head">
          <div>
            <h2>Métodos de frete</h2>
            <p>
              Os métodos ativos aparecerão para o cliente depois do endereço.
            </p>
          </div>
          <span>{state.items.filter((item) => item.active).length} ativos</span>
        </div>
        {state.loading ? (
          <div className="logistics-empty">
            <LoaderCircle className="spin" /> Carregando métodos...
          </div>
        ) : state.items.length === 0 ? (
          <div className="logistics-empty">
            <Truck size={32} />
            <h3>Nenhum frete criado</h3>
            <p>
              Use uma modalidade pronta acima ou crie uma opção personalizada.
            </p>
            <button className="primary" onClick={() => open()}>
              <Plus size={16} /> Criar primeiro frete
            </button>
          </div>
        ) : (
          <div className="shipping-list">
            {state.items.map((method) => (
              <article
                key={method.publicId}
                className={method.active ? "" : "inactive"}
              >
                <span className="shipping-icon">
                  {shippingImage(method.name) ? (
                    <img src={shippingImage(method.name)} alt="" />
                  ) : (
                    <Truck size={20} />
                  )}
                </span>
                <div>
                  <b>{method.name}</b>
                  <small>
                    <Clock3 size={13} />{" "}
                    {method.minDays === method.maxDays
                      ? `${method.minDays} dias úteis`
                      : `${method.minDays}–${method.maxDays} dias úteis`}
                  </small>
                </div>
                <strong>
                  {method.priceCents === 0
                    ? "Grátis"
                    : money.format(method.priceCents / 100)}
                </strong>
                <label className="shipping-toggle">
                  <input
                    type="checkbox"
                    checked={method.active}
                    onChange={() => toggle(method)}
                    disabled={busy}
                  />
                  <span />
                  <em>{method.active ? "Ativo" : "Inativo"}</em>
                </label>
                <button
                  className="icon-btn"
                  onClick={() => open(method)}
                  aria-label={`Editar ${method.name}`}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => void remove(method)}
                  aria-label={`Excluir ${method.name}`}
                  disabled={busy}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="shipping-modal" onSubmit={submit}>
            <header>
              <div>
                <h2>
                  {editing === "new" ? "Novo método de frete" : "Editar método"}
                </h2>
                <p>Defina o nome, o preço e o prazo que o cliente verá.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(null)}
                aria-label="Fechar"
              >
                <X />
              </button>
            </header>
            <label>
              Nome do frete
              <input
                autoFocus
                maxLength="120"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ex.: Entrega expressa"
                required
              />
            </label>
            <div className="shipping-fields">
              <label>
                Valor (R$)
                <input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  placeholder="0,00"
                  required
                />
              </label>
              <label>
                Prazo mínimo
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={form.minDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minDays: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Prazo máximo
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={form.maxDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maxDays: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>
            <label className="active-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />{" "}
              Disponibilizar no checkout
            </label>
            <footer>
              {editing !== "new" && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void remove(editing)}
                >
                  Excluir
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Save size={17} />
                )}{" "}
                Salvar método
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
