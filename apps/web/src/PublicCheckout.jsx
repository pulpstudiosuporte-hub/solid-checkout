import { Component, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  UserRound,
} from "lucide-react";
import {
  createPublicCheckoutSession,
  createWestPayPix,
  getPaidDigitalDelivery,
  getPublicCheckout,
  getPublicCheckoutSession,
  getPublicMetaConfig,
  getLatestPublicPayment,
  getPublicShippingMethods,
  lookupPostalCode,
  savePublicCheckoutCustomer,
  savePublicCheckoutShipping,
  selectPublicShippingMethod,
  setPublicOrderBump,
  setPublicCheckoutQuantity,
  applyPublicCoupon,
  touchPublicCheckoutPresence,
} from "./api";
import { checkoutLayoutPositionMap } from "./checkout-layout";
import "./public-session.css";
import "./checkout-polish.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const checkoutVisitorId = () => {
  const key = "solid-checkout-visitor-id";
  try {
    const current = localStorage.getItem(key);
    if (current) return current;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};
const cookieValue = (name) => document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
const loadMetaPixel = (pixelId) => {
  if (!pixelId || typeof window === 'undefined') return;
  if (!window.fbq) { const fbq = function(){ fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); }; fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; window.fbq = fbq; const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script); }
  window.fbq('init', pixelId);
};
const trackMeta = (eventName, data = {}, eventId) => { if (!window.fbq) return; const key = eventId ? `solid-meta:${eventId}` : ''; if (key && sessionStorage.getItem(key)) return; window.fbq('track', eventName, data, eventId ? { eventID: eventId } : undefined); if (key) sessionStorage.setItem(key, '1'); };
const publicConfig = (value) => ({
  primary: "#7357e9",
  pageBg: "#f6f7f9",
  cardBg: "#ffffff",
  headerBg: "#ffffff",
  textColor: "#17171a",
  pageTextColor: "#17171a",
  headerTextColor: "#17171a",
  buttonTextColor: "#ffffff",
  borderColor: "#e5e5e9",
  inputBg: "#ffffff",
  radius: 14,
  contentWidth: 1120,
  font: "Plus Jakarta Sans",
  logoText: "SOLID",
  logoUrl: "",
  heroImageUrl: "",
  heroMobileImageUrl: "",
  heroEnabled: false,
  heroHeight: 220,
  secureHeader: true,
  secureText: "Pagamento 100% seguro",
  showProgress: true,
  progressStyle: "outline",
  progressActiveColor: "#7357e9",
  progressInactiveColor: "#ffffff",
  progressActiveTextColor: "#ffffff",
  timer: true,
  timerText: "Sessão reservada por",
  timerMinutes: 10,
  timerStyle: "bar",
  timerBgColor: "#151c2c",
  timerTextColor: "#ffffff",
  timerNumberColor: "#ff515a",
  timerRadius: 14,
  eyebrow: "FINALIZE SEU PEDIDO",
  title: "Você está a um passo.",
  subtitle: "Preencha seus dados para continuar. Leva menos de um minuto.",
  buttonText: "Continuar para entrega",
  summaryTitle: "Resumo da compra",
  summaryBannerUrl: "",
  summaryBannerFit: "cover",
  layout: "split",
  showSummary: true,
  showBump: true,
  showTrust: true,
  trustBenefit1: "Pagamento protegido",
  trustBenefit2: "Confirmação automática",
  trustBenefit3: "Seus dados estão seguros",
  testimonialName: "Cliente verificado",
  testimonialText: "Compra simples, rápida e segura.",
  testimonials: null,
  elementEditMode: "guided",
  elementGlobalStyle: { radius: 12, spacing: 12, fontScale: 100 },
  footerText: "© 2026 Solid Commerce. Todos os direitos reservados.",
  privacyUrl: "#",
  termsUrl: "#",
  buttonEffect: "lift",
  blockOrder: ["hero", "timer", "progress", "content"],
  ...(value || {}),
});
const configStyle = (config) => ({
  "--public-primary": config.primary,
  "--public-bg": config.pageBg,
  "--public-card": config.cardBg,
  "--public-header": config.headerBg,
  "--public-text": config.textColor,
  "--public-page-text": config.pageTextColor,
  "--public-header-text": config.headerTextColor,
  "--public-button-text": config.buttonTextColor,
  "--public-muted": `color-mix(in srgb, ${config.textColor} 68%, transparent)`,
  "--public-border": config.borderColor,
  "--public-input": config.inputBg,
  "--public-radius": `${config.radius}px`,
  "--public-content-width": `${config.contentWidth}px`,
  "--public-hero-height": `${config.heroHeight}px`,
  "--public-timer-bg": config.timerBgColor,
  "--public-timer-text": config.timerTextColor,
  "--public-timer-number": config.timerNumberColor,
  "--public-timer-radius": `${config.timerRadius}px`,
  "--public-element-radius": `${config.elementGlobalStyle?.radius ?? 12}px`,
  "--public-element-spacing": `${config.elementGlobalStyle?.spacing ?? 12}px`,
  "--public-element-font-scale": `${(config.elementGlobalStyle?.fontScale ?? 100) / 100}`,
  "--public-progress-active": config.progressActiveColor || config.primary,
  "--public-progress-inactive": config.progressInactiveColor || "#ffffff",
  "--public-progress-active-text": config.progressActiveTextColor || "#ffffff",
  fontFamily: config.font,
});
// Shopify descriptions are stored as HTML. The public checkout renders them
// as plain text, so extract their readable content instead of exposing tags.
const descriptionText = (value) => {
  if (!value) return "";
  if (typeof DOMParser === "undefined") return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return new DOMParser().parseFromString(value, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
};

function CustomElementCountdown({ minutes = 10 }) {
  const [remaining, setRemaining] = useState(Math.max(1, minutes) * 60);
  useEffect(() => { const interval = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000); return () => window.clearInterval(interval); }, []);
  const hours = String(Math.floor(remaining / 3600)).padStart(2, '0'); const mins = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0'); const seconds = String(remaining % 60).padStart(2, '0');
  return <strong className="public-custom-countdown">{hours} : {mins} : {seconds}</strong>;
}

function PublicCustomElement({ item }) {
  const style = { color: item.textColor, background: item.backgroundColor, borderRadius: `${item.radius ?? 12}px`, padding: `${item.paddingY ?? 16}px ${item.paddingX ?? 18}px`, fontSize: `${item.fontSize || 14}px`, textAlign: item.align || 'left' };
  const iconStyle = { color: item.iconColor || '#7357e9', background: item.iconBackgroundColor || '#f0ebff' };
  const mediaStyle = { '--element-image-height': `${item.imageHeight || 220}px`, objectFit: item.imageFit || 'cover' };
  return (
    <section className={`public-custom-element type-${item.type} device-${item.device || 'all'} ${item.imageUrl ? 'has-media' : ''}`} style={style}>
      {item.mediaUrl && item.type === 'video' ? <video className="public-custom-media" src={item.mediaUrl} poster={item.imageUrl || undefined} controls preload="metadata"/> : item.imageUrl ? <img className="public-custom-media" src={item.imageUrl} alt={item.imageAlt || ''} width="1600" height={item.imageHeight || 220} style={mediaStyle} loading="lazy" decoding="async"/> : <div className="public-custom-icon" style={iconStyle}>
        {["testimonial","reviews"].includes(item.type) ? <Star size={20} /> : item.type === "faq" ? <CircleHelp size={20} /> : item.type === 'timer' ? <Clock3 size={20}/> : <ShieldCheck size={20} />}
      </div>}
      <div>
        {["testimonial","reviews"].includes(item.type) && <span className="public-custom-stars">{"★".repeat(item.rating || 5)}</span>}
        <h2>{item.title}</h2>
        <p>{item.text}</p>{item.type === 'timer' && <CustomElementCountdown minutes={item.durationMinutes}/>} {item.type === 'progress' && <span className="public-custom-progress"><i style={{width:`${item.progress || 72}%`}}/></span>}
      </div>
    </section>
  );
}

function publicCustomWrapProps(config, item) {
  if (config.elementEditMode !== "free") return {};
  const width = item.widthPercent || 100;
  return {
    className: `free align-${item.horizontalAlign || "center"}`,
    style: {
      "--element-free-width": `${width}%`,
      "--element-free-max": `${Math.round(((config.contentWidth || 1120) * width) / 100)}px`,
      "--element-free-gutter": `${Math.round((32 * width) / 100)}px`,
    },
  };
}

function ProductImage({ src, title }) {
  return src ? (
    <img src={src} alt={`Imagem de ${title}`} loading="lazy" />
  ) : (
    <div className="public-product-placeholder" aria-hidden="true">
      <ShoppingBag />
    </div>
  );
}

export class PublicCheckoutErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("[SOLID public checkout error]", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="public-checkout-state error" role="alert">
        <ShoppingBag />
        <b>Não foi possível abrir esta etapa</b>
        <span>Atualize a página para continuar sua compra com segurança.</span>
        <button type="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  }
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
  const [sessionToken, setSessionToken] = useState("");
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);
  useEffect(() => {
    autoStarted.current = false;
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
  async function begin() {
    setBusy(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      const search = new URLSearchParams(window.location.search); const hashSearch = new URLSearchParams(window.location.hash.split('?')[1] || ''); const read = key => search.get(key) || hashSearch.get(key); const fbclid = read('fbclid'); const trackingParameters = { ...Object.fromEntries(['src','sck','utm_source','utm_campaign','utm_medium','utm_content','utm_term'].map(key => [key, read(key)])), fbp: cookieValue('_fbp') || null, fbc: cookieValue('_fbc') || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null), event_source_url: window.location.href, visitor_id: checkoutVisitorId() };
      const result = await createPublicCheckoutSession(
        storeSlug,
        checkoutSlug,
        { quantity, trackingParameters, ...(variantId ? { variantId } : {}) },
      );
      sessionStorage.setItem(
        `solid-checkout-session:${result.session.publicId}`,
        result.token,
      );
      const { session: completeSession } = await getPublicCheckoutSession(
        result.session.publicId,
        result.token,
      );
      window.history.replaceState(
        {},
        "",
        `/#/session/${result.session.publicId}`,
      );
      setSessionToken(result.token);
      setSession(completeSession);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!product || session || autoStarted.current) return;
    if (product.variants?.length > 0 && !variantId) return;
    autoStarted.current = true;
    void begin();
  }, [product, variantId, session]);
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
  if (session && sessionToken)
    return <SessionContent session={session} token={sessionToken} />;
  return (
    <div className={`public-checkout-state ${state.error ? "error" : ""}`} role={state.error ? "alert" : "status"}>
      {state.error ? <ShoppingBag /> : <LoaderCircle className="spin" />}
      <b>{state.error ? "Não foi possível iniciar o checkout" : "Preparando checkout seguro..."}</b>
      {state.error && <span>{state.error}</span>}
      {state.error && <button type="button" disabled={busy} onClick={() => { autoStarted.current = true; void begin(); }}>Tentar novamente</button>}
    </div>
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
    label: `${String(Math.floor(remaining / 3600)).padStart(2, "0")} : ${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")} : ${String(remaining % 60).padStart(2, "0")}`,
  };
}

function useCheckoutPresence(sessionId, token) {
  useEffect(() => {
    if (!sessionId || !token) return undefined;
    const heartbeat = () => {
      if (document.visibilityState === "visible")
        touchPublicCheckoutPresence(sessionId, token).catch(() => {});
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 20_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [sessionId, token]);
}

function SessionContent({ session: initialSession, token }) {
  const [session, setSession] = useState(initialSession);
  useCheckoutPresence(session.publicId, token);
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
  const requiresShipping = session.checkout?.product?.fulfillmentType !== 'DIGITAL';
  const [step, setStep] = useState(
    requiresShipping ? (session.shippingCaptured ? 3 : session.customerCaptured ? 2 : 1) : session.customerCaptured ? 4 : 1,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [payment, setPayment] = useState(null);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [delivery, setDelivery] = useState(null);
  const [copied, setCopied] = useState(false);
  const [couponCode, setCouponCode] = useState(session.couponCode || "");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponOpen, setCouponOpen] = useState(Boolean(session.couponCode));
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
  const primaryItem = {
          quantity: session.quantity,
          unitPriceCents: session.unitPriceCents,
          totalCents: session.unitPriceCents * session.quantity,
          titleSnapshot: session.checkout.product.checkoutTitle,
          variantSnapshot: session.variant?.title,
          imageUrlSnapshot:
            session.variant?.imageUrl || session.checkout.product.imageUrl,
          isOrderBump: false,
        };
  const storedItems = session.items || [];
  const items = storedItems.some(item => !item.isOrderBump) ? storedItems : [primaryItem, ...storedItems];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const metaData = { value: session.totalCents / 100, currency: session.currency || 'BRL', content_type: 'product', content_ids: items.map(item => item.product?.publicId || item.productId).filter(Boolean), contents: items.map(item => ({ id: item.product?.publicId || item.productId || item.titleSnapshot, quantity: item.quantity, item_price: item.unitPriceCents / 100 })), num_items: itemCount };
  useEffect(() => { const controller = new AbortController(); getPublicMetaConfig(session.publicId, token, controller.signal).then(({ pixelId }) => { if (!pixelId) return; setMetaPixelId(pixelId); loadMetaPixel(pixelId); trackMeta('PageView', {}, `${session.publicId}:PageView`); trackMeta('ViewContent', metaData, `${session.publicId}:ViewContent`); trackMeta('InitiateCheckout', metaData, `${session.publicId}:InitiateCheckout`); }).catch(() => {}); return () => controller.abort(); }, [session.publicId, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const config = publicConfig(session.checkout?.publishedConfig);
  const layoutPositions = checkoutLayoutPositionMap(config);
  const layoutOrder = (kind, id) => layoutPositions.get(`${kind}:${id}`) ?? 1;
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const toggleOrderBump = async (productId, enabled) => {
    setBusy(true);
    setError("");
    try {
      const result = await setPublicOrderBump(session.publicId, token, productId, enabled);
      setSession({ ...result.session, discountCents: result.update.discountCents, couponCode: session.couponCode });
      if (selectedShipping) setSelectedShipping((current) => current ? { ...current, subtotalCents: result.update.totalCents, grandTotalCents: result.update.grandTotalCents } : current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  const changeQuantity = async (quantity) => {
    if (quantity < 1 || quantity > (session.checkout.product.maxPerOrder || 1000) || busy || payment) return;
    setBusy(true); setError('');
    try { const result = await setPublicCheckoutQuantity(session.publicId, token, quantity); setSession(result.session); if (selectedShipping) setSelectedShipping(current => current ? { ...current, subtotalCents: result.update.totalCents, discountCents: result.update.discountCents, grandTotalCents: result.update.grandTotalCents } : current); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const applyCoupon = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setCouponMessage("");
    try { const { coupon } = await applyPublicCoupon(session.publicId, token, couponCode); setSession(current => ({ ...current, couponCode: coupon.code, discountCents: coupon.discountCents })); if (selectedShipping) setSelectedShipping(current => ({ ...current, discountCents: coupon.discountCents, grandTotalCents: coupon.grandTotalCents })); setCouponMessage(coupon.code ? `Cupom ${coupon.code} aplicado.` : "Cupom removido."); }
    catch (requestError) { setCouponMessage(requestError.message); }
    finally { setBusy(false); }
  };
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
      setStep(requiresShipping ? 2 : 4);
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
    if (!requiresShipping || step !== 3) return;
    setBusy(true); setError("");
    getPublicShippingMethods(session.publicId, token).then(({ items: methods }) => setShippingOptions(methods)).catch(requestError => setError(requestError.message)).finally(() => setBusy(false));
  }, [requiresShipping, step, session.publicId, token]);
  useEffect(() => {
    if (!payment || String(payment.status).toUpperCase() !== 'PENDING') return;
    const controller = new AbortController();
    const checkStatus = () => getLatestPublicPayment(session.publicId, token, controller.signal).then(result => {
      setPayment(current => current ? { ...current, ...result.payment } : result.payment);
    }).catch(() => {});
    const interval = window.setInterval(checkStatus, 5000);
    checkStatus();
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [payment?.publicId, payment?.status, session.publicId, token]);
  useEffect(() => {
    if (String(payment?.status).toUpperCase() !== 'PAID' || !session.checkout?.product || session.checkout.product.fulfillmentType !== 'DIGITAL') return;
    const controller = new AbortController();
    getPaidDigitalDelivery(session.publicId, token, controller.signal).then(result => setDelivery(result.delivery)).catch(() => {});
    return () => controller.abort();
  }, [payment?.status, session.checkout?.product?.fulfillmentType, session.publicId, token]);
  useEffect(() => { if (metaPixelId && String(payment?.status).toUpperCase() === 'PAID') trackMeta('Purchase', { ...metaData, value: payment.amountCents / 100, order_id: session.publicId }, `${session.publicId}:Purchase`); }, [metaPixelId, payment?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const chooseShipping = async (method) => {
    setBusy(true); setError("");
    try { const result = await selectPublicShippingMethod(session.publicId, token, method.publicId); setSelectedShipping(result); setStep(4); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const generatePix = async () => {
    setBusy(true); setError("");
    try { const result = await createWestPayPix(session.publicId, token); setPayment(result.payment); if (metaPixelId) trackMeta('AddPaymentInfo', { ...metaData, value: result.payment.amountCents / 100 }, `${session.publicId}:AddPaymentInfo`); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const copyPix = async () => { await navigator.clipboard.writeText(payment.pixCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  if (String(payment?.status).toUpperCase() === "PAID") {
    return <ThankYouPage session={session} items={items} itemCount={itemCount} selectedShipping={selectedShipping} payment={payment} config={config} delivery={delivery} />;
  }
  return (
    <main
      className={`public-checkout session-checkout template-${config.template} layout-${config.layout}`}
      style={configStyle(config)}
    >
      <header>
        {config.logoUrl ? <img className="public-brand custom" src={config.logoUrl} alt={config.logoText || 'Logo da loja'} /> : <span className="public-brand-text">{config.logoText || 'SOLID'}</span>}
        {config.secureHeader && (
          <span>
            <ShieldCheck size={18} /> {config.secureText}
          </span>
        )}
      </header>
      {config.heroEnabled && <div className={`public-checkout-hero ${config.heroImageUrl ? 'has-image' : ''}`} style={{ order:layoutOrder('block','hero'), ...(config.heroImageUrl ? { backgroundImage: `url(${config.heroImageUrl})`, '--public-mobile-hero': `url(${config.heroMobileImageUrl || config.heroImageUrl})` } : {}) }}>{!config.heroImageUrl && <><ShoppingBag size={28}/><span>Banner da loja</span></>}</div>}
      {config.timer && (
        <div className={`session-expiry timer-${config.timerStyle}`} role="status" style={{order:layoutOrder('block','timer')}}>
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
      {config.showProgress && <nav className={`checkout-progress style-${config.progressStyle || 'outline'}`} aria-label="Etapas do checkout" style={{order:layoutOrder('block','progress')}}>
        <span className="active">
          <i>1</i>
          Identificação
        </span>
        <b />
        {requiresShipping && <><span className={step >= 2 ? "active" : ""}>
          <i>2</i>
          Entrega
        </span>
        <b /></>}
          <span className={step >= 4 ? "active" : ""}>
            <i>{requiresShipping ? 3 : 2}</i>
          Pagamento
        </span>
      </nav>}
      {(Array.isArray(config.customElements) ? config.customElements : []).filter(item => item.enabled !== false).map((item) => {
        const placement = publicCustomWrapProps(config, item);
        return <div className={`public-custom-wrap ${placement.className || ''}`} key={item.id} style={{ order: layoutOrder('custom',item.id), ...placement.style }}>
          <PublicCustomElement item={item} />
        </div>;
      })}
      <div
        className={`public-checkout-grid ${config.showSummary ? "" : "without-summary"}`}
        style={{order:layoutOrder('block','content')}}
      >
        <section className="customer-step">
          {step === 1 ? (
            <form onSubmit={advance} noValidate>
              <div className="checkout-primary-card">
                <p className="eyebrow">{config.eyebrow}</p>
                <h1>{config.title}</h1>
                <p className="customer-subtitle">{config.subtitle}</p>
                <div className="customer-form-card">
                  <label>
                    Nome completo
                    <input
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      placeholder="Ex.: Maria da Silva"
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="Ex.: maria@email.com"
                    />
                  </label>
                  <div className="customer-field-grid">
                    <label>
                      CPF/CNPJ
                      <input
                        inputMode="numeric"
                        value={form.document}
                        onChange={(event) => update("document", event.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </label>
                    <label>
                      Celular / WhatsApp
                      <input
                        inputMode="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(event) => update("phone", event.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </label>
                  </div>
                  {config.showCoupon && (
                    <div className="checkout-inline-coupon">
                      {!couponOpen ? (
                        <button type="button" onClick={() => setCouponOpen(true)}>
                          + Adicionar cupom
                        </button>
                      ) : (
                        <>
                          <label htmlFor="checkout-coupon-code">
                            Cupom de desconto
                            <span>
                              <input
                                id="checkout-coupon-code"
                                value={couponCode}
                                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                                maxLength="40"
                                placeholder="Digite o código"
                              />
                              <button
                                type="button"
                                disabled={busy || couponCode.trim().length < 3}
                                onClick={applyCoupon}
                              >
                                {session.couponCode ? "Atualizar" : "Aplicar"}
                              </button>
                            </span>
                          </label>
                          {couponMessage && (
                            <small className={session.couponCode ? "success" : "error"}>
                              {couponMessage}
                            </small>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {config.showBump && (session.orderBumps || (session.orderBump ? [session.orderBump] : [])).map((bump) => <label className="public-order-bump" key={bump.publicId}>
                <input type="checkbox" checked={Boolean(session.items?.some(item => item.isOrderBump && item.product?.publicId === bump.publicId))} disabled={busy} onChange={(event) => toggleOrderBump(bump.publicId, event.target.checked)} />
                <span className="public-order-bump-check"><Check size={14} /></span>
                {bump.imageUrl ? <img src={bump.imageUrl} alt="" /> : <span className="public-order-bump-image"><ShoppingBag size={18}/></span>}
                <span><b>{bump.offerTitle || config.orderBumpTitle || 'Oferta especial'}</b><strong>{bump.checkoutTitle}</strong>{descriptionText(bump.offerMessage || config.orderBumpMessage || bump.checkoutDescription) && <small>{descriptionText(bump.offerMessage || config.orderBumpMessage || bump.checkoutDescription)}</small>}</span>
                <em>+ {money.format(bump.priceCents / 100)}</em>
              </label>)}
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
              {config.showTrust && <section className="public-trust" aria-label="Confiança da loja">
                <div className="public-trust-benefits"><span><ShieldCheck size={15}/>{config.trustBenefit1}</span><span><Check size={15}/>{config.trustBenefit2}</span><span><ShieldCheck size={15}/>{config.trustBenefit3}</span></div>
              </section>}
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
              {payment && String(payment.status).toUpperCase() !== "PAID" && <div className="pix-qr-code"><QRCodeSVG value={payment.pixCode} size={188} level="M" includeMargin aria-label="QR Code para pagamento Pix" /></div>}
              <h1>{String(payment?.status).toUpperCase() === 'PAID' ? 'Pagamento confirmado' : payment ? 'Pague com Pix' : 'Tudo pronto para pagar'}</h1>
              {String(payment?.status).toUpperCase() === 'PAID' ? <div className="payment-confirmed" role="status"><CheckCircle2 size={38}/><p>Recebemos seu pagamento. O pedido já está confirmado e a loja foi avisada.</p>{config.successUrl && config.successUrl !== '#' && <a className="customer-continue" href={config.successUrl}>Continuar <ArrowRight size={19}/></a>}</div> : payment ? <><p>Copie o código abaixo e pague no aplicativo do seu banco. A confirmação acontece automaticamente.</p><strong className="real-pix-total">{money.format(payment.amountCents / 100)}</strong><textarea className="pix-copy-code" readOnly value={payment.pixCode}/><button type="button" className="customer-continue" onClick={copyPix}>{copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? 'Código copiado' : 'Copiar código Pix'}</button>{payment.expiresAt && <small className="pix-expiration">Válido até {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(payment.expiresAt))}</small>}</> : <><p>O total foi conferido no servidor. Gere o Pix seguro pelo gateway da loja.</p><button type="button" className="customer-continue" onClick={generatePix} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : 'Gerar Pix agora'} <ArrowRight size={19}/></button></>}
              {error && <p className="public-error" role="alert">{error}</p>}
              {String(payment?.status).toUpperCase() !== 'PAID' && <button type="button" onClick={() => setStep(requiresShipping ? 3 : 1)}>
                {requiresShipping ? 'Voltar e escolher outro frete' : 'Voltar e editar dados'}
              </button>}
            </div>
          )}
        </section>
        {config.showSummary && (
          <div className="session-summary-column">
          {config.summaryBannerUrl && <img className="session-summary-banner" src={config.summaryBannerUrl} alt="Banner do resumo do pedido" style={{objectFit:config.summaryBannerFit || 'cover'}} loading="lazy" decoding="async" />}
          <aside className="session-order-summary">
            <div className="session-summary-title">
              <div>
                <span>Seu pedido</span>
                <h2>{config.summaryTitle}</h2>
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
                    {!item.isOrderBump && session.source === 'DIRECT' ? <div className="public-quantity" aria-label="Quantidade do produto"><button type="button" onClick={()=>changeQuantity(item.quantity-1)} disabled={busy||Boolean(payment)||item.quantity<=1} aria-label="Diminuir quantidade">−</button><b>{item.quantity}</b><button type="button" onClick={()=>changeQuantity(item.quantity+1)} disabled={busy||Boolean(payment)||item.quantity>=(session.checkout.product.maxPerOrder||1000)} aria-label="Aumentar quantidade">+</button></div> : <small>Quantidade: {item.quantity}</small>}
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
                <small>{requiresShipping ? (selectedShipping ? (selectedShipping.shippingPriceCents === 0 ? "Grátis" : money.format(selectedShipping.shippingPriceCents / 100)) : "Escolha na etapa de entrega") : "Não aplicável"}</small>
              </div>
              {session.discountCents > 0 && <div className="coupon-discount"><span>Desconto ({session.couponCode})</span><b>- {money.format(session.discountCents / 100)}</b></div>}
              <div className="session-grand-total">
                <span>Total</span>
                <strong>{money.format((selectedShipping?.grandTotalCents ?? (session.totalCents - (session.discountCents || 0))) / 100)}</strong>
              </div>
            </div>
            <p className="session-security">
              <ShieldCheck size={16} /> Preços e estoque protegidos contra
              alterações no navegador.
            </p>
          </aside>
          </div>
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

function ThankYouPage({ session, items, itemCount, selectedShipping, payment, config, delivery }) {
  const subtotal = session.totalCents;
  const discount = session.discountCents || 0;
  const shipping = selectedShipping?.shippingPriceCents ?? session.shippingPriceCents ?? 0;
  const total = payment?.amountCents ?? selectedShipping?.grandTotalCents ?? subtotal - discount + shipping;
  return (
    <main className="public-checkout thank-you-page" style={configStyle(config)}>
      <header>
        <img className="public-brand" src="/brand/solid-wordmark-dark.png" alt={config.logoText || "SOLID"} />
        {config.secureHeader && <span><ShieldCheck size={18} aria-hidden="true" /> Pagamento seguro</span>}
      </header>
      <section className="thank-you-card" aria-labelledby="thank-you-title">
        <div className="thank-you-icon" aria-hidden="true"><CheckCircle2 size={42} /></div>
        <p className="eyebrow">PAGAMENTO CONFIRMADO</p>
        <h1 id="thank-you-title">Obrigado pela sua compra!</h1>
        <p className="thank-you-lead">Recebemos seu Pix e o seu pedido já está confirmado.{delivery ? ' Seu acesso ao conteúdo já foi liberado abaixo.' : ' Enviaremos as próximas atualizações para o e-mail informado.'}</p>
        <div className="thank-you-order" aria-label="Resumo do pedido">
          <div><span>Pedido SOLID</span><strong>#{session.publicId.slice(-8).toUpperCase()}</strong></div>
          <div><span>Total pago</span><strong>{money.format(total / 100)}</strong></div>
          <div><span>Itens</span><strong>{itemCount} {itemCount === 1 ? "item" : "itens"}</strong></div>
        </div>
        <div className="thank-you-items">{items.map((item) => <div key={`${item.titleSnapshot}-${item.variantSnapshot || "default"}`}><span>{item.quantity}× {item.titleSnapshot}</span><strong>{money.format(item.totalCents / 100)}</strong></div>)}</div>
        <div className="thank-you-totals" aria-label="Totais do pagamento">
          <div><span>Subtotal</span><strong>{money.format(subtotal / 100)}</strong></div>
          {discount > 0 && <div className="discount"><span>Desconto{session.couponCode ? ` (${session.couponCode})` : ''}</span><strong>- {money.format(discount / 100)}</strong></div>}
          {shipping > 0 && <div><span>Frete</span><strong>{money.format(shipping / 100)}</strong></div>}
          <div className="paid"><span>Total pago</span><strong>{money.format(total / 100)}</strong></div>
        </div>
        {delivery && <a className="customer-continue thank-you-cta" href={delivery.url} target="_blank" rel="noopener noreferrer">Acessar conteúdo <ArrowRight size={19} aria-hidden="true" /></a>}
        {config.successUrl && config.successUrl !== "#" && <a className="customer-continue thank-you-cta" href={config.successUrl}>Continuar para a loja <ArrowRight size={19} aria-hidden="true" /></a>}
        <p className="thank-you-help">Dúvidas sobre seu pedido? Entre em contato diretamente com a loja.</p>
      </section>
      <footer className="public-checkout-footer"><span>{config.footerText}</span><div>{config.privacyUrl && <a href={config.privacyUrl}>Privacidade</a>}{config.termsUrl && <a href={config.termsUrl}>Termos de uso</a>}</div></footer>
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
