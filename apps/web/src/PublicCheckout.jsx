import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import {
  createPublicCheckoutSession,
  createWestPayPix,
  getPublicCheckout,
  getPublicCheckoutSession,
  getPublicShippingMethods,
  lookupPostalCode,
  savePublicCheckoutCustomer,
  savePublicCheckoutShipping,
  selectPublicShippingMethod,
} from "./api";
import "./public-session.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const publicConfig = (value) => ({
  primary: "#7357e9",
  pageBg: "#f6f7f9",
  cardBg: "#ffffff",
  textColor: "#17171a",
  borderColor: "#e5e5e9",
  inputBg: "#ffffff",
  radius: 14,
  font: "Plus Jakarta Sans",
  logoText: "SOLID",
  secureHeader: true,
  timer: true,
  timerText: "Sessão reservada por",
  title: "Você está a um passo.",
  subtitle: "Preencha seus dados para continuar. Leva menos de um minuto.",
  buttonText: "Continuar para entrega",
  showSummary: true,
  footerText: "© 2026 Solid Commerce. Todos os direitos reservados.",
  privacyUrl: "#",
  termsUrl: "#",
  buttonEffect: "lift",
  ...(value || {}),
});
const configStyle = (config) => ({
  "--public-primary": config.primary,
  "--public-bg": config.pageBg,
  "--public-card": config.cardBg,
  "--public-text": config.textColor,
  "--public-border": config.borderColor,
  "--public-input": config.inputBg,
  "--public-radius": `${config.radius}px`,
  fontFamily: config.font,
});
const safeQuantity = (value, maximum) =>
  Math.max(1, Math.min(maximum, Number(value) || 1));

function ProductImage({ src, title }) {
  return src ? (
    <img src={src} alt={`Imagem de ${title}`} loading="lazy" />
  ) : (
    <div className="public-product-placeholder" aria-hidden="true">
      <ShoppingBag />
    </div>
  );
}

export default function PublicCheckout({ storeSlug, checkoutSlug }) {
  const [state, setState] = useState({
    loading: true,
    checkout: null,
    error: "",
  });
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getPublicCheckout(storeSlug, checkoutSlug, controller.signal)
      .then(({ checkout }) => {
        setState({ loading: false, checkout, error: "" });
        setVariantId(checkout.product.variants?.[0]?.publicId || "");
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ loading: false, checkout: null, error: error.message });
      });
    return () => controller.abort();
  }, [storeSlug, checkoutSlug]);
  const product = state.checkout?.product;
  const config = publicConfig(state.checkout?.publishedConfig);
  const variant = product?.variants?.find(
    (item) => item.publicId === variantId,
  );
  const unitPrice = variant?.priceCents ?? product?.priceCents ?? 0;
  const total = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);
  async function begin() {
    setBusy(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      const result = await createPublicCheckoutSession(
        storeSlug,
        checkoutSlug,
        { quantity, ...(variantId ? { variantId } : {}) },
      );
      sessionStorage.setItem(
        `solid-checkout-session:${result.session.publicId}`,
        result.token,
      );
      setSession(result.session);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  }
  if (state.loading)
    return (
      <div className="public-checkout-state">
        <LoaderCircle className="spin" />
        <span>Preparando checkout seguro...</span>
      </div>
    );
  if (!product)
    return (
      <div className="public-checkout-state error">
        <ShoppingBag />
        <b>Checkout indisponível</b>
        <span>{state.error || "Confira o endereço e tente novamente."}</span>
      </div>
    );
  return (
    <main className="public-checkout" style={configStyle(config)}>
      <header>
        <b>{config.logoText}</b>
        {config.secureHeader && (
          <span>
            <ShieldCheck size={18} /> Pagamento seguro
          </span>
        )}
      </header>
      <div className="public-checkout-grid">
        <section>
          <p className="eyebrow">FINALIZE SEU PEDIDO</p>
          <h1>
            {session ? "Pedido iniciado com segurança." : "Revise sua compra"}
          </h1>
          {session ? (
            <div className="public-session-created">
              <Check size={28} />
              <h2>Sessão criada</h2>
              <p>
                Os valores foram validados pelo servidor e reservados por 30
                minutos.
              </p>
              <strong>{money.format(session.totalCents / 100)}</strong>
            </div>
          ) : (
            <div className="public-form-card">
              {product.variants?.length > 0 && (
                <label>
                  Variação
                  <select
                    value={variantId}
                    onChange={(event) => setVariantId(event.target.value)}
                  >
                    {product.variants.map((item) => (
                      <option key={item.publicId} value={item.publicId}>
                        {item.title} — {money.format(item.priceCents / 100)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Quantidade
                <input
                  type="number"
                  min="1"
                  max={product.maxPerOrder}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      safeQuantity(event.target.value, product.maxPerOrder),
                    )
                  }
                />
              </label>
              {state.error && (
                <p className="public-error" role="alert">
                  {state.error}
                </p>
              )}
              <button onClick={begin} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}{" "}
                Continuar para pagamento
              </button>
            </div>
          )}
        </section>
        <aside>
          <ProductImage src={product.imageUrl} title={product.checkoutTitle} />
          <h2>{product.checkoutTitle}</h2>
          {product.checkoutDescription && <p>{product.checkoutDescription}</p>}
          <div>
            <span>
              {quantity} × {money.format(unitPrice / 100)}
            </span>
            <strong>{money.format(total / 100)}</strong>
          </div>
        </aside>
      </div>
    </main>
  );
}

function useExpiry(expiresAt) {
  const calculate = () =>
    Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    );
  const [remaining, setRemaining] = useState(calculate);
  useEffect(() => {
    const interval = window.setInterval(() => setRemaining(calculate()), 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);
  return {
    remaining,
    label: `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`,
  };
}

function SessionContent({ session, token }) {
  const expiry = useExpiry(session.expiresAt);
  const [form, setForm] = useState({
    name: "",
    email: "",
    document: "",
    phone: "",
  });
  const [address, setAddress] = useState({
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [step, setStep] = useState(
    session.shippingCaptured ? 3 : session.customerCaptured ? 2 : 1,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [payment, setPayment] = useState(null);
  const [copied, setCopied] = useState(false);
  const [postalStatus, setPostalStatus] = useState({
    type: "idle",
    message: "",
  });
  const lastPostalCode = useRef("");
  const numberInput = useRef(null);
  useEffect(() => {
    const postalCode = address.postalCode.replace(/\D/g, "");
    if (postalCode.length !== 8 || postalCode === lastPostalCode.current)
      return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      lastPostalCode.current = postalCode;
      setPostalStatus({ type: "loading", message: "Buscando endereço…" });
      try {
        const { address: found } = await lookupPostalCode(
          postalCode,
          controller.signal,
        );
        setAddress((current) => ({
          ...current,
          postalCode: `${postalCode.slice(0, 5)}-${postalCode.slice(5)}`,
          street: found.street || current.street,
          neighborhood: found.neighborhood || current.neighborhood,
          city: found.city || current.city,
          state: found.state || current.state,
        }));
        setPostalStatus({
          type: "success",
          message: found.street
            ? "Endereço encontrado. Agora informe o número."
            : "Cidade encontrada. Complete os campos restantes.",
        });
        window.setTimeout(() => numberInput.current?.focus(), 0);
      } catch (lookupError) {
        if (lookupError.name !== "AbortError")
          setPostalStatus({ type: "error", message: lookupError.message });
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address.postalCode]);
  const items = session.items?.length
    ? session.items
    : [
        {
          quantity: session.quantity,
          unitPriceCents: session.unitPriceCents,
          totalCents: session.totalCents,
          titleSnapshot: session.checkout.product.checkoutTitle,
          variantSnapshot: session.variant?.title,
          imageUrlSnapshot:
            session.variant?.imageUrl || session.checkout.product.imageUrl,
        },
      ];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const config = publicConfig(session.checkout?.publishedConfig);
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const valid =
    form.name.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.document.replace(/\D/g, "").length >= 11 &&
    form.phone.replace(/\D/g, "").length >= 10;
  const addressValid =
    address.postalCode.replace(/\D/g, "").length === 8 &&
    address.street.trim().length >= 3 &&
    address.number.trim() &&
    address.neighborhood.trim().length >= 2 &&
    address.city.trim().length >= 2 &&
    /^[A-Za-z]{2}$/.test(address.state);
  const advance = async (event) => {
    event.preventDefault();
    if (!valid || !expiry.remaining) return;
    setBusy(true);
    setError("");
    try {
      await savePublicCheckoutCustomer(session.publicId, token, form);
      setStep(2);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  const saveShipping = async (event) => {
    event.preventDefault();
    if (!addressValid || !expiry.remaining) return;
    setBusy(true);
    setError("");
    try {
      await savePublicCheckoutShipping(session.publicId, token, address);
      setStep(3);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (step !== 3) return;
    setBusy(true); setError("");
    getPublicShippingMethods(session.publicId, token).then(({ items: methods }) => setShippingOptions(methods)).catch(requestError => setError(requestError.message)).finally(() => setBusy(false));
  }, [step, session.publicId, token]);
  const chooseShipping = async (method) => {
    setBusy(true); setError("");
    try { const result = await selectPublicShippingMethod(session.publicId, token, method.publicId); setSelectedShipping(result); setStep(4); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const generatePix = async () => {
    setBusy(true); setError("");
    try { const result = await createWestPayPix(session.publicId, token); setPayment(result.payment); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const copyPix = async () => { await navigator.clipboard.writeText(payment.pixCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return (
    <main
      className="public-checkout session-checkout"
      style={configStyle(config)}
    >
      <header>
        <b>{config.logoText}</b>
        {config.secureHeader && (
          <span>
            <ShieldCheck size={18} /> Pagamento seguro
          </span>
        )}
      </header>
      {config.timer && (
        <div className="session-expiry" role="status">
          <Clock3 size={17} />
          <span>
            {expiry.remaining ? (
              <>
                {config.timerText} <strong>{expiry.label}</strong>
              </>
            ) : (
              <strong>Sessão expirada</strong>
            )}
          </span>
        </div>
      )}
      <nav className="checkout-progress" aria-label="Etapas do checkout">
        <span className="active">
          <i>
            <UserRound size={15} />
          </i>
          Identificação
        </span>
        <b />
        <span className={step >= 2 ? "active" : ""}>
          <i>
            <MapPin size={15} />
          </i>
          Entrega
        </span>
        <b />
          <span className={step >= 4 ? "active" : ""}>
            <i>
              <CreditCard size={15} />
          </i>
          Pagamento
        </span>
      </nav>
      <div
        className={`public-checkout-grid ${config.showSummary ? "" : "without-summary"}`}
      >
        <section className="customer-step">
          {step === 1 ? (
            <form onSubmit={advance} noValidate>
              <p className="eyebrow">FINALIZE SEU PEDIDO</p>
              <h1>{config.title}</h1>
              <p className="customer-subtitle">{config.subtitle}</p>
              <div className="customer-form-card">
                <div className="customer-section-title">
                  <span>
                    <UserRound size={19} />
                  </span>
                  <div>
                    <h2>Seus dados</h2>
                    <p>
                      Usaremos essas informações apenas para processar seu
                      pedido.
                    </p>
                  </div>
                </div>
                <label>
                  Nome completo
                  <input
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Como aparece no documento"
                  />
                </label>
                <div className="customer-field-grid">
                  <label>
                    E-mail
                    <input
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="voce@email.com"
                    />
                  </label>
                  <label>
                    Celular / WhatsApp
                    <input
                      inputMode="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </label>
                </div>
                <label>
                  CPF ou CNPJ
                  <input
                    inputMode="numeric"
                    value={form.document}
                    onChange={(event) => update("document", event.target.value)}
                    placeholder="000.000.000-00"
                  />
                </label>
              </div>
              {error && (
                <p className="public-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className={`customer-continue effect-${config.buttonEffect}`}
                type="submit"
                disabled={!valid || !expiry.remaining || busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  config.buttonText
                )}
                <ArrowRight size={19} />
              </button>
              <p className="customer-privacy">
                <ShieldCheck size={14} /> Seus dados são criptografados antes de
                serem armazenados.
              </p>
            </form>
          ) : step === 2 ? (
            <form onSubmit={saveShipping} noValidate>
              <p className="eyebrow">ENTREGA</p>
              <h1>Onde devemos entregar?</h1>
              <p className="customer-subtitle">
                Informe o endereço completo para calcularmos as opções de frete.
              </p>
              <div className="customer-form-card">
                <div className="customer-section-title">
                  <span>
                    <MapPin size={19} />
                  </span>
                  <div>
                    <h2>Endereço de entrega</h2>
                    <p>Confira os dados antes de continuar.</p>
                  </div>
                </div>
                <label>
                  CEP
                  <input
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength="9"
                    value={address.postalCode}
                    onChange={(event) => {
                      const value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 8);
                      if (value.length < 8) lastPostalCode.current = "";
                      setPostalStatus({ type: "idle", message: "" });
                      setAddress((current) => ({
                        ...current,
                        postalCode:
                          value.length > 5
                            ? `${value.slice(0, 5)}-${value.slice(5)}`
                            : value,
                      }));
                    }}
                    placeholder="00000-000"
                    aria-describedby="postal-code-status"
                  />
                  {postalStatus.message && (
                    <small
                      id="postal-code-status"
                      className={`postal-status ${postalStatus.type}`}
                      role={postalStatus.type === "error" ? "alert" : "status"}
                    >
                      {postalStatus.type === "loading" && (
                        <LoaderCircle className="spin" size={13} />
                      )}
                      {postalStatus.message}
                    </small>
                  )}
                </label>
                <label>
                  Rua ou avenida
                  <input
                    autoComplete="address-line1"
                    value={address.street}
                    onChange={(event) =>
                      setAddress((current) => ({
                        ...current,
                        street: event.target.value,
                      }))
                    }
                    placeholder="Nome da rua"
                  />
                </label>
                <div className="customer-field-grid">
                  <label>
                    Número
                    <input
                      ref={numberInput}
                      value={address.number}
                      onChange={(event) =>
                        setAddress((current) => ({
                          ...current,
                          number: event.target.value,
                        }))
                      }
                      placeholder="123"
                    />
                  </label>
                  <label>
                    Complemento <small>Opcional</small>
                    <input
                      autoComplete="address-line2"
                      value={address.complement}
                      onChange={(event) =>
                        setAddress((current) => ({
                          ...current,
                          complement: event.target.value,
                        }))
                      }
                      placeholder="Apto, bloco..."
                    />
                  </label>
                </div>
                <label>
                  Bairro
                  <input
                    value={address.neighborhood}
                    onChange={(event) =>
                      setAddress((current) => ({
                        ...current,
                        neighborhood: event.target.value,
                      }))
                    }
                    placeholder="Bairro"
                  />
                </label>
                <div className="customer-field-grid">
                  <label>
                    Cidade
                    <input
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={(event) =>
                        setAddress((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                      placeholder="Cidade"
                    />
                  </label>
                  <label>
                    Estado
                    <input
                      autoComplete="address-level1"
                      maxLength="2"
                      value={address.state}
                      onChange={(event) =>
                        setAddress((current) => ({
                          ...current,
                          state: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="SP"
                    />
                  </label>
                </div>
              </div>
              {error && (
                <p className="public-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className={`customer-continue effect-${config.buttonEffect}`}
                type="submit"
                disabled={!addressValid || !expiry.remaining || busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  "Continuar para escolher o frete"
                )}
                <ArrowRight size={19} />
              </button>
              <button
                className="customer-back"
                type="button"
                onClick={() => setStep(1)}
              >
                Voltar para identificação
              </button>
            </form>
          ) : step === 3 ? (
            <div className="shipping-step">
              <p className="eyebrow">ENTREGA</p><h1>Escolha como receber</h1>
              <p className="customer-subtitle">Selecione uma opção para continuar. O valor é confirmado com segurança no servidor.</p>
              {busy && shippingOptions.length === 0 ? <div className="shipping-loading"><LoaderCircle className="spin"/> Buscando opções...</div> : shippingOptions.length === 0 ? <div className="shipping-loading"><ShoppingBag/><b>Nenhuma entrega disponível</b><span>A loja ainda não configurou um método de frete ativo.</span></div> : <div className="public-shipping-options">{shippingOptions.map(method => <button type="button" key={method.publicId} onClick={() => chooseShipping(method)} disabled={busy}><span><Truck size={20}/></span><div><b>{method.name}</b><small><Clock3 size={13}/> {method.minDays === method.maxDays ? `${method.minDays} dias úteis` : `${method.minDays}–${method.maxDays} dias úteis`}</small></div><strong>{method.priceCents === 0 ? 'Grátis' : money.format(method.priceCents / 100)}</strong><ArrowRight size={18}/></button>)}</div>}
              {error && <p className="public-error" role="alert">{error}</p>}
              <button className="customer-back" type="button" onClick={() => setStep(2)}>Voltar e editar endereço</button>
            </div>
          ) : (
            <div className="next-step-placeholder payment-step">
              <span>
                <CreditCard size={25} />
              </span>
              <p className="eyebrow">PAGAMENTO</p>
              <h1>{payment ? 'Pague com Pix' : 'Tudo pronto para pagar'}</h1>
              {payment ? <><p>Copie o código abaixo e pague no aplicativo do seu banco.</p><strong className="real-pix-total">{money.format(payment.amountCents / 100)}</strong><textarea className="pix-copy-code" readOnly value={payment.pixCode}/><button type="button" className="customer-continue" onClick={copyPix}>{copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? 'Código copiado' : 'Copiar código Pix'}</button>{payment.expiresAt && <small className="pix-expiration">Válido até {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(payment.expiresAt))}</small>}</> : <><p>O total foi conferido no servidor. Gere o Pix seguro pela WestPay.</p><button type="button" className="customer-continue" onClick={generatePix} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : 'Gerar Pix agora'} <ArrowRight size={19}/></button></>}
              {error && <p className="public-error" role="alert">{error}</p>}
              <button type="button" onClick={() => setStep(3)}>
                Voltar e escolher outro frete
              </button>
            </div>
          )}
        </section>
        {config.showSummary && (
          <aside className="session-order-summary">
            <div className="session-summary-title">
              <div>
                <span>Seu pedido</span>
                <h2>Resumo da compra</h2>
              </div>
              <small>
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </small>
            </div>
            <div className="session-items">
              {items.map((item) => (
                <article
                  className="public-line-item"
                  key={`${item.titleSnapshot}-${item.variantSnapshot || "default"}`}
                >
                  <ProductImage
                    src={item.imageUrlSnapshot}
                    title={item.titleSnapshot}
                  />
                  <div className="line-item-copy">
                    <b>{item.titleSnapshot}</b>
                    {item.variantSnapshot &&
                      item.variantSnapshot !== "Default Title" && (
                        <span>{item.variantSnapshot}</span>
                      )}
                    <small>Quantidade: {item.quantity}</small>
                    <small>
                      {money.format(item.unitPriceCents / 100)} por unidade
                    </small>
                  </div>
                  <strong>{money.format(item.totalCents / 100)}</strong>
                </article>
              ))}
            </div>
            <div className="session-totals">
              <div>
                <span>Subtotal</span>
                <b>{money.format(session.totalCents / 100)}</b>
              </div>
              <div>
                <span>Frete</span>
                <small>{selectedShipping ? (selectedShipping.shippingPriceCents === 0 ? "Grátis" : money.format(selectedShipping.shippingPriceCents / 100)) : "Escolha na etapa de entrega"}</small>
              </div>
              <div className="session-grand-total">
                <span>Total</span>
                <strong>{money.format((selectedShipping?.grandTotalCents ?? session.totalCents) / 100)}</strong>
              </div>
            </div>
            <p className="session-security">
              <ShieldCheck size={16} /> Preços e estoque protegidos contra
              alterações no navegador.
            </p>
          </aside>
        )}
      </div>
      <footer className="public-checkout-footer">
        <span>{config.footerText}</span>
        <div>
          {config.privacyUrl && <a href={config.privacyUrl}>Privacidade</a>}
          {config.termsUrl && <a href={config.termsUrl}>Termos de uso</a>}
        </div>
      </footer>
    </main>
  );
}

export function PublicSessionCheckout({ sessionId, token }) {
  const [state, setState] = useState({
    loading: true,
    session: null,
    error: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    getPublicCheckoutSession(sessionId, token, controller.signal)
      .then(({ session }) => setState({ loading: false, session, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ loading: false, session: null, error: error.message });
      });
    return () => controller.abort();
  }, [sessionId, token]);
  if (state.loading)
    return (
      <div className="public-checkout-state">
        <LoaderCircle className="spin" />
        <span>Validando carrinho...</span>
      </div>
    );
  if (!state.session)
    return (
      <div className="public-checkout-state error">
        <ShoppingBag />
        <b>Sessão indisponível</b>
        <span>{state.error}</span>
      </div>
    );
  return <SessionContent session={state.session} token={token} />;
}
