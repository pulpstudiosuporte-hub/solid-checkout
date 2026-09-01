import { useEffect, useMemo, useState } from "react";
import { Check, Flame, ShoppingCart, UserRound, X } from "lucide-react";

const icons = {
  check: Check,
  cart: ShoppingCart,
  user: UserRound,
  flame: Flame,
};

const clamp = (value, minimum, maximum, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
};

export function parseSocialProofPreview(value) {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const [name = "Cliente", time = "agora", product = "este item", city = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { name, time, product, city };
    });
}

const renderTemplate = (template, item) =>
  String(template || "")
    .replaceAll("{nome}", item.name || "Cliente")
    .replaceAll("{name}", item.name || "Cliente")
    .replaceAll("{produto}", item.product || "este item")
    .replaceAll("{product}", item.product || "este item")
    .replaceAll("{cidade}", item.city || "")
    .replaceAll("{city}", item.city || "")
    .replaceAll("{tempo}", item.time || "agora")
    .replaceAll("{time}", item.time || "agora");

export default function SocialProofToast({ config, messages = [], preview = false }) {
  const enabled = Boolean(config?.socialProofEnabled);
  const items = useMemo(
    () =>
      (preview ? parseSocialProofPreview(config?.socialProofPreviewMessages) : messages)
        .filter(Boolean)
        .slice(0, 20),
    [config?.socialProofPreviewMessages, messages, preview],
  );
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const visibleSeconds = clamp(config?.socialProofVisibleSeconds, 3, 15, 5);
  const intervalSeconds = clamp(config?.socialProofIntervalSeconds, 4, 60, 9);

  useEffect(() => {
    if (!enabled || items.length === 0) return undefined;
    setIndex(0);
    setDismissed(false);
    setVisible(true);
    let hideTimer = window.setTimeout(() => setVisible(false), visibleSeconds * 1000);
    const cycleTimer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
      setVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), visibleSeconds * 1000);
    }, Math.max(intervalSeconds, visibleSeconds + 1) * 1000);
    return () => {
      window.clearInterval(cycleTimer);
      window.clearTimeout(hideTimer);
    };
  }, [enabled, intervalSeconds, items.length, visibleSeconds]);

  if (!enabled || items.length === 0 || dismissed) return null;
  const item = items[index % items.length];
  const headlineTemplate = config?.socialProofHeadline || "{nome} acabou de comprar {produto}.";
  const cityAlreadyShown = /\{(?:cidade|city)\}/.test(headlineTemplate);
  const Icon = icons[config?.socialProofIcon] || Check;
  const shadow = config?.socialProofShadow === "none"
    ? "none"
    : config?.socialProofShadow === "strong"
      ? "0 20px 50px rgba(15, 23, 42, .24)"
      : "0 14px 35px rgba(15, 23, 42, .15)";
  const position = config?.socialProofPosition || "bottom-left";

  return (
    <aside
      className={`social-proof-toast position-${position} ${visible ? "is-visible" : "is-hidden"} ${preview ? "is-preview" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        "--social-proof-bg": config?.socialProofBackgroundColor || "#ffffff",
        "--social-proof-text": config?.socialProofTextColor || "#111827",
        "--social-proof-secondary": config?.socialProofSecondaryColor || "#6b7280",
        "--social-proof-border": config?.socialProofBorderColor || "#e5e7eb",
        "--social-proof-icon-bg": config?.socialProofIconBackgroundColor || "#10b981",
        "--social-proof-icon": config?.socialProofIconColor || "#ffffff",
        "--social-proof-radius": `${clamp(config?.socialProofRadius, 0, 32, 16)}px`,
        "--social-proof-shadow": shadow,
      }}
    >
      <span className="social-proof-toast-icon" aria-hidden="true"><Icon size={18} /></span>
      <span className="social-proof-toast-copy">
        <strong>{renderTemplate(headlineTemplate, item)}</strong>
        <small>{renderTemplate(config?.socialProofSecondary || "há {tempo}", item)}</small>
        {item.city && !cityAlreadyShown && <small className="social-proof-toast-city">{item.city}</small>}
      </span>
      {config?.socialProofCloseButton !== false && (
        <button type="button" onClick={() => setDismissed(true)} aria-label="Fechar notificação de compra">
          <X size={15} />
        </button>
      )}
    </aside>
  );
}
