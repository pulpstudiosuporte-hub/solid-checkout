import { ShieldCheck } from "lucide-react";

export const checkoutFooterPaymentOptions = [
  { id: "amex", label: "AMEX" },
  { id: "visa", label: "VISA" },
  { id: "diners", label: "Diners Club" },
  { id: "mastercard", label: "Mastercard" },
  { id: "discover", label: "Discover" },
  { id: "aura", label: "Aura" },
  { id: "elo", label: "Elo" },
  { id: "boleto", label: "Boleto" },
  { id: "hipercard", label: "Hipercard" },
  { id: "pix", label: "Pix" },
];

export const defaultCheckoutFooterMethods = checkoutFooterPaymentOptions.map(
  ({ id }) => id,
);

function PaymentMark({ method }) {
  const option = checkoutFooterPaymentOptions.find(({ id }) => id === method);
  if (!option) return null;
  return (
    <span
      className={`checkout-footer-payment payment-${method}`}
      role="img"
      aria-label={option.label}
      title={option.label}
    >
      {method === "mastercard" && <i aria-hidden="true" />}
      {method === "boleto" ? "|||||" : option.label}
    </span>
  );
}

export default function CheckoutFooter({ config, preview = false }) {
  if (config.footerEnabled === false) return null;
  const methods = Array.isArray(config.footerPaymentMethods)
    ? config.footerPaymentMethods
    : defaultCheckoutFooterMethods;
  const alignment = ["left", "center"].includes(config.footerAlignment)
    ? config.footerAlignment
    : "center";
  const layout = ["centered", "split"].includes(config.footerLayout)
    ? config.footerLayout
    : "centered";
  const linkProps = preview
    ? { onClick: (event) => event.preventDefault() }
    : {};

  return (
    <footer
      className={`checkout-rich-footer footer-align-${alignment} footer-layout-${layout}`}
      style={{
        "--checkout-footer-bg": config.footerBackgroundColor || "#000000",
        "--checkout-footer-text": config.footerTextColor || "#ffffff",
        "--checkout-footer-padding": `${config.footerPadding ?? 48}px`,
      }}
    >
      <div className="checkout-footer-inner">
        {config.footerPaymentMethodsEnabled !== false && methods.length > 0 && (
          <section className="checkout-footer-payments" aria-label="Formas de pagamento aceitas">
            <strong>{config.footerPaymentTitle || "Formas de pagamento"}</strong>
            <div>
              {methods.map((method) => (
                <PaymentMark method={method} key={method} />
              ))}
            </div>
          </section>
        )}

        <section className="checkout-footer-business" aria-label="Dados da empresa">
          {config.footerCompanyName && <strong>{config.footerCompanyName}</strong>}
          {config.footerCompanyAddress && <span>{config.footerCompanyAddress}</span>}
          {config.footerText && <span>{config.footerText}</span>}
          {config.footerCompanyDocument && <span>{config.footerCompanyDocument}</span>}
        </section>

        {config.footerSecureBadgeEnabled !== false && (
          <div className="checkout-footer-security">
            <ShieldCheck size={20} aria-hidden="true" />
            <strong>{config.footerSecureText || "Pagamento 100% seguro"}</strong>
          </div>
        )}

        {config.footerShowPolicies !== false &&
          (config.privacyUrl || config.termsUrl) && (
            <nav className="checkout-footer-policies" aria-label="Políticas da loja">
              {config.privacyUrl && (
                <a href={config.privacyUrl} {...linkProps}>Privacidade</a>
              )}
              {config.termsUrl && (
                <a href={config.termsUrl} {...linkProps}>Termos de uso</a>
              )}
            </nav>
          )}
      </div>
    </footer>
  );
}
