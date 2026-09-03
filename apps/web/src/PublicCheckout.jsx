import { Component, useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Clock3,
  CreditCard,
  ChevronDown,
  LoaderCircle,
  MapPin,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Upload,
  UserRound,
} from "lucide-react";
import {
  createPublicCheckoutSession,
  createWestPayPix,
  getPaidDigitalDelivery,
  getPublicCheckout,
  getPublicCheckoutSession,
  getPublicSocialProof,
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
import {
  buildCheckoutLayoutEntries,
  checkoutLayoutPositionMap,
} from "./checkout-layout";
import CheckoutElementIcon from "./CheckoutElementIcon";
import {
  elementMediaAlt,
  elementMediaClassName,
} from "./checkout-element-presentation";
import CheckoutFooter, { defaultCheckoutFooterMethods } from "./CheckoutFooter";
import SocialProofToast from "./SocialProofToast";
import { useChromaSense } from "./useChromaSense";
import "./public-session.css";
import "./checkout-polish.css";

const checkoutLocales = {
  "pt-BR": {
    identification: "Identificação", shipping: "Entrega", payment: "Pagamento",
    fullName: "Nome completo", email: "E-mail", document: "CPF/CNPJ", phone: "Celular / WhatsApp",
    addCoupon: "+ Adicionar cupom", specialOffer: "Oferta especial", safeData: "Seus dados estão protegidos.",
    yourOrder: "SEU PEDIDO", item: "item", items: "itens", quantity: "Quantidade", subtotal: "Subtotal",
    shippingCost: "Frete", discount: "Desconto", total: "Total", apply: "Aplicar", coupon: "Cupom de desconto",
    mainProduct: "Produto principal", free: "Grátis", chooseShipping: "Escolha na etapa de entrega", notApplicable: "Não aplicável",
    encrypted: "Seus dados são criptografados antes de serem armazenados.", whereDeliver: "Onde devemos entregar?", addressHelp: "Informe o endereço completo para calcularmos as opções de frete.", deliveryAddress: "Endereço de entrega", reviewData: "Confira os dados antes de continuar.", street: "Rua ou avenida", number: "Número", complement: "Complemento", optional: "Opcional", district: "Bairro", city: "Cidade", state: "Estado", continueShipping: "Continuar para escolher o frete", backIdentification: "Voltar para identificação", chooseDelivery: "Escolha como receber", chooseDeliveryHelp: "Selecione uma opção para continuar.", searching: "Buscando opções...", unavailable: "Nenhuma entrega disponível", businessDays: "dias úteis", backAddress: "Voltar e editar endereço", paymentConfirmed: "Pagamento confirmado", payPix: "Pague com Pix", readyPay: "Tudo pronto para pagar", generatePix: "Gerar Pix agora", copyPix: "Copiar código Pix", copied: "Código copiado", backShipping: "Voltar e escolher outro frete", backData: "Voltar e editar dados", perUnit: "por unidade", paymentReceived: "Recebemos seu pagamento e o pedido foi confirmado.", payInstructions: "Copie o código e pague no aplicativo do seu banco.", readyHelp: "O total foi conferido com segurança no servidor.", continue: "Continuar", validUntil: "Válido até",
  },
  "en-US": {
    identification: "Identification", shipping: "Shipping", payment: "Payment",
    fullName: "Full name", email: "Email", document: "Tax ID", phone: "Phone / WhatsApp",
    addCoupon: "+ Add coupon", specialOffer: "Special offer", safeData: "Your data is protected.",
    yourOrder: "YOUR ORDER", item: "item", items: "items", quantity: "Quantity", subtotal: "Subtotal",
    shippingCost: "Shipping", discount: "Discount", total: "Total", apply: "Apply", coupon: "Discount code",
    mainProduct: "Main product", free: "Free", chooseShipping: "Choose during shipping", notApplicable: "Not applicable",
    encrypted: "Your data is encrypted before storage.", whereDeliver: "Where should we deliver?", addressHelp: "Enter the full address to calculate shipping options.", deliveryAddress: "Delivery address", reviewData: "Review the details before continuing.", street: "Street", number: "Number", complement: "Address line 2", optional: "Optional", district: "District", city: "City", state: "State", continueShipping: "Continue to shipping", backIdentification: "Back to identification", chooseDelivery: "Choose how to receive", chooseDeliveryHelp: "Select an option to continue.", searching: "Searching options...", unavailable: "No shipping option available", businessDays: "business days", backAddress: "Back to address", paymentConfirmed: "Payment confirmed", payPix: "Pay with Pix", readyPay: "Ready to pay", generatePix: "Generate Pix", copyPix: "Copy Pix code", copied: "Code copied", backShipping: "Choose another shipping option", backData: "Edit customer details", perUnit: "per unit", paymentReceived: "We received your payment and confirmed the order.", payInstructions: "Copy the code and pay in your banking app.", readyHelp: "The total was securely verified on the server.", continue: "Continue", validUntil: "Valid until",
  },
  es: {
    identification: "Identificación", shipping: "Entrega", payment: "Pago",
    fullName: "Nombre completo", email: "Correo electrónico", document: "Documento", phone: "Teléfono / WhatsApp",
    addCoupon: "+ Añadir cupón", specialOffer: "Oferta especial", safeData: "Tus datos están protegidos.",
    yourOrder: "TU PEDIDO", item: "artículo", items: "artículos", quantity: "Cantidad", subtotal: "Subtotal",
    shippingCost: "Envío", discount: "Descuento", total: "Total", apply: "Aplicar", coupon: "Cupón de descuento",
    mainProduct: "Producto principal", free: "Gratis", chooseShipping: "Elige durante la entrega", notApplicable: "No aplicable",
    encrypted: "Tus datos se cifran antes de guardarse.", whereDeliver: "¿Dónde debemos entregar?", addressHelp: "Ingresa la dirección completa para calcular el envío.", deliveryAddress: "Dirección de entrega", reviewData: "Revisa los datos antes de continuar.", street: "Calle", number: "Número", complement: "Complemento", optional: "Opcional", district: "Barrio", city: "Ciudad", state: "Estado", continueShipping: "Continuar al envío", backIdentification: "Volver a identificación", chooseDelivery: "Elige cómo recibir", chooseDeliveryHelp: "Selecciona una opción para continuar.", searching: "Buscando opciones...", unavailable: "No hay entrega disponible", businessDays: "días hábiles", backAddress: "Volver a la dirección", paymentConfirmed: "Pago confirmado", payPix: "Pagar con Pix", readyPay: "Todo listo para pagar", generatePix: "Generar Pix", copyPix: "Copiar código Pix", copied: "Código copiado", backShipping: "Elegir otro envío", backData: "Editar datos", perUnit: "por unidad", paymentReceived: "Recibimos tu pago y confirmamos el pedido.", payInstructions: "Copia el código y paga desde la app de tu banco.", readyHelp: "El total fue verificado de forma segura.", continue: "Continuar", validUntil: "Válido hasta",
  },
};
const checkoutLanguage = (language) => checkoutLocales[language] || checkoutLocales["pt-BR"];
const checkoutMoney = (config) => new Intl.NumberFormat(config.language === "es" ? "es-ES" : (config.language || "pt-BR"), {
  style: "currency",
  currency: config.currency || "BRL",
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
  buttonBgColor: "#7357e9",
  pageBg: "#f6f7f9",
  cardBg: "#ffffff",
  headerBg: "#ffffff",
  textColor: "#17171a",
  pageTextColor: "#17171a",
  headerTextColor: "#17171a",
  buttonTextColor: "#ffffff",
  borderColor: "#e5e5e9",
  inputBg: "#ffffff",
  inputBorderColor: "#e5e5e9",
  inputRadius: 10,
  radius: 14,
  contentWidth: 1120,
  font: "Plus Jakarta Sans",
  logoText: "SOLID",
  logoUrl: "",
  seoTitle: "",
  seoDescription: "",
  faviconUrl: "",
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
  progressInactiveTextColor: "#777780",
  progressLabelColor: "#777780",
  progressActiveLabelColor: "#17171a",
  timer: true,
  timerText: "Sessão reservada por",
  timerMinutes: 10,
  timerStyle: "bar",
  timerBgColor: "#151c2c",
  timerTextColor: "#ffffff",
  timerNumberColor: "#ff515a",
  timerRadius: 14,
  socialProofEnabled: false,
  socialProofPosition: "bottom-left",
  socialProofVisibleSeconds: 5,
  socialProofIntervalSeconds: 9,
  socialProofHeadline: "{nome} acabou de comprar {produto}.",
  socialProofSecondary: "há {tempo}",
  socialProofIcon: "check",
  socialProofCloseButton: true,
  socialProofBackgroundColor: "#ffffff",
  socialProofTextColor: "#111827",
  socialProofSecondaryColor: "#6b7280",
  socialProofBorderColor: "#e5e7eb",
  socialProofIconBackgroundColor: "#10b981",
  socialProofIconColor: "#ffffff",
  socialProofRadius: 16,
  socialProofShadow: "soft",
  eyebrow: "FINALIZE SEU PEDIDO",
  title: "Você está a um passo.",
  subtitle: "Preencha seus dados para continuar. Leva menos de um minuto.",
  buttonText: "Continuar para entrega",
  summaryTitle: "Resumo da compra",
  summaryBannerUrl: "",
  summaryBannerFit: "cover",
  heroDevice: "all",
  timerDevice: "all",
  progressDevice: "all",
  // Legacy checkouts do not have a device preference saved. Keep the full
  // order summary on desktop by default instead of leaking the desktop card
  // into the mobile flow. Merchants can still explicitly choose "all".
  summaryDevice: "desktop",
  summaryBannerDevice: "desktop",
  trustDevice: "all",
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
  footerEnabled: true,
  footerBackgroundColor: "#000000",
  footerTextColor: "#ffffff",
  footerAlignment: "center",
  footerLayout: "centered",
  footerPadding: 48,
  footerPaymentMethodsEnabled: true,
  footerPaymentTitle: "Formas de pagamento",
  footerPaymentMethods: defaultCheckoutFooterMethods,
  footerCompanyName: "Solid Commerce",
  footerCompanyDocument: "",
  footerCompanyAddress: "",
  footerSecureBadgeEnabled: true,
  footerSecureText: "Pagamento 100% seguro",
  footerShowPolicies: true,
  footerText: "© 2026 Solid Commerce. Todos os direitos reservados.",
  privacyUrl: "#",
  termsUrl: "#",
  buttonEffect: "lift",
  blockOrder: ["hero", "timer", "progress", "content"],
  ...(value || {}),
});
export const checkoutSeoMetadata = (config, checkout) => ({
  title:
    config.seoTitle?.trim() ||
    checkout?.name?.trim() ||
    checkout?.product?.checkoutTitle?.trim() ||
    "Finalizar compra",
  description:
    config.seoDescription?.trim() || "Finalize sua compra com segurança.",
  favicon:
    config.faviconUrl?.trim() ||
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${config.primary || "#7357e9"}"/><path d="M20 25h24l-2 24H22l-2-24Zm7 0v-3a5 5 0 0 1 10 0v3" fill="none" stroke="white" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>`)}`,
});
function useCheckoutSeo(config, checkout) {
  const metadata = checkoutSeoMetadata(config, checkout);
  useEffect(() => {
    const originalTitle = document.title;
    const existingDescription = document.querySelector('meta[name="description"]');
    const originalDescription = existingDescription?.getAttribute("content");
    const description = existingDescription || document.createElement("meta");
    if (!existingDescription) {
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }
    const existingIcon = document.querySelector('link[rel~="icon"]');
    const originalIcon = existingIcon?.getAttribute("href");
    const icon = existingIcon || document.createElement("link");
    if (!existingIcon) {
      icon.setAttribute("rel", "icon");
      document.head.appendChild(icon);
    }
    document.title = metadata.title;
    description.setAttribute("content", metadata.description);
    icon.setAttribute("href", metadata.favicon);
    return () => {
      document.title = originalTitle;
      if (existingDescription && originalDescription !== null)
        existingDescription.setAttribute("content", originalDescription);
      else description.remove();
      if (existingIcon && originalIcon !== null)
        existingIcon.setAttribute("href", originalIcon);
      else icon.remove();
    };
  }, [metadata.description, metadata.favicon, metadata.title]);
}
const configStyle = (config) => ({
  "--public-primary": config.primary,
  "--public-button-bg": config.buttonBgColor || config.primary,
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
  "--public-input-border": config.inputBorderColor || config.borderColor,
  "--public-input-radius": `${config.inputRadius ?? 10}px`,
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
  "--public-progress-inactive-text": config.progressInactiveTextColor || "#777780",
  "--public-progress-label": config.progressLabelColor || "#777780",
  "--public-progress-active-label": config.progressActiveLabelColor || config.textColor,
  fontFamily: config.font === "Georgia" ? "Georgia, serif" : `"${config.font || "Plus Jakarta Sans"}", Arial, sans-serif`,
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

export function PublicCustomElement({ item }) {
  const textColor = item.textColor || '#17171a';
  const contentAlign = ["left", "center", "right"].includes(item.align) ? item.align : "left";
  const style = { color: textColor, '--public-custom-text': textColor, background: item.backgroundColor, borderRadius: `${item.radius ?? 12}px`, padding: `${item.paddingY ?? 16}px ${item.paddingX ?? 18}px`, fontSize: `${item.fontSize || 14}px`, textAlign: contentAlign, '--element-title-color': item.titleColor || textColor, '--element-body-color': item.bodyColor || textColor, '--element-title-size': `${item.titleFontSize || 26}px`, '--element-body-size': `${item.bodyFontSize || 15}px`, '--element-title-weight': item.titleWeight || 700, '--element-body-line-height': (item.lineHeight || 160) / 100 };
  const iconStyle = { color: item.iconColor || '#7357e9', background: item.iconBackgroundColor || '#f0ebff' };
  const mediaStyle = { '--element-image-height': `${item.imageHeight || 220}px`, objectFit: item.imageFit || 'cover' };
  return (
    <section className={`public-custom-element type-${item.type} content-align-${contentAlign} device-${item.device || 'all'} ${item.type !== 'text' && (item.imageUrl || (item.type === 'video' && item.mediaUrl)) ? 'has-media' : ''}`} style={style}>
      {/* Captions are rendered whenever the merchant supplies a captions URL. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {item.type === 'text' ? null : item.mediaUrl && item.type === 'video' ? <video aria-label={item.title || 'Vídeo do checkout'} className="public-custom-media" src={item.mediaUrl} poster={item.imageUrl || undefined} controls preload="metadata">{item.captionsUrl && <track kind="captions" src={item.captionsUrl} srcLang="pt-BR" label="Português" default/>}</video> : item.imageUrl ? <img className={elementMediaClassName("public-custom-media", item.type)} src={item.imageUrl} alt={elementMediaAlt(item)} width="160" height="160" style={mediaStyle} loading="lazy" decoding="async"/> : <div className="public-custom-icon" style={iconStyle}>
        <CheckoutElementIcon type={item.type} size={20} />
      </div>}
      <div className="public-custom-content">
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

const publicCustomElementRegion = (item) => {
  if (item?.region === "sidebar") return "sidebar";
  if (item?.region === "top") return "top";
  return "main";
};

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");
const formatBrazilianMobile = (value) => {
  const raw = onlyDigits(value).replace(/^55(?=\d{11}$)/, "").slice(0, 11);
  if (raw.length <= 2) return raw;
  if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
};
const validBrazilianMobile = (value) => /^\d{2}9\d{8}$/.test(onlyDigits(value).replace(/^55(?=\d{11}$)/, ""));
const formatCpf = (value) => onlyDigits(value).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
const validCpf = (value) => { const cpf = onlyDigits(value); if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false; const digit = (length) => { let sum = 0; for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index); const mod = sum % 11; return mod < 2 ? 0 : 11 - mod; }; return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]); };
const emailSuggestions = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const separator = normalized.indexOf("@");
  const local = (separator >= 0 ? normalized.slice(0, separator) : normalized).trim();
  const typedDomain = separator >= 0 ? normalized.slice(separator + 1) : "";
  if (!local || /\s/.test(local)) return [];
  return ["gmail.com", "hotmail.com", "outlook.com", "icloud.com", "yahoo.com.br"]
    .filter((domain) => !typedDomain || domain.startsWith(typedDomain))
    .map((domain) => `${local}@${domain}`)
    .filter((suggestion) => suggestion !== normalized);
};
const shippingLogo = (name) => { const normalized = String(name || "").toLowerCase(); if (normalized.includes("sedex")) return "/shipping/sedex.webp"; if (normalized.includes("pac")) return "/shipping/pac.png"; if (normalized.includes("full")) return "/shipping/full.webp"; return ""; };

function BrazilFlag() {
  return <svg className="brazil-flag" viewBox="0 0 28 20" role="img" aria-label="Brasil"><rect width="28" height="20" rx="3" fill="#159447"/><path d="M14 3 24 10 14 17 4 10Z" fill="#f7d117"/><circle cx="14" cy="10" r="4" fill="#2455a4"/></svg>;
}

function PublicRegionElements({ config, region, elementId, style }) {
  const elements = (
    Array.isArray(config.customElements) ? config.customElements : []
  ).filter(
    (item) =>
      item.enabled !== false &&
      publicCustomElementRegion(item) === region &&
      (!elementId || item.id === elementId),
  );
  if (!elements.length) return null;
  return (
    <div
      className={`public-region-elements public-region-elements-${region}`}
      style={style}
    >
      {elements.map((item) => {
        const placement = publicCustomWrapProps(config, item);
        return (
          <div
            className={`public-custom-wrap custom-type-${item.type} ${placement.className || ""}`}
            key={item.id}
            style={placement.style}
          >
            <PublicCustomElement item={item} />
          </div>
        );
      })}
    </div>
  );
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
  const quantity = 1;
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
  const begin = useCallback(async () => {
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
  }, [checkoutSlug, quantity, storeSlug, variantId]);
  useEffect(() => {
    if (!product || session || autoStarted.current) return;
    if (product.variants?.length > 0 && !variantId) return;
    autoStarted.current = true;
    void begin();
  }, [begin, product, variantId, session]);
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
  const calculate = useCallback(() =>
    Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    ), [expiresAt]);
  const [remaining, setRemaining] = useState(calculate);
  useEffect(() => {
    const interval = window.setInterval(() => setRemaining(calculate()), 1000);
    return () => window.clearInterval(interval);
  }, [calculate]);
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
  useChromaSense(session.publicId, token);
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [emailSuggestionOpen, setEmailSuggestionOpen] = useState(false);
  const [receiptName, setReceiptName] = useState("");
  const [socialProofMessages, setSocialProofMessages] = useState([]);
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
  const checkoutProduct = session.checkout?.product;
  const primaryItem = checkoutProduct ? {
          quantity: session.quantity,
          unitPriceCents: session.unitPriceCents,
          totalCents: session.unitPriceCents * session.quantity,
          titleSnapshot: checkoutProduct.checkoutTitle,
          variantSnapshot: session.variant?.title,
          imageUrlSnapshot:
            session.variant?.imageUrl || checkoutProduct.imageUrl,
          isOrderBump: false,
        } : null;
  const storedItems = Array.isArray(session.items) ? session.items : [];
  const items = storedItems.some(item => !item.isOrderBump)
    ? storedItems
    : primaryItem ? [primaryItem, ...storedItems] : storedItems;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const metaData = { value: session.totalCents / 100, currency: session.currency || 'BRL', content_type: 'product', content_ids: items.map(item => item.product?.publicId || item.productId).filter(Boolean), contents: items.map(item => ({ id: item.product?.publicId || item.productId || item.titleSnapshot, quantity: item.quantity, item_price: item.unitPriceCents / 100 })), num_items: itemCount };
  useEffect(() => { const controller = new AbortController(); getPublicMetaConfig(session.publicId, token, controller.signal).then(({ pixelId }) => { if (!pixelId) return; setMetaPixelId(pixelId); loadMetaPixel(pixelId); trackMeta('PageView', {}, `${session.publicId}:PageView`); trackMeta('ViewContent', metaData, `${session.publicId}:ViewContent`); trackMeta('InitiateCheckout', metaData, `${session.publicId}:InitiateCheckout`); }).catch(() => {}); return () => controller.abort(); }, [session.publicId, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const config = publicConfig(session.checkout?.publishedConfig);
  const availableOrderBumps = config.showBump
    ? (session.orderBumps || (session.orderBump ? [session.orderBump] : []))
    : [];
  useCheckoutSeo(config, session.checkout);
  useEffect(() => {
    if (!config.socialProofEnabled) {
      setSocialProofMessages([]);
      return undefined;
    }
    let controller = new AbortController();
    const relativeTime = (occurredAt) => {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(occurredAt).getTime()) / 1000));
      if (!Number.isFinite(seconds) || seconds < 60) return "menos de 1 minuto";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
      const days = Math.floor(hours / 24);
      return `${days} ${days === 1 ? "dia" : "dias"}`;
    };
    const load = () => {
      controller.abort();
      controller = new AbortController();
      getPublicSocialProof(session.publicId, token, controller.signal)
        .then(({ items = [] }) => setSocialProofMessages(items.map((item) => ({ ...item, time: relativeTime(item.occurredAt) }))))
        .catch((requestError) => { if (requestError.name !== "AbortError") setSocialProofMessages([]); });
    };
    load();
    const interval = window.setInterval(load, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [config.socialProofEnabled, session.publicId, token]);
  const copy = checkoutLanguage(config.language);
  const money = checkoutMoney(config);
  const paymentExpiry = useExpiry(payment?.expiresAt || session.expiresAt);
  const summaryTotal =
    selectedShipping?.grandTotalCents ??
    session.totalCents - (session.discountCents || 0);
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
    if (quantity < 1 || quantity > (checkoutProduct?.maxPerOrder || 1000) || busy || payment) return;
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
    validBrazilianMobile(form.phone);
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
  const paymentStatus = String(payment?.status || '').toUpperCase();
  const paymentPublicId = payment?.publicId;
  const fulfillmentType = session.checkout?.product?.fulfillmentType;
  useEffect(() => {
    if (!paymentPublicId || paymentStatus !== 'PENDING') return;
    const controller = new AbortController();
    const checkStatus = () => getLatestPublicPayment(session.publicId, token, controller.signal).then(result => {
      setPayment(current => current ? { ...current, ...result.payment } : result.payment);
    }).catch(() => {});
    const interval = window.setInterval(checkStatus, 5000);
    checkStatus();
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [paymentPublicId, paymentStatus, session.publicId, token]);
  useEffect(() => {
    if (paymentStatus !== 'PAID' || fulfillmentType !== 'DIGITAL') return;
    const controller = new AbortController();
    getPaidDigitalDelivery(session.publicId, token, controller.signal).then(result => setDelivery(result.delivery)).catch(() => {});
    return () => controller.abort();
  }, [fulfillmentType, paymentStatus, session.publicId, token]);
  useEffect(() => { if (metaPixelId && String(payment?.status).toUpperCase() === 'PAID') trackMeta('Purchase', { ...metaData, value: payment.amountCents / 100, order_id: session.publicId }, `${session.publicId}:Purchase`); }, [metaPixelId, payment?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const chooseShipping = async (method) => {
    setBusy(true); setError("");
    try { const result = await selectPublicShippingMethod(session.publicId, token, method.publicId); setSelectedShipping(result); setStep(4); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const generatePix = async () => {
    if (!validCpf(form.document)) {
      setError("Informe um CPF válido para gerar o Pix.");
      return;
    }
    setBusy(true); setError("");
    try { await savePublicCheckoutCustomer(session.publicId, token, form); const result = await createWestPayPix(session.publicId, token); setPayment(result.payment); if (metaPixelId) trackMeta('AddPaymentInfo', { ...metaData, value: result.payment.amountCents / 100 }, `${session.publicId}:AddPaymentInfo`); }
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
      {config.heroEnabled && <div className={`public-checkout-hero checkout-device-${config.heroDevice || 'all'} ${config.heroImageUrl ? 'has-image' : ''}`} style={{ order:layoutOrder('block','hero'), ...(config.heroImageUrl ? { backgroundImage: `url(${config.heroImageUrl})`, '--public-mobile-hero': `url(${config.heroMobileImageUrl || config.heroImageUrl})` } : {}) }}>{!config.heroImageUrl && <><ShoppingBag size={28}/><span>Banner da loja</span></>}</div>}
      {config.timer && (
        <div className={`session-expiry timer-${config.timerStyle} checkout-device-${config.timerDevice || 'all'}`} role="status" style={{order:layoutOrder('block','timer')}}>
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
      {config.showProgress && <nav className={`checkout-progress style-${config.progressStyle || 'outline'} checkout-device-${config.progressDevice || 'all'}`} aria-label="Etapas do checkout" style={{order:layoutOrder('block','progress')}}>
        <span className="active">
          <i>{config.progressStyle === 'icons' ? <UserRound size={16} aria-hidden="true" /> : 1}</i>
          {copy.identification}
        </span>
        <b />
        {requiresShipping && <><span className={step >= 2 ? "active" : ""}>
          <i>{config.progressStyle === 'icons' ? <MapPin size={16} aria-hidden="true" /> : 2}</i>
          {copy.shipping}
        </span>
        <b /></>}
          <span className={step >= 4 ? "active" : ""}>
            <i>{config.progressStyle === 'icons' ? <CreditCard size={16} aria-hidden="true" /> : (requiresShipping ? 3 : 2)}</i>
          {copy.payment}
        </span>
      </nav>}
      {buildCheckoutLayoutEntries(config)
        .filter((entry) => entry.kind === "custom")
        .map((entry) => (
          <PublicRegionElements
            key={`top:${entry.id}`}
            config={config}
            region="top"
            elementId={entry.id}
            style={{ order: layoutOrder("custom", entry.id) }}
          />
        ))}
      <div
        className={`public-checkout-grid summary-device-${config.summaryDevice || 'all'} ${config.showSummary ? "" : "without-summary"}`}
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
                    {copy.fullName}
                    <input
                      aria-label={copy.fullName}
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      placeholder="Ex.: Maria da Silva"
                    />
                  </label>
                  <label className="email-autocomplete">
                    {copy.email}
                    <input
                      aria-label={copy.email}
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => { update("email", event.target.value); setEmailSuggestionOpen(true); }}
                      onFocus={() => setEmailSuggestionOpen(true)}
                      onBlur={() => window.setTimeout(() => setEmailSuggestionOpen(false), 120)}
                      onKeyDown={(event) => { if (event.key === "Escape") setEmailSuggestionOpen(false); }}
                      aria-autocomplete="list"
                      aria-expanded={emailSuggestionOpen && emailSuggestions(form.email).length > 0}
                      aria-controls="checkout-email-suggestions"
                      placeholder="Ex.: maria@email.com"
                    />
                    {emailSuggestionOpen && emailSuggestions(form.email).length > 0 && <span className="email-suggestion-list" id="checkout-email-suggestions" role="listbox" aria-label="Sugestões de e-mail">{emailSuggestions(form.email).map((email) => <button type="button" role="option" aria-selected="false" key={email} onMouseDown={(event) => event.preventDefault()} onClick={() => { update("email", email); setEmailSuggestionOpen(false); }}>{email}</button>)}</span>}
                  </label>
                  <div className="customer-field-grid single-phone-field">
                    <label>
                      {copy.phone}
                      <span className="phone-input-shell"><span className="phone-country"><BrazilFlag/><b>+55</b></span><input aria-label={copy.phone} inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={(event) => update("phone", formatBrazilianMobile(event.target.value))} placeholder="(11) 92222-2222" /></span>
                      {form.phone && !validBrazilianMobile(form.phone) && <small className="field-hint error">Informe o DDD e um celular começando com 9.</small>}
                    </label>
                  </div>
                  {config.showCoupon && (
                    <div className="checkout-inline-coupon">
                      {!couponOpen ? (
                        <button type="button" onClick={() => setCouponOpen(true)}>
                          {copy.addCoupon}
                        </button>
                      ) : (
                        <>
                          <label htmlFor="checkout-coupon-code">
                            {copy.coupon}
                            <span>
                              <input
                                aria-label={copy.coupon}
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
                                {session.couponCode ? "↻" : copy.apply}
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
                <ShieldCheck size={14} /> {copy.encrypted}
              </p>
              {config.showTrust && <section className={`public-trust checkout-device-${config.trustDevice || 'all'}`} aria-label="Confiança da loja">
                <div className="public-trust-benefits"><span><i><ShieldCheck size={17}/></i><b>{config.trustBenefit1}</b></span><span><i><Check size={17}/></i><b>{config.trustBenefit2}</b></span><span><i><CreditCard size={17}/></i><b>{config.trustBenefit3}</b></span></div>
              </section>}
            </form>
          ) : step === 2 ? (
            <form onSubmit={saveShipping} noValidate>
              <p className="eyebrow">{copy.shipping.toUpperCase()}</p>
              <h1>{copy.whereDeliver}</h1>
              <p className="customer-subtitle">{copy.addressHelp}</p>
              <div className="customer-form-card">
                <div className="customer-section-title">
                  <span>
                    <MapPin size={19} />
                  </span>
                  <div>
                    <h2>{copy.deliveryAddress}</h2>
                    <p>{copy.reviewData}</p>
                  </div>
                </div>
                <label>
                  CEP
                  <input
                    aria-label="CEP"
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
                  {copy.street}
                  <input
                    aria-label={copy.street}
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
                    {copy.number}
                    <input
                      aria-label={copy.number}
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
                    {copy.complement} <small>{copy.optional}</small>
                    <input
                      aria-label={copy.complement}
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
                  {copy.district}
                  <input
                    aria-label={copy.district}
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
                    {copy.city}
                    <input
                      aria-label={copy.city}
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
                    {copy.state}
                    <input
                      aria-label={copy.state}
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
                  copy.continueShipping
                )}
                <ArrowRight size={19} />
              </button>
              <button
                className="customer-back"
                type="button"
                onClick={() => setStep(1)}
              >
                {copy.backIdentification}
              </button>
            </form>
          ) : step === 3 ? (
            <div className="shipping-step">
              <p className="eyebrow">{copy.shipping.toUpperCase()}</p><h1>{copy.chooseDelivery}</h1>
              <p className="customer-subtitle">{copy.chooseDeliveryHelp}</p>
              {busy && shippingOptions.length === 0 ? <div className="shipping-loading"><LoaderCircle className="spin"/> {copy.searching}</div> : shippingOptions.length === 0 ? <div className="shipping-loading"><ShoppingBag/><b>{copy.unavailable}</b></div> : <div className="public-shipping-options">{shippingOptions.map(method => { const logo = shippingLogo(method.name); return <button type="button" key={method.publicId} onClick={() => chooseShipping(method)} disabled={busy}><span>{logo ? <img className="public-shipping-logo" src={logo} alt=""/> : <Truck size={20}/>}</span><div><b>{method.name}</b><small><Clock3 size={13}/> {method.minDays === method.maxDays ? `${method.minDays} ${copy.businessDays}` : `${method.minDays}–${method.maxDays} ${copy.businessDays}`}</small></div><strong>{method.priceCents === 0 ? copy.free : money.format(method.priceCents / 100)}</strong><ArrowRight size={18}/></button>; })}</div>}
              {error && <p className="public-error" role="alert">{error}</p>}
              <button className="customer-back" type="button" onClick={() => setStep(2)}>{copy.backAddress}</button>
            </div>
          ) : (
            <div className="next-step-placeholder payment-step">
              <span className="payment-step-icon">
                <CreditCard size={25} />
              </span>
              <p className="eyebrow">{copy.payment.toUpperCase()}</p>
              {String(payment?.status).toUpperCase() === 'PAID' ? <><h1>{copy.paymentConfirmed}</h1><div className="payment-confirmed" role="status"><CheckCircle2 size={38}/><p>{copy.paymentReceived}</p>{config.successUrl && config.successUrl !== '#' && <a className="customer-continue" href={config.successUrl}>{copy.continue} <ArrowRight size={19}/></a>}</div></> : payment ? <div className="pix-payment-panel">
                <h1>Quase lá...</h1>
                <p>Pague seu Pix dentro de <strong>{paymentExpiry.label}</strong><br/>para garantir sua compra.</p>
                <span className="pix-status-pill">Aguardando pagamento <i/><i/><i/></span>
                <section className="pix-payment-card">
                  <p>Valor do Pix: <strong>{money.format(payment.amountCents / 100)}</strong></p>
                  <button type="button" className="customer-continue pix-copy-button" onClick={copyPix}>{copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? copy.copied : copy.copyPix}</button>
                  <p className="pix-bank-warning">Alguns bancos podem exibir alertas de segurança ao pagar via Pix para novos recebedores. Essa é uma medida preventiva e não indica problema na transação.</p>
                  <div className="pix-how-to"><h2>Como pagar o Pix:</h2><ol><li><b>1</b> Copie o código Pix</li><li><b>2</b> Abra seu banco e escolha Pix Copia e Cola</li><li><b>3</b> Cole o código e confirme o pagamento de {money.format(payment.amountCents / 100)}</li></ol></div>
                  <details className="pix-qr-details"><summary><QrCode size={17}/> Pagar com QR Code</summary><div className="pix-qr-code"><QRCodeSVG value={payment.pixCode} size={188} level="M" includeMargin aria-label="QR Code para pagamento Pix" /></div></details>
                  <div className="pix-processor"><small>Pix processado por</small><strong>Pagamento seguro</strong></div>
                  <details className="pix-receipt"><summary>Já pagou o Pix? <span><Upload size={16}/> Enviar comprovante</span></summary><label><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceiptName(event.target.files?.[0]?.name || "")}/><span>{receiptName || "Selecionar comprovante"}</span><small>O pagamento continua sendo confirmado automaticamente.</small></label></details>
                </section>
              </div> : <>
                <h1>{copy.readyPay}</h1>
                <p>{copy.readyHelp}</p>
                {availableOrderBumps.length > 0 && <section className="payment-order-bumps" aria-labelledby="payment-order-bumps-title"><div className="payment-order-bumps-title"><span>OFERTAS EXCLUSIVAS</span><h2 id="payment-order-bumps-title">Complete seu pedido</h2><p>Escolha as ofertas que deseja adicionar antes de gerar o Pix.</p></div><div className="payment-order-bump-list">{availableOrderBumps.map((bump) => {
                  const selected = Boolean(session.items?.some(item => item.isOrderBump && item.product?.publicId === bump.publicId));
                  const hasDiscount = Number(bump.compareAtCents) > Number(bump.priceCents);
                  const discount = hasDiscount ? Math.round((1 - Number(bump.priceCents) / Number(bump.compareAtCents)) * 100) : 0;
                  return <label className={`payment-order-bump-card${selected ? " is-selected" : ""}`} key={bump.publicId}>
                    <input aria-label={`${copy.specialOffer}: ${bump.checkoutTitle}`} type="checkbox" checked={selected} disabled={busy} onChange={(event) => toggleOrderBump(bump.publicId, event.target.checked)} />
                    <span className="payment-order-bump-product">
                      {bump.imageUrl ? <img src={bump.imageUrl} alt="" loading="lazy" /> : <span className="public-order-bump-image"><ShoppingBag size={20}/></span>}
                      <span className="payment-order-bump-copy"><strong>{bump.checkoutTitle}</strong><span className="payment-order-bump-price"><b>{money.format(bump.priceCents / 100)}</b>{hasDiscount && <><del>{money.format(bump.compareAtCents / 100)}</del><em>{discount}% OFF</em></>}</span></span>
                    </span>
                    <span className="payment-order-bump-description"><b>{bump.offerTitle || config.orderBumpTitle || copy.specialOffer}</b>{descriptionText(bump.offerMessage || config.orderBumpMessage || bump.checkoutDescription) && <small>{descriptionText(bump.offerMessage || config.orderBumpMessage || bump.checkoutDescription)}</small>}</span>
                    <span className="payment-order-bump-action"><span className="public-order-bump-check"><Check size={14} /></span>{selected ? "Oferta adicionada" : "Adicionar oferta"}</span>
                  </label>;
                })}</div></section>}
                <div className="payment-cpf-card"><label htmlFor="checkout-payment-cpf">CPF do pagador</label><input id="checkout-payment-cpf" aria-label="CPF do pagador" inputMode="numeric" autoComplete="off" value={form.document} onChange={(event) => update("document", formatCpf(event.target.value))} placeholder="000.000.000-00" maxLength="14"/><small className={form.document ? (validCpf(form.document) ? "success" : "error") : ""}>{form.document ? (validCpf(form.document) ? "CPF válido. Você já pode gerar o Pix." : "Digite um CPF válido com 11 números.") : "O CPF é coletado somente agora, antes de finalizar."}</small></div>
                <button type="button" className={`customer-continue effect-${config.buttonEffect}`} onClick={generatePix} disabled={busy || !validCpf(form.document)}>{busy ? <LoaderCircle className="spin" size={18}/> : copy.generatePix} <ArrowRight size={19}/></button>
              </>}
              {error && <p className="public-error" role="alert">{error}</p>}
              {String(payment?.status).toUpperCase() !== 'PAID' && <button type="button" onClick={() => setStep(requiresShipping ? 3 : 1)}>
                {requiresShipping ? copy.backShipping : copy.backData}
              </button>}
            </div>
          )}
          <PublicRegionElements config={config} region="main" />
        </section>
        {(config.showSummary ||
          (Array.isArray(config.customElements) ? config.customElements : []).some(
            (item) =>
              item.enabled !== false &&
              publicCustomElementRegion(item) === "sidebar",
          )) && (
          <div className={`session-summary-column checkout-device-${config.summaryDevice || 'all'}`}>
          {config.summaryBannerUrl && <img className={`session-summary-banner checkout-device-${config.summaryBannerDevice || 'desktop'}`} src={config.summaryBannerUrl} alt="Banner do resumo do pedido" style={{objectFit:config.summaryBannerFit || 'cover'}} loading="lazy" decoding="async" />}
          {config.showSummary && (
          <aside className={`session-order-summary ${summaryOpen ? "is-open" : "is-collapsed"}`}>
            <button
              type="button"
              className="session-mobile-summary-toggle"
              aria-expanded={summaryOpen}
              aria-controls="session-order-summary-content"
              onClick={() => setSummaryOpen((current) => !current)}
            >
              <span>{config.summaryTitle || "Resumo do pedido"}</span>
              <strong>{money.format(summaryTotal / 100)}</strong>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            <div id="session-order-summary-content" className="session-summary-content">
            <div className="session-summary-title">
              <div>
                <span>{copy.yourOrder}</span>
                <h2>{config.summaryTitle}</h2>
              </div>
              <small>
                {itemCount} {itemCount === 1 ? copy.item : copy.items}
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
                    {!item.isOrderBump && session.source === 'DIRECT' ? <div className="public-quantity" aria-label={copy.quantity}><button type="button" onClick={()=>changeQuantity(item.quantity-1)} disabled={busy||Boolean(payment)||item.quantity<=1} aria-label="−">−</button><b>{item.quantity}</b><button type="button" onClick={()=>changeQuantity(item.quantity+1)} disabled={busy||Boolean(payment)||item.quantity>=(checkoutProduct?.maxPerOrder||1000)} aria-label="+">+</button></div> : <small>{copy.quantity}: {item.quantity}</small>}
                    <small>
                      {money.format(item.unitPriceCents / 100)} {copy.perUnit}
                    </small>
                  </div>
                  <strong>{money.format(item.totalCents / 100)}</strong>
                </article>
              ))}
            </div>
            {config.showCoupon && (
              <form className="session-summary-coupon" onSubmit={applyCoupon}>
                <input
                  aria-label={copy.coupon}
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  maxLength="40"
                  placeholder={copy.coupon || "Código do cupom"}
                />
                <button type="submit" disabled={busy || couponCode.trim().length < 3}>
                  {session.couponCode ? "↻" : copy.apply}
                </button>
                {couponMessage && (
                  <small className={session.couponCode ? "success" : "error"}>
                    {couponMessage}
                  </small>
                )}
              </form>
            )}
            <div className="session-totals">
              <div>
                <span>{copy.subtotal}</span>
                <b>{money.format(session.totalCents / 100)}</b>
              </div>
              <div>
                <span>{copy.shippingCost}</span>
                <small>{requiresShipping ? (selectedShipping ? (selectedShipping.shippingPriceCents === 0 ? copy.free : money.format(selectedShipping.shippingPriceCents / 100)) : copy.chooseShipping) : copy.notApplicable}</small>
              </div>
              {session.discountCents > 0 && <div className="coupon-discount"><span>{copy.discount} ({session.couponCode})</span><b>- {money.format(session.discountCents / 100)}</b></div>}
              <div className="session-grand-total">
                <span>{copy.total}</span>
                <strong>{money.format((selectedShipping?.grandTotalCents ?? (session.totalCents - (session.discountCents || 0))) / 100)}</strong>
              </div>
            </div>
            <p className="session-security">
              <ShieldCheck size={16} /> Preços e estoque protegidos contra
              alterações no navegador.
            </p>
            </div>
          </aside>
          )}
          <PublicRegionElements config={config} region="sidebar" />
          </div>
        )}
      </div>
      <CheckoutFooter config={config} />
      <SocialProofToast config={config} messages={socialProofMessages} />
    </main>
  );
}

function ThankYouPage({ session, items, itemCount, selectedShipping, payment, config, delivery }) {
  const money = checkoutMoney(config);
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
      <CheckoutFooter config={config} />
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
