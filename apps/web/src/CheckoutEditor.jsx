import React, { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Eye,
  GripVertical,
  ImagePlus,
  Laptop,
  LayoutTemplate,
  LoaderCircle,
  MapPin,
  Monitor,
  Palette,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  Tablet,
  Trash2,
  Type,
  Undo2,
  UserRound,
  WalletCards,
} from "lucide-react";
import CheckoutElementsPanel, {
  elementCatalog,
  newElementDefaults,
} from "./CheckoutElementsPanel";
import {
  buildCheckoutLayoutEntries,
  reorderCheckoutLayout,
} from "./checkout-layout";
import "./checkout-polish.css";

export { reorderCheckoutLayout } from "./checkout-layout";

const defaultBlockOrder = ["hero", "timer", "progress", "content"];
export const defaultCheckoutConfig = {
  template: "minimal",
  layout: "split",
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
  timerText: "Oferta reservada por",
  timerMinutes: 10,
  timerStyle: "bar",
  timerBgColor: "#151c2c",
  timerTextColor: "#ffffff",
  timerNumberColor: "#ff515a",
  timerRadius: 14,
  eyebrow: "FINALIZE SEU PEDIDO",
  title: "Você está a um passo.",
  subtitle: "Preencha seus dados para gerar o Pix. Leva menos de um minuto.",
  summaryTitle: "Resumo da compra",
  summaryBannerUrl: "",
  summaryBannerFit: "cover",
  buttonText: "Gerar Pix agora",
  showCoupon: true,
  showBump: true,
  showSummary: true,
  showTrust: true,
  trustBenefit1: "Pagamento protegido",
  trustBenefit2: "Confirmação automática",
  trustBenefit3: "Seus dados estão seguros",
  testimonialName: "Cliente verificado",
  testimonialText: "Compra simples, rápida e segura.",
  testimonials: [
    {
      id: "default",
      name: "Cliente verificado",
      text: "Compra simples, rápida e segura.",
      imageUrl: "",
      rating: 5,
    },
  ],
  customElements: [],
  footerText: "© 2026 Solid Commerce. Todos os direitos reservados.",
  privacyUrl: "#",
  termsUrl: "#",
  language: "pt-BR",
  currency: "BRL",
  successUrl: "",
  buttonEffect: "lift",
  blockOrder: defaultBlockOrder,
};
const templatePresets = {
  minimal: {
    template: "minimal",
    layout: "split",
    primary: "#7357e9",
    pageBg: "#f6f7f9",
    cardBg: "#ffffff",
    headerBg: "#ffffff",
    textColor: "#17171a",
    borderColor: "#e5e5e9",
    inputBg: "#ffffff",
    radius: 14,
    font: "Plus Jakarta Sans",
    heroEnabled: false,
    heroHeight: 220,
    showProgress: true,
    timer: true,
    buttonEffect: "lift",
  },
  conversion: {
    template: "conversion",
    layout: "split",
    primary: "#e8175d",
    pageBg: "#fff1f5",
    cardBg: "#ffffff",
    headerBg: "#ffffff",
    textColor: "#20151a",
    borderColor: "#f0cfda",
    inputBg: "#fffafd",
    radius: 18,
    font: "Inter",
    heroEnabled: false,
    heroHeight: 220,
    showProgress: false,
    timer: true,
    buttonEffect: "pulse",
  },
  showcase: {
    template: "showcase",
    layout: "split",
    primary: "#1746e8",
    pageBg: "#eaf0ff",
    cardBg: "#ffffff",
    headerBg: "#ffffff",
    textColor: "#101a3b",
    borderColor: "#cdd8f6",
    inputBg: "#f8faff",
    radius: 20,
    font: "Plus Jakarta Sans",
    heroEnabled: true,
    heroHeight: 260,
    showProgress: true,
    timer: false,
    buttonEffect: "lift",
  },
  compact: {
    template: "compact",
    layout: "centered",
    primary: "#17171a",
    pageBg: "#f2f0ec",
    cardBg: "#ffffff",
    headerBg: "#17171a",
    textColor: "#17171a",
    borderColor: "#dedbd4",
    inputBg: "#ffffff",
    radius: 8,
    font: "Inter",
    heroEnabled: false,
    heroHeight: 180,
    showProgress: true,
    timer: false,
    buttonEffect: "none",
  },
};
const groups = [
  ["Modelos", LayoutTemplate],
  ["Aparência", Type],
  ["Cores", Palette],
  ["Cabeçalho", Monitor],
  ["Elementos", WalletCards],
  ["Conteúdo das etapas", Type],
  ["Pagamentos", WalletCards],
  ["Rodapé", Type],
  ["Políticas", ShieldCheck],
  ["Efeitos dos botões", Save],
  ["Escassez", Clock3],
  ["Rastreamento de saída", Eye],
  ["Campos personalizados", Type],
  ["Moeda e idioma", WalletCards],
  ["SEO", Monitor],
];
Object.assign(defaultCheckoutConfig, {
  contentWidth: 1120,
  elementGlobalStyle: { radius: 12, spacing: 12, fontScale: 100 },
  orderBumpProductId: "",
  orderBumpTitle: "",
  orderBumpMessage: "",
});
Object.assign(defaultCheckoutConfig, {
  buttonBgColor: "#7357e9",
  inputBorderColor: "#e5e5e9",
  inputRadius: 10,
  progressInactiveTextColor: "#777780",
  progressLabelColor: "#777780",
  progressActiveLabelColor: "#17171a",
});
Object.assign(defaultCheckoutConfig, {
  heroDevice: "all",
  timerDevice: "all",
  progressDevice: "all",
  summaryDevice: "desktop",
  summaryBannerDevice: "desktop",
  trustDevice: "all",
});
const checkoutFontStack = (font) =>
  font === "Georgia"
    ? "Georgia, serif"
    : `"${font || "Plus Jakarta Sans"}", Arial, sans-serif`;
const visibleOnDevice = (setting, device) =>
  !setting ||
  setting === "all" ||
  (setting === "mobile" ? device === "mobile" : device !== "mobile");
const editorLocale = {
  "pt-BR": {
    identification: "Identificação",
    delivery: "Entrega",
    payment: "Pagamento",
    order: "SEU PEDIDO",
    item: "1 item",
    product: "Produto principal",
    quantity: "Quantidade: 1",
    total: "Total",
    coupon: "+ Adicionar cupom",
    offer: "Oferta especial",
    offerCopy: "Adicione o Guia de Resultados",
  },
  "en-US": {
    identification: "Identification",
    delivery: "Shipping",
    payment: "Payment",
    order: "YOUR ORDER",
    item: "1 item",
    product: "Main product",
    quantity: "Quantity: 1",
    total: "Total",
    coupon: "+ Add coupon",
    offer: "Special offer",
    offerCopy: "Add the Results Guide",
  },
  es: {
    identification: "Identificación",
    delivery: "Entrega",
    payment: "Pago",
    order: "TU PEDIDO",
    item: "1 artículo",
    product: "Producto principal",
    quantity: "Cantidad: 1",
    total: "Total",
    coupon: "+ Añadir cupón",
    offer: "Oferta especial",
    offerCopy: "Añade la Guía de Resultados",
  },
};
let editorProducts = [];
let createOrderBump = async () => {};
let uploadOrderBumpImage = async () => {};
let applyTemplate = () => {};
let addCustomElement = () => {};
let updateCustomElement = () => {};
let removeCustomElement = () => {};
const customElementRegion = (item) => {
  if (item?.region === "sidebar") return "sidebar";
  if (item?.region === "top") return "top";
  return "main";
};
function placeCustomElement(
  elements,
  item,
  slot,
  index = Number.POSITIVE_INFINITY,
) {
  const remaining = elements.filter((current) => current.id !== item.id);
  const region = customElementRegion(item);
  const moved = { ...item, slot, region };
  const visibleAtSlot = remaining.filter(
    (current) =>
      customElementRegion(current) === region &&
      current.slot === slot &&
      current.enabled !== false,
  );
  const before = visibleAtSlot[index];
  if (before) {
    remaining.splice(
      remaining.findIndex((current) => current.id === before.id),
      0,
      moved,
    );
    return remaining;
  }
  const slotIndexes = remaining
    .map((current, currentIndex) =>
      customElementRegion(current) === region && current.slot === slot
        ? currentIndex
        : -1,
    )
    .filter((currentIndex) => currentIndex >= 0);
  remaining.splice(
    slotIndexes.length ? slotIndexes.at(-1) + 1 : remaining.length,
    0,
    moved,
  );
  return remaining;
}
export function reorderCustomElements(elements, id, slot, index, patch = {}) {
  const item = elements.find((current) => current.id === id);
  if (!item) return elements;
  const sourceRegion = customElementRegion(item);
  const targetRegion = customElementRegion({ ...item, ...patch });
  const sourceIndex = elements
    .filter(
      (current) =>
        customElementRegion(current) === sourceRegion &&
        current.slot === item.slot &&
        current.enabled !== false,
    )
    .findIndex((current) => current.id === id);
  const targetIndex =
    sourceRegion === targetRegion &&
    item.slot === slot &&
    sourceIndex >= 0 &&
    sourceIndex < index
      ? index - 1
      : index;
  return placeCustomElement(elements, { ...item, ...patch }, slot, targetIndex);
}
const nativeBlockLabels = {
  hero: "Banner",
  timer: "Cronômetro",
  progress: "Etapas",
  content: "Formulário e resumo",
};
export function checkoutLayoutEntries(config) {
  return buildCheckoutLayoutEntries(config).map((entry) => ({
    ...entry,
    label:
      entry.kind === "custom"
        ? elementCatalog[entry.item.type]?.label ||
          entry.item.title ||
          "Elemento personalizado"
        : nativeBlockLabels[entry.id] || entry.id,
  }));
}
function customWrapProps(config, item, scope) {
  if (config.elementEditMode !== "free")
    return { className: `${scope}-custom-wrap custom-type-${item.type}` };
  const width = item.widthPercent || 100;
  return {
    className: `${scope}-custom-wrap custom-type-${item.type} free align-${item.horizontalAlign || "center"}`,
    style: {
      "--element-free-width": `${width}%`,
      "--element-free-max": `${Math.round(((config.contentWidth || 1120) * width) / 100)}px`,
      "--element-free-gutter": `${Math.round((32 * width) / 100)}px`,
    },
  };
}
const Field = ({ label, children, help }) => (
  <label className="editor-field">
    <span>{label}</span>
    {children}
    {help && <small>{help}</small>}
  </label>
);
const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    className={`editor-toggle ${checked ? "on" : ""}`}
    onClick={() => onChange(!checked)}
    aria-pressed={checked}
    aria-label={label}
  >
    <span />
  </button>
);
const Color = ({ label, value, onChange }) => (
  <Field label={label}>
    <div className="color-field">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        value={value.toUpperCase()}
        onChange={(e) =>
          /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)
        }
        maxLength="7"
      />
    </div>
  </Field>
);
function ImageDropzone({
  value,
  onChange,
  id = "checkout-image",
  label = "Arraste uma imagem aqui",
  alt = "Prévia da imagem",
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPG, PNG ou WebP.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await uploadOrderBumpImage(file);
      onChange(result.imageUrl);
    } catch (e) {
      setError(e.message || "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`image-dropzone ${busy ? "busy" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void send(e.dataTransfer.files?.[0]);
      }}
      aria-busy={busy}
    >
      <input
        id={id}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void send(e.target.files?.[0])}
      />
      {value ? <img src={value} alt={alt} /> : <ImagePlus size={22} />}
      <div>
        <b>
          {busy ? (
            <>
              <LoaderCircle className="spin" size={15} /> Otimizando imagem...
            </>
          ) : (
            label
          )}
        </b>
        <small>JPG, PNG ou WebP · será convertida para WebP leve</small>
        <label htmlFor={id} className="dropzone-button">
          Selecionar arquivo
        </label>
        {value && (
          <button
            type="button"
            className="dropzone-remove"
            onClick={() => onChange("")}
          >
            Remover
          </button>
        )}
      </div>
      {error && (
        <span className="dropzone-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function Settings({ group, c, u, replaceConfig }) {
  applyTemplate = (id) => {
    const preset = templatePresets[id] || {};
    Object.entries(preset).forEach(([key, value]) => u(key, value));
    if (preset.primary) u("buttonBgColor", preset.primary);
    if (preset.borderColor) u("inputBorderColor", preset.borderColor);
    if (Number.isInteger(preset.radius))
      u("inputRadius", Math.min(preset.radius, 14));
  };
  const moveLayoutEntry = (entryKey, direction) => {
    replaceConfig(reorderCheckoutLayout(c, entryKey, direction));
  };
  const moveRegionElement = (item, direction) => {
    const region = customElementRegion(item);
    const regionItems = (c.customElements || []).filter(
      (entry) =>
        entry.enabled !== false && customElementRegion(entry) === region,
    );
    const index = regionItems.findIndex((entry) => entry.id === item.id);
    if (index < 0) return;
    u(
      "customElements",
      reorderCustomElements(
        c.customElements || [],
        item.id,
        0,
        direction > 0 ? index + 2 : index - 1,
        { region },
      ),
    );
  };
  const line = (label, key) => (
    <div className="setting-line">
      <span>{label}</span>
      <Toggle checked={c[key]} onChange={(v) => u(key, v)} label={label} />
    </div>
  );
  const visibility = (label, key) => (
    <Field label={label}>
      <select value={c[key] || "all"} onChange={(e) => u(key, e.target.value)}>
        <option value="all">Desktop e celular</option>
        <option value="desktop">Somente desktop</option>
        <option value="mobile">Somente celular</option>
      </select>
    </Field>
  );
  const testimonials = Array.isArray(c.testimonials) ? c.testimonials : [];
  const addTestimonial = () => {
    if (testimonials.length >= 50) return;
    u("testimonials", [
      ...testimonials,
      {
        id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: "Novo cliente",
        text: "Conte como foi a experiência de compra.",
        imageUrl: "",
        rating: 5,
      },
    ]);
  };
  const updateTestimonial = (id, key, value) =>
    u(
      "testimonials",
      testimonials.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    );
  const removeTestimonial = (id) =>
    u(
      "testimonials",
      testimonials.filter((item) => item.id !== id),
    );
  if (group === "Aparência")
    return (
      <>
        <h3>Estrutura do checkout</h3>
        <Field label="Composição no desktop">
          <select
            value={c.layout}
            onChange={(e) => u("layout", e.target.value)}
          >
            <option value="split">Formulário + resumo lateral</option>
            <option value="centered">Conteúdo centralizado</option>
          </select>
        </Field>
        <Field
          label={`Largura no desktop — ${c.contentWidth}px`}
          help="No tablet e no celular, o checkout se adapta automaticamente à tela."
        >
          <input
            type="range"
            min="650"
            max="1280"
            step="10"
            value={c.contentWidth}
            onChange={(e) => u("contentWidth", +e.target.value)}
          />
        </Field>
        <Field label="Tipografia">
          <select value={c.font} onChange={(e) => u("font", e.target.value)}>
            {[
              "Plus Jakarta Sans",
              "Poppins",
              "Montserrat",
              "DM Sans",
              "Roboto",
              "Inter",
              "Arial",
              "Georgia",
            ].map((font) => (
              <option key={font}>{font}</option>
            ))}
          </select>
        </Field>
        <Field label={`Arredondamento dos cards — ${c.radius}px`}>
          <input
            type="range"
            min="0"
            max="28"
            value={c.radius}
            onChange={(e) => u("radius", +e.target.value)}
          />
        </Field>
        <Field label={`Arredondamento dos inputs — ${c.inputRadius ?? 10}px`}>
          <input
            type="range"
            min="0"
            max="28"
            value={c.inputRadius ?? 10}
            onChange={(e) => u("inputRadius", +e.target.value)}
          />
        </Field>
        {line("Mostrar etapas", "showProgress")}
        {c.showProgress && visibility("Exibição das etapas", "progressDevice")}
        {line("Resumo do pedido", "showSummary")}
        {c.showSummary && visibility("Exibição do resumo", "summaryDevice")}
      </>
    );
  if (group === "Cores")
    return (
      <>
        <h3>Página</h3>
        <Color
          label="Fundo da página"
          value={c.pageBg}
          onChange={(v) => u("pageBg", v)}
        />
        <Color
          label="Texto da página"
          value={c.pageTextColor}
          onChange={(v) => u("pageTextColor", v)}
        />
        <h3 className="color-section-title">Cards e formulários</h3>
        <Color
          label="Fundo dos cards"
          value={c.cardBg}
          onChange={(v) => u("cardBg", v)}
        />
        <Color
          label="Texto dos cards"
          value={c.textColor}
          onChange={(v) => u("textColor", v)}
        />
        <Color
          label="Fundo dos inputs"
          value={c.inputBg}
          onChange={(v) => u("inputBg", v)}
        />
        <Color
          label="Borda dos inputs"
          value={c.inputBorderColor || c.borderColor}
          onChange={(v) => u("inputBorderColor", v)}
        />
        <Color
          label="Borda global dos cards e seções"
          value={c.borderColor}
          onChange={(v) => u("borderColor", v)}
        />
        <h3 className="color-section-title">Botões</h3>
        <Color
          label="Fundo dos botões"
          value={c.buttonBgColor || c.primary}
          onChange={(v) => u("buttonBgColor", v)}
        />
        <Color
          label="Texto dos botões"
          value={c.buttonTextColor}
          onChange={(v) => u("buttonTextColor", v)}
        />
        <h3 className="color-section-title">Destaques</h3>
        <Color
          label="Cupons, ofertas, ícones e links"
          value={c.primary}
          onChange={(v) => u("primary", v)}
        />
        <h3 className="color-section-title">Cabeçalho</h3>
        <Color
          label="Fundo do cabeçalho"
          value={c.headerBg}
          onChange={(v) => u("headerBg", v)}
        />
        <Color
          label="Texto do cabeçalho"
          value={c.headerTextColor}
          onChange={(v) => u("headerTextColor", v)}
        />
      </>
    );
  if (group === "Conteúdo das etapas")
    return (
      <>
        <h3>Aparência das etapas</h3>
        <Field label="Estilo dos indicadores">
          <select
            value={c.progressStyle || "outline"}
            onChange={(e) => u("progressStyle", e.target.value)}
          >
            <option value="outline">Somente contorno</option>
            <option value="solid">Cor sólida</option>
            <option value="icons">Ícones com contorno</option>
          </select>
        </Field>
        <Color
          label="Círculo da etapa ativa"
          value={c.progressActiveColor || c.primary}
          onChange={(v) => u("progressActiveColor", v)}
        />
        <Color
          label="Número ou ícone da etapa ativa"
          value={c.progressActiveTextColor || "#ffffff"}
          onChange={(v) => u("progressActiveTextColor", v)}
        />
        <Color
          label="Texto da etapa ativa"
          value={c.progressActiveLabelColor || c.textColor}
          onChange={(v) => u("progressActiveLabelColor", v)}
        />
        <Color
          label="Círculo das etapas inativas"
          value={c.progressInactiveColor || "#ffffff"}
          onChange={(v) => u("progressInactiveColor", v)}
        />
        <Color
          label="Número ou ícone das etapas inativas"
          value={c.progressInactiveTextColor || "#777780"}
          onChange={(v) => u("progressInactiveTextColor", v)}
        />
        <Color
          label="Texto das etapas inativas"
          value={c.progressLabelColor || "#777780"}
          onChange={(v) => u("progressLabelColor", v)}
        />
        <h3 className="color-section-title">Textos da identificação</h3>
        <Field label="Texto superior">
          <input
            value={c.eyebrow}
            maxLength="60"
            onChange={(e) => u("eyebrow", e.target.value)}
          />
        </Field>
        <Field label="Título">
          <input value={c.title} onChange={(e) => u("title", e.target.value)} />
        </Field>
        <Field label="Texto auxiliar">
          <textarea
            rows="3"
            value={c.subtitle}
            onChange={(e) => u("subtitle", e.target.value)}
          />
        </Field>
        <Field label="Título do resumo">
          <input
            value={c.summaryTitle}
            maxLength="80"
            onChange={(e) => u("summaryTitle", e.target.value)}
          />
        </Field>
        <Field label="Texto do botão">
          <input
            value={c.buttonText}
            onChange={(e) => u("buttonText", e.target.value)}
          />
        </Field>
      </>
    );
  if (group === "Modelos")
    return (
      <>
        <h3>Escolha um modelo</h3>
        <p className="panel-help">
          Cada modelo aplica uma direção visual completa sem apagar seus textos
          e imagens.
        </p>
        <div className="template-grid">
          {[
            ["minimal", "Minimal"],
            ["conversion", "Conversão"],
            ["showcase", "Vitrine"],
            ["compact", "Compacto"],
          ].map(([id, n]) => (
            <button
              key={id}
              className={c.template === id ? "selected" : ""}
              onClick={() => applyTemplate(id)}
            >
              <span className={`template-thumb ${id}`}>
                <i />
                <i />
                <i />
              </span>
              <b>{n}</b>
              {c.template === id && <Check size={14} />}
            </button>
          ))}
        </div>
      </>
    );
  if (group === "Cabeçalho")
    return (
      <>
        <h3>Marca e banner</h3>
        <Field label="Nome alternativo da marca">
          <input
            value={c.logoText}
            maxLength="24"
            onChange={(e) => u("logoText", e.target.value)}
          />
        </Field>
        <Field label="Logo da loja" help="A imagem substitui o texto da marca.">
          <ImageDropzone
            id="checkout-logo"
            value={c.logoUrl}
            onChange={(v) => u("logoUrl", v)}
            label="Envie a logo da loja"
            alt="Prévia da logo"
          />
        </Field>
        {line("Banner principal", "heroEnabled")}
        {c.heroEnabled && (
          <>
            {visibility("Exibição do banner", "heroDevice")}
            <Field label="Banner para desktop">
              <ImageDropzone
                id="checkout-hero"
                value={c.heroImageUrl}
                onChange={(v) => u("heroImageUrl", v)}
                label="Envie o banner horizontal"
                alt="Prévia do banner desktop"
              />
            </Field>
            <Field
              label="Banner para celular"
              help="Opcional. Se vazio, usaremos o banner de desktop."
            >
              <ImageDropzone
                id="checkout-hero-mobile"
                value={c.heroMobileImageUrl}
                onChange={(v) => u("heroMobileImageUrl", v)}
                label="Envie o banner vertical"
                alt="Prévia do banner mobile"
              />
            </Field>
            <Field label={`Altura do banner — ${c.heroHeight}px`}>
              <input
                type="range"
                min="120"
                max="420"
                step="10"
                value={c.heroHeight}
                onChange={(e) => u("heroHeight", +e.target.value)}
              />
            </Field>
          </>
        )}
        {line("Selo de pagamento seguro", "secureHeader")}
        {c.secureHeader && (
          <Field label="Texto de segurança">
            <input
              value={c.secureText}
              maxLength="60"
              onChange={(e) => u("secureText", e.target.value)}
            />
          </Field>
        )}
      </>
    );
  if (group === "Depoimentos")
    return (
      <>
        <div className="testimonial-editor-heading">
          <div>
            <h3>Depoimentos</h3>
            <small>{testimonials.length} de 50 adicionados</small>
          </div>
          <button
            type="button"
            onClick={addTestimonial}
            disabled={testimonials.length >= 50}
          >
            <Plus size={15} /> Adicionar
          </button>
        </div>
        <p className="panel-help">
          Adicione fotos, avaliações e relatos reais dos seus clientes.
        </p>
        {!testimonials.length && (
          <div className="testimonial-empty">
            Adicione o primeiro depoimento do checkout.
          </div>
        )}
        {testimonials.map((item, index) => (
          <section className="testimonial-editor-card" key={item.id}>
            <header>
              <b>Depoimento {index + 1}</b>
              <button
                type="button"
                onClick={() => removeTestimonial(item.id)}
                aria-label={`Excluir depoimento ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </header>
            <Field label="Foto do cliente">
              <ImageDropzone
                id={`testimonial-${item.id}`}
                value={item.imageUrl}
                onChange={(value) =>
                  updateTestimonial(item.id, "imageUrl", value)
                }
                label="Envie a foto do cliente"
                alt={`Foto de ${item.name}`}
              />
            </Field>
            <Field label="Nome do cliente">
              <input
                value={item.name}
                maxLength="80"
                onChange={(e) =>
                  updateTestimonial(item.id, "name", e.target.value)
                }
              />
            </Field>
            <Field label="Depoimento">
              <textarea
                rows="3"
                value={item.text}
                maxLength="240"
                onChange={(e) =>
                  updateTestimonial(item.id, "text", e.target.value)
                }
              />
            </Field>
            <div className="testimonial-rating">
              <span>Nota</span>
              <div>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={star <= item.rating ? "active" : ""}
                    onClick={() => updateTestimonial(item.id, "rating", star)}
                    aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      size={18}
                      fill={star <= item.rating ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              <b>{item.rating}/5</b>
            </div>
          </section>
        ))}
      </>
    );
  if (group === "Elementos")
    return (
      <>
        <CheckoutElementsPanel
          config={c}
          updateConfig={u}
          addElement={addCustomElement}
          updateElement={updateCustomElement}
          removeElement={removeCustomElement}
          uploadImage={uploadOrderBumpImage}
        />
        <h3>Ordem da faixa superior</h3>
        <p className="panel-help">
          Organize banner, cronômetro, etapas e complementos acima das duas
          colunas. O formulário e o resumo permanecem logo abaixo.
        </p>
        <div className="block-list layout-order-list">
          {checkoutLayoutEntries(c)
            .map((entry, index, entries) => (
            <div
              key={`${entry.kind}:${entry.id}`}
              className={entry.kind === "block" ? "native-entry" : "custom-entry"}
            >
              <span>
                <small>{entry.kind === "block" ? "Bloco nativo" : "Complemento"}</small>
                {entry.label}
              </span>
              {entry.kind === "custom" && (
                <select
                  className="custom-entry-region"
                  value="top"
                  onChange={(event) =>
                    updateCustomElement(entry.id, {
                      region: event.target.value,
                      slot: 0,
                    })
                  }
                  aria-label={`Posição de ${entry.label}`}
                >
                  <option value="top">Faixa superior</option>
                  <option value="main">Principal</option>
                  <option value="sidebar">Lateral</option>
                </select>
              )}
              <button
                type="button"
                onClick={() => moveLayoutEntry(`${entry.kind}:${entry.id}`, -1)}
                disabled={!index}
                aria-label={`Mover ${entry.label} para cima`}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveLayoutEntry(`${entry.kind}:${entry.id}`, 1)}
                disabled={index === entries.length - 1}
                aria-label={`Mover ${entry.label} para baixo`}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          ))}
        </div>
        <h3>Posição dos complementos</h3>
        <p className="panel-help">
          A faixa superior ocupa toda a largura. Abaixo dela, cada elemento
          pertence somente ao conteúdo principal ou ao resumo lateral.
        </p>
        {[
          ["main", "Conteúdo principal"],
          ["sidebar", "Resumo lateral"],
        ].map(([region, label]) => {
          const items = (c.customElements || []).filter(
            (item) =>
              item.enabled !== false && customElementRegion(item) === region,
          );
          return (
            <section className="element-region-order" key={region}>
              <h4>{label}</h4>
              {!items.length && <small>Nenhum complemento nesta coluna.</small>}
              <div className="block-list layout-order-list">
                {items.map((item, index) => (
                  <div className="custom-entry" key={item.id}>
                    <span>
                      <small>Elemento</small>
                      {item.title || elementCatalog[item.type]?.label}
                    </span>
                    <select
                      className="custom-entry-region"
                      value={region}
                      onChange={(event) =>
                        updateCustomElement(item.id, {
                          region: event.target.value,
                          slot: 0,
                        })
                      }
                      aria-label={`Posição de ${item.title}`}
                    >
                      <option value="top">Faixa superior</option>
                      <option value="main">Principal</option>
                      <option value="sidebar">Lateral</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => moveRegionElement(item, -1)}
                      disabled={!index}
                      aria-label={`Mover ${item.title} para cima`}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRegionElement(item, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`Mover ${item.title} para baixo`}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <h3>Elementos nativos</h3>
        {line("Cupom", "showCoupon")}
        {line("Order bump", "showBump")}
        {c.showBump && (
          <Field label="Produto da oferta complementar">
            <select
              value={c.orderBumpProductId || ""}
              onChange={(e) => u("orderBumpProductId", e.target.value)}
            >
              <option value="">Nenhum produto selecionado</option>
              {editorProducts.map((p) => (
                <option key={p.publicId} value={p.publicId}>
                  {p.checkoutTitle} — R${" "}
                  {(p.priceCents / 100).toFixed(2).replace(".", ",")}
                </option>
              ))}
            </select>
          </Field>
        )}
        {line("Resumo do pedido", "showSummary")}
        {c.showSummary && (
          <>
            <Field
              label="Banner quadrado acima do resumo"
              help="A imagem é otimizada automaticamente e mantém proporção quadrada."
            >
              <ImageDropzone
                id="checkout-summary-banner"
                value={c.summaryBannerUrl || ""}
                onChange={(v) => u("summaryBannerUrl", v)}
                label="Envie o banner do resumo"
                alt="Prévia do banner do resumo"
              />
            </Field>
            {c.summaryBannerUrl &&
              visibility("Exibição do banner do resumo", "summaryBannerDevice")}
            <Field label="Ajuste do banner">
              <select
                value={c.summaryBannerFit || "cover"}
                onChange={(e) => u("summaryBannerFit", e.target.value)}
              >
                <option value="cover">Preencher o quadrado</option>
                <option value="contain">Mostrar imagem inteira</option>
              </select>
            </Field>
          </>
        )}
        {line("Selos de confiança", "showTrust")}
        {c.showTrust && visibility("Exibição dos selos", "trustDevice")}
      </>
    );
  if (group === "Escassez")
    return (
      <>
        <h3>Cronômetro da oferta</h3>
        {line("Ativar cronômetro", "timer")}
        {c.timer && (
          <>
            {visibility("Exibição do cronômetro", "timerDevice")}
            <Field label="Texto">
              <input
                value={c.timerText}
                maxLength="80"
                onChange={(e) => u("timerText", e.target.value)}
              />
            </Field>
            <Field label="Duração em minutos">
              <input
                type="number"
                min="1"
                max="60"
                value={c.timerMinutes}
                onChange={(e) => u("timerMinutes", +e.target.value)}
              />
            </Field>
            <Field label="Formato visual">
              <select
                value={c.timerStyle}
                onChange={(e) => u("timerStyle", e.target.value)}
              >
                <option value="bar">Barra</option>
                <option value="pill">Cápsula</option>
                <option value="outline">Somente contorno</option>
              </select>
            </Field>
            <Color
              label="Fundo"
              value={c.timerBgColor}
              onChange={(v) => u("timerBgColor", v)}
            />
            <Color
              label="Texto"
              value={c.timerTextColor}
              onChange={(v) => u("timerTextColor", v)}
            />
            <Color
              label="Números"
              value={c.timerNumberColor}
              onChange={(v) => u("timerNumberColor", v)}
            />
            <Field label={`Arredondamento — ${c.timerRadius}px`}>
              <input
                type="range"
                min="0"
                max="30"
                value={c.timerRadius}
                onChange={(e) => u("timerRadius", +e.target.value)}
              />
            </Field>
          </>
        )}
      </>
    );
  if (group === "Rodapé")
    return (
      <>
        <h3>Rodapé</h3>
        <Field label="Texto legal">
          <textarea
            rows="3"
            value={c.footerText}
            onChange={(e) => u("footerText", e.target.value)}
          />
        </Field>
      </>
    );
  if (group === "Políticas")
    return (
      <>
        <h3>Políticas</h3>
        <Field label="URL de privacidade">
          <input
            value={c.privacyUrl}
            onChange={(e) => u("privacyUrl", e.target.value)}
          />
        </Field>
        <Field label="URL dos termos">
          <input
            value={c.termsUrl}
            onChange={(e) => u("termsUrl", e.target.value)}
          />
        </Field>
      </>
    );
  if (group === "Moeda e idioma")
    return (
      <>
        <h3>Moeda e idioma</h3>
        <p className="panel-help">
          O idioma traduz os textos nativos do checkout. Seus títulos
          personalizados permanecem como foram escritos.
        </p>
        <Field label="Idioma">
          <select
            value={c.language}
            onChange={(e) => u("language", e.target.value)}
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English</option>
            <option value="es">Español</option>
          </select>
        </Field>
        <Field label="Moeda de exibição">
          <select
            value={c.currency}
            onChange={(e) => u("currency", e.target.value)}
          >
            <option>BRL</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </Field>
      </>
    );
  if (group === "Efeitos dos botões")
    return (
      <>
        <h3>Efeito do botão</h3>
        <Field label="Interação">
          <select
            value={c.buttonEffect}
            onChange={(e) => u("buttonEffect", e.target.value)}
          >
            <option value="lift">Elevar com sombra</option>
            <option value="pulse">Pulso de conversão</option>
            <option value="shine">Brilho atravessando</option>
            <option value="glow">Aura luminosa</option>
            <option value="gradient">Gradiente animado</option>
            <option value="press">Pressão tátil</option>
            <option value="none">Sem efeito</option>
          </select>
        </Field>
        <p className="panel-help">
          Os efeitos respeitam a preferência de movimento reduzido do visitante.
        </p>
      </>
    );
  if (group === "Rastreamento de saída")
    return (
      <>
        <h3>Rastreamento de saída</h3>
        <Field
          label="URL após aprovação"
          help="Só redirecionar após confirmação server-side."
        >
          <input
            placeholder="https://sualoja.com/obrigado"
            value={c.successUrl}
            onChange={(e) => u("successUrl", e.target.value)}
          />
        </Field>
      </>
    );
  return (
    <>
      <h3>{group}</h3>
      <div className="panel-empty">
        <ShieldCheck size={24} />
        <b>Configuração preparada</b>
        <p>Este bloco será conectado às regras do backend na próxima etapa.</p>
      </div>
    </>
  );
}

function CustomElementPreview({ item, onRemove, readOnly = false }) {
  const style = {
    color: item.textColor,
    background: item.backgroundColor,
    borderRadius: `${item.radius ?? 12}px`,
    padding: `${item.paddingY ?? 16}px ${item.paddingX ?? 18}px`,
    fontSize: `${item.fontSize || 14}px`,
    textAlign: item.align || "left",
  };
  const iconStyle = {
    color: item.iconColor || "#7357e9",
    background: item.iconBackgroundColor || "#f0ebff",
  };
  return (
    <section
      className={`ep-custom-element type-${item.type} device-${item.device || "all"} ${item.imageUrl ? "has-media" : ""}`}
      style={style}
      draggable={!readOnly}
      onDragStart={
        readOnly
          ? undefined
          : (event) =>
              event.dataTransfer.setData(
                "application/x-solid-element-id",
                item.id,
              )
      }
    >
      {item.imageUrl ? (
        <img
          className="ep-custom-media"
          src={item.imageUrl}
          alt={item.imageAlt || ""}
          style={{
            "--element-image-height": `${item.imageHeight || 220}px`,
            objectFit: item.imageFit || "cover",
          }}
        />
      ) : (
        <div className="ep-custom-icon" style={iconStyle}>
          {["testimonial", "reviews"].includes(item.type) ? (
            <Star size={18} />
          ) : item.type === "faq" ? (
            <CircleHelp size={18} />
          ) : (
            <ShieldCheck size={18} />
          )}
        </div>
      )}
      <div>
        {["testimonial", "reviews"].includes(item.type) && (
          <span className="ep-custom-stars">
            {"★".repeat(item.rating || 5)}
          </span>
        )}
        <h3>{item.title}</h3>
        <p>{item.text}</p>
        {item.type === "progress" && (
          <span className="ep-custom-progress">
            <i style={{ width: `${item.progress || 72}%` }} />
          </span>
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Excluir ${item.title}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </section>
  );
}

function ElementDropZone({ slot, index, onAdd, onMove, free, region = "main" }) {
  const [active, setActive] = useState(false);
  const drop = (event) => {
    event.preventDefault();
    setActive(false);
    const type = event.dataTransfer.getData("application/x-solid-element-type");
    const id = event.dataTransfer.getData("application/x-solid-element-id");
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = bounds.width
      ? (event.clientX - bounds.left) / bounds.width
      : 0.5;
    const placement = free
      ? {
          horizontalAlign:
            ratio < 0.34 ? "left" : ratio > 0.66 ? "right" : "center",
          region,
        }
      : { region };
    if (type) onAdd(type, slot, index, placement);
    else if (id) onMove(id, slot, index, placement);
  };
  return (
    <div
      className={`ep-drop-zone ep-drop-zone-${region} ${active ? "active" : ""} ${free ? "free" : ""}`}
      onDragEnter={() => setActive(true)}
      onDragLeave={() => setActive(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
    >
      <Plus size={14} />
      <span>
        {free && active ? "Esquerda · Centro · Direita" : "Solte aqui"}
      </span>
    </div>
  );
}

function EditorRegionElements({
  config,
  region,
  elementId,
  onAdd,
  onMove,
  onRemove,
  readOnly,
}) {
  const elements = (
    Array.isArray(config.customElements) ? config.customElements : []
  ).filter(
    (item) =>
      item.enabled !== false &&
      customElementRegion(item) === region &&
      (!elementId || item.id === elementId),
  );
  if (readOnly && !elements.length) return null;
  return (
    <div className={`ep-region-elements ep-region-elements-${region}`}>
      {!readOnly && !elementId && (
        <ElementDropZone
          slot={0}
          index={0}
          region={region}
          free={config.elementEditMode === "free"}
          onAdd={onAdd}
          onMove={onMove}
        />
      )}
      {elements.map((item, index) => (
        <React.Fragment key={item.id}>
          <div {...customWrapProps(config, item, "ep")}>
            <CustomElementPreview item={item} onRemove={onRemove} readOnly={readOnly} />
          </div>
          {!readOnly && !elementId && (
            <ElementDropZone
              slot={0}
              index={index + 1}
              region={region}
              free={config.elementEditMode === "free"}
              onAdd={onAdd}
              onMove={onMove}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Preview({
  c,
  device,
  onAddElement,
  onMoveElement,
  onRemoveElement,
  readOnly = false,
  product,
}) {
  const copy = editorLocale[c.language] || editorLocale["pt-BR"];
  const previewMoney = new Intl.NumberFormat(c.language || "pt-BR", {
    style: "currency",
    currency: c.currency || "BRL",
  }).format(
    Number.isInteger(product?.priceCents) ? product.priceCents / 100 : 148,
  );
  const productTitle = product?.title || copy.product;
  const s = {
    "--ep": c.primary,
    "--ebg": c.pageBg,
    "--ecard": c.cardBg,
    "--eheader": c.headerBg,
    "--etext": c.textColor,
    "--epage-text": c.pageTextColor,
    "--eheader-text": c.headerTextColor,
    "--ebutton-text": c.buttonTextColor,
    "--eborder": c.borderColor,
    "--einput": c.inputBg,
    "--einput-border": c.inputBorderColor || c.borderColor,
    "--einput-radius": `${c.inputRadius ?? 10}px`,
    "--eradius": `${c.radius}px`,
    "--ehero": `${c.heroHeight}px`,
    "--econtent": `${c.contentWidth}px`,
    "--etimer-bg": c.timerBgColor,
    "--etimer-text": c.timerTextColor,
    "--etimer-number": c.timerNumberColor,
    "--etimer-radius": `${c.timerRadius}px`,
    "--eelement-radius": `${c.elementGlobalStyle?.radius ?? c.radius}px`,
    "--eelement-spacing": `${c.elementGlobalStyle?.spacing ?? 12}px`,
    "--eelement-font-scale": String(
      (c.elementGlobalStyle?.fontScale ?? 100) / 100,
    ),
    "--eprogress-active": c.progressActiveColor || c.primary,
    "--eprogress-inactive": c.progressInactiveColor || "#ffffff",
    "--eprogress-active-text": c.progressActiveTextColor || "#ffffff",
    "--eprogress-inactive-text": c.progressInactiveTextColor || "#777780",
    "--etrust-display": visibleOnDevice(c.trustDevice, device)
      ? "grid"
      : "none",
    "--esummary-display": visibleOnDevice(c.summaryDevice, device)
      ? "grid"
      : "none",
    "--esummary-banner-display": visibleOnDevice(c.summaryBannerDevice, device)
      ? "block"
      : "none",
    fontFamily: checkoutFontStack(c.font),
  };
  s["--ebutton-bg"] = c.buttonBgColor || c.primary;
  s["--eprogress-label"] = c.progressLabelColor || "#777780";
  s["--eprogress-active-label"] = c.progressActiveLabelColor || c.textColor;
  const heroUrl =
    device === "mobile" && c.heroMobileImageUrl
      ? c.heroMobileImageUrl
      : c.heroImageUrl;
  const blocks = {
    hero:
      c.heroEnabled && visibleOnDevice(c.heroDevice, device) ? (
        <div
          key="hero"
          className={`ep-hero ${heroUrl ? "has-image" : ""}`}
          style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}
        >
          {!heroUrl && (
            <>
              <ImagePlus size={24} />
              <span>Adicione o banner da sua campanha</span>
            </>
          )}
        </div>
      ) : null,
    timer:
      c.timer && visibleOnDevice(c.timerDevice, device) ? (
        <div key="timer" className="ep-body ep-body-block">
          <div className={`ep-timer timer-${c.timerStyle}`}>
            {c.timerText}:{" "}
            <strong>00 : {String(c.timerMinutes).padStart(2, "0")} : 00</strong>
          </div>
        </div>
      ) : null,
    progress:
      c.showProgress && visibleOnDevice(c.progressDevice, device) ? (
        <div key="progress" className="ep-body ep-body-block">
          <div className={`ep-steps style-${c.progressStyle || "outline"}`}>
            <span className="active">
              <i>{c.progressStyle === "icons" ? <UserRound size={16} aria-hidden="true" /> : 1}</i>
              {copy.identification}
            </span>
            <span>
              <i>{c.progressStyle === "icons" ? <MapPin size={16} aria-hidden="true" /> : 2}</i>
              {copy.delivery}
            </span>
            <span>
              <i>{c.progressStyle === "icons" ? <CreditCard size={16} aria-hidden="true" /> : 3}</i>
              {copy.payment}
            </span>
          </div>
        </div>
      ) : null,
    content: (
      <div key="content" className="ep-body ep-body-block">
        <div className="ep-content">
          <div className="ep-main">
            <div className="ep-card">
              <small className="ep-eyebrow">{c.eyebrow}</small>
              <h2>{c.title}</h2>
              <p>{c.subtitle}</p>
              <label>
                Nome completo
                <input placeholder="Ex.: Maria da Silva" />
              </label>
              <label>
                E-mail
                <input placeholder="Ex.: maria@email.com" />
              </label>
              <div className="ep-two">
                <label>
                  CPF/CNPJ
                  <input placeholder="000.000.000-00" />
                </label>
                <label>
                  Celular / WhatsApp
                  <input placeholder="(00) 00000-0000" />
                </label>
              </div>
              {c.showCoupon && (
                <button className="ep-coupon">{copy.coupon}</button>
              )}
            </div>
            {c.showBump && (
              <div className="ep-bump">
                <span />
                <div>
                  <b>{copy.offer}</b>
                  <p>{copy.offerCopy}</p>
                </div>
                <strong>
                  +{" "}
                  {new Intl.NumberFormat(
                    c.language === "es" ? "es-ES" : c.language || "pt-BR",
                    { style: "currency", currency: c.currency || "BRL" },
                  ).format(29.9)}
                </strong>
              </div>
            )}
            <button className={`ep-button effect-${c.buttonEffect}`}>
              {c.buttonText}
              <ChevronRight size={16} />
            </button>
            <small className="ep-safe">
              <ShieldCheck size={13} /> Seus dados estão protegidos.
            </small>
            {c.showTrust && (
              <div className="ep-trust">
                <div>
                  <span>
                    <i>
                      <ShieldCheck size={16} />
                    </i>
                    <b>{c.trustBenefit1}</b>
                  </span>
                  <span>
                    <i>
                      <Check size={16} />
                    </i>
                    <b>{c.trustBenefit2}</b>
                  </span>
                  <span>
                    <i>
                      <CreditCard size={16} />
                    </i>
                    <b>{c.trustBenefit3}</b>
                  </span>
                </div>
                <blockquote>
                  “{c.testimonialText}”<b>{c.testimonialName}</b>
                </blockquote>
              </div>
            )}
            <EditorRegionElements
              config={c}
              region="main"
              onAdd={onAddElement}
              onMove={onMoveElement}
              onRemove={onRemoveElement}
              readOnly={readOnly}
            />
          </div>
          {(c.showSummary ||
            (c.customElements || []).some(
              (item) =>
                item.enabled !== false &&
                customElementRegion(item) === "sidebar",
            )) && (
            <div className="ep-summary-column">
              {c.summaryBannerUrl && (
                <img
                  className="ep-summary-banner"
                  src={c.summaryBannerUrl}
                  alt="Banner do resumo do pedido"
                  style={{ objectFit: c.summaryBannerFit || "cover" }}
                />
              )}
              {c.showSummary && <details
                className={`ep-mobile-summary ${device === "mobile" ? "" : "desktop"}`}
                open={device === "mobile" ? undefined : true}
              >
                <summary>
                  <b>{c.summaryTitle}</b>
                  <strong>{previewMoney}</strong>
                  <ChevronRight size={16} aria-hidden="true" />
                </summary>
                <div className="ep-summary">
                <div>
                  <small>{copy.order}</small>
                  <b>{c.summaryTitle}</b>
                </div>
                <span>{copy.item}</span>
                <article>
                  {product?.imageUrl ? (
                    <img
                      className="ep-product-image"
                      src={product.imageUrl}
                      alt=""
                    />
                  ) : (
                    <i />
                  )}
                  <p>
                    <strong>{productTitle}</strong>
                    <small>{copy.quantity}</small>
                  </p>
                  <b>{previewMoney}</b>
                </article>
                <footer>
                  <span>{copy.total}</span>
                  <strong>{previewMoney}</strong>
                </footer>
                </div>
              </details>}
              <EditorRegionElements
                config={c}
                region="sidebar"
                onAdd={onAddElement}
                onMove={onMoveElement}
                onRemove={onRemoveElement}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>
      </div>
    ),
  };
  return (
    <div
      className={`editor-device ${device} template-${c.template} layout-${c.layout}`}
      style={s}
    >
      <div className="ep-page">
        <div className="ep-header">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt={c.logoText || "Logo da loja"} />
          ) : (
            <b>{c.logoText || "SUA MARCA"}</b>
          )}
          {c.secureHeader && (
            <span>
              <ShieldCheck size={15} />
              {c.secureText}
            </span>
          )}
        </div>
        {checkoutLayoutEntries(c).map((entry) =>
          entry.kind === "block" ? (
            <React.Fragment key={`block:${entry.id}`}>
              {blocks[entry.id]}
            </React.Fragment>
          ) : (
            <div
              className="ep-body ep-body-block ep-top-region"
              key={`custom:${entry.id}`}
            >
              <EditorRegionElements
                config={c}
                region="top"
                elementId={entry.id}
                onAdd={onAddElement}
                onMove={onMoveElement}
                onRemove={onRemoveElement}
                readOnly={readOnly}
              />
            </div>
          ),
        )}
        {blocks.content}
        <div className="ep-footer">
          {c.footerText}
          <span>
            <a href={c.privacyUrl}>Privacidade</a> ·{" "}
            <a href={c.termsUrl}>Termos</a>
          </span>
        </div>
      </div>
    </div>
  );
}

export function CheckoutDesignPreview({ config, onClose }) {
  const noop = () => {};
  return (
    <div className="checkout-preview-screen">
      <header>
        <div>
          <Eye size={18} />
          <span>
            <b>Visualização do checkout</b>
            <small>Prévia em desktop · nenhuma alteração será publicada</small>
          </span>
        </div>
        <button type="button" className="secondary" onClick={onClose}>
          <ArrowLeft size={16} /> Voltar ao editor
        </button>
      </header>
      <main>
        <Preview
          c={{ ...defaultCheckoutConfig, ...config }}
          device="desktop"
          onAddElement={noop}
          onMoveElement={noop}
          onRemoveElement={noop}
        />
      </main>
    </div>
  );
}

export function CheckoutAnalyticsPreview({ config, product }) {
  const noop = () => {};
  return (
    <div className="checkout-analytics-render" aria-hidden="true" inert="">
      <Preview
        c={{ ...defaultCheckoutConfig, ...config }}
        device="mobile"
        onAddElement={noop}
        onMoveElement={noop}
        onRemoveElement={noop}
        readOnly
        product={product}
      />
    </div>
  );
}

export default function CheckoutEditor({
  onBack,
  onPreview,
  checkout,
  onSaveDraft,
  onPublish,
  onCreateOrderBump,
  onUploadOrderBumpImage,
  products = [],
}) {
  editorProducts = products;
  uploadOrderBumpImage = onUploadOrderBumpImage || uploadOrderBumpImage;
  const load = () => {
    const draft = checkout?.draftConfig || {};
    const testimonials = Array.isArray(draft.testimonials)
      ? draft.testimonials
      : [
          {
            id: "legacy",
            name:
              draft.testimonialName || defaultCheckoutConfig.testimonialName,
            text:
              draft.testimonialText || defaultCheckoutConfig.testimonialText,
            imageUrl: "",
            rating: 5,
          },
        ];
    return {
      ...defaultCheckoutConfig,
      ...draft,
      testimonials,
      customElements: Array.isArray(draft.customElements)
        ? draft.customElements.map((item) => {
            const region = customElementRegion(item);
            return {
              ...item,
              region,
              slot:
                region === "top" && Number.isInteger(item.slot)
                  ? Math.max(0, Math.min(item.slot, 3))
                  : 0,
            };
          })
        : [],
      blockOrder: Array.isArray(draft.blockOrder)
        ? draft.blockOrder
        : defaultBlockOrder,
    };
  };
  const [c, setC] = useState(load),
    [saved, setSaved] = useState(load),
    [history, setHistory] = useState([load()]),
    [group, setGroup] = useState(null),
    [device, setDevice] = useState("mobile"),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const u = (k, v) =>
    setC((old) => {
      const next = { ...old, [k]: v };
      setHistory((h) => [...h.slice(-19), next]);
      return next;
    });
  const replaceConfig = (next) =>
    setC((old) => {
      const resolved = typeof next === "function" ? next(old) : next;
      setHistory((h) => [...h.slice(-19), resolved]);
      return resolved;
    });
  addCustomElement = (
    type,
    slot = 2,
    index = Number.POSITIVE_INFINITY,
    placement = {},
  ) => {
    if (!elementCatalog[type] || (c.customElements || []).length >= 20) return;
    const freePlacement =
      c.elementEditMode === "free" &&
      placement.horizontalAlign &&
      placement.horizontalAlign !== "center"
        ? { ...placement, widthPercent: 50 }
        : placement;
    const region = customElementRegion(placement);
    const element = {
      ...newElementDefaults(type, slot, region),
      ...freePlacement,
      region,
    };
    u(
      "customElements",
      placeCustomElement(c.customElements || [], element, slot, index),
    );
    setGroup("Elementos");
  };
  updateCustomElement = (id, patch) =>
    u(
      "customElements",
      (c.customElements || []).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  removeCustomElement = (id) =>
    u(
      "customElements",
      (c.customElements || []).filter((item) => item.id !== id),
    );
  const moveCustomElement = (id, slot, index, placement = {}) => {
    const item = (c.customElements || []).find((current) => current.id === id);
    const freePlacement =
      c.elementEditMode === "free" &&
      item &&
      (item.widthPercent || 100) === 100 &&
      placement.horizontalAlign &&
      placement.horizontalAlign !== "center"
        ? { ...placement, widthPercent: 50 }
        : placement;
    u(
      "customElements",
      reorderCustomElements(
        c.customElements || [],
        id,
        slot,
        index,
        freePlacement,
      ),
    );
  };
  const undo = () =>
    setHistory((h) => {
      if (h.length < 2) return h;
      const n = h.slice(0, -1);
      setC(n.at(-1));
      return n;
    });
  const msg = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 1900);
  };
  createOrderBump = async () => {
    const title = (c.orderBumpDraftTitle || "").trim();
    const price = Math.round(
      Number(String(c.orderBumpDraftPrice || "").replace(",", ".")) * 100,
    );
    if (!title || !Number.isInteger(price) || price < 1) {
      msg("Informe nome e preço válido para o order bump");
      return;
    }
    setBusy(true);
    try {
      const product = await onCreateOrderBump({
        title,
        priceCents: price,
        description: (c.orderBumpDraftDescription || "").trim(),
        imageUrl: (c.orderBumpDraftImageUrl || "").trim(),
      });
      u("orderBumpProductId", product.publicId);
      u("orderBumpDraftTitle", "");
      u("orderBumpDraftPrice", "");
      u("orderBumpDraftDescription", "");
      u("orderBumpDraftImageUrl", "");
      msg("Produto criado e selecionado no order bump");
    } catch (error) {
      msg(error.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await onSaveDraft(c);
      setSaved(c);
      msg("Rascunho salvo no servidor");
    } catch (error) {
      msg(error.message);
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    setBusy(true);
    try {
      if (dirty) {
        await onSaveDraft(c);
        setSaved(c);
      }
      await onPublish();
      msg("Checkout publicado com sucesso");
    } catch (error) {
      msg(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="checkout-editor">
      <header className="editor-top">
        <button className="icon-btn" onClick={onBack}>
          <ArrowLeft size={19} />
        </button>
        <div className="editor-search">
          <b>Checkout principal</b>
          <span>{dirty ? "Alterações não salvas" : "Salvo"}</span>
        </div>
        <div className="device-picker">
          {[
            ["mobile", Smartphone],
            ["tablet", Tablet],
            ["desktop", Laptop],
          ].map(([id, I]) => (
            <button
              key={id}
              className={device === id ? "active" : ""}
              onClick={() => setDevice(id)}
            >
              <I size={17} />
            </button>
          ))}
        </div>
        <div className="editor-actions">
          <button
            className="editor-action"
            onClick={undo}
            disabled={history.length < 2}
          >
            <Undo2 size={16} /> Desfazer
          </button>
          <button className="editor-action" onClick={() => onPreview(c)}>
            <Eye size={16} /> Visualizar
          </button>
          <button className="editor-action" onClick={save} disabled={!dirty}>
            <Save size={16} /> Salvar rascunho
          </button>
          <button className="publish-btn" onClick={publish}>
            <Send size={16} /> Publicar
          </button>
        </div>
      </header>
      <div className="editor-layout">
        <aside className="editor-panel">
          {group && (
            <button className="panel-back" onClick={() => setGroup(null)}>
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          {!group ? (
            <nav>
              {groups.map(([n, I]) => (
                <button key={n} onClick={() => setGroup(n)}>
                  <I size={17} />
                  <span>{n}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </nav>
          ) : (
            <div className="panel-settings">
              <Settings
                group={group}
                c={c}
                u={u}
                replaceConfig={replaceConfig}
              />
            </div>
          )}
        </aside>
        <main className="editor-canvas">
          <Preview
            c={c}
            device={device}
            onAddElement={addCustomElement}
            onMoveElement={moveCustomElement}
            onRemoveElement={removeCustomElement}
          />
        </main>
      </div>
      {toast && (
        <div className="editor-toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
