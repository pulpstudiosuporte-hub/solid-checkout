import { useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronLeft,
  CircleHelp,
  Clock3,
  GalleryHorizontal,
  Image,
  List,
  LoaderCircle,
  Megaphone,
  Pencil,
  PlaySquare,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trash2,
  Type,
  Upload,
} from "lucide-react";

export const elementCatalog = {
  announcement: {
    label: "Barra de avisos",
    category: "Mais utilizados",
    icon: Megaphone,
    title: "Oferta especial",
    text: "Aproveite esta condição exclusiva por tempo limitado.",
  },
  banner: {
    label: "Banner",
    category: "Mais utilizados",
    icon: Image,
    title: "Destaque da campanha",
    text: "Adicione uma imagem e uma mensagem para sua oferta.",
  },
  testimonial: {
    label: "Depoimento",
    category: "Mais utilizados",
    icon: Star,
    title: "Cliente verificado",
    text: "Compra simples, rápida e segura.",
  },
  timer: {
    label: "Cronômetro",
    category: "Mais utilizados",
    icon: Clock3,
    title: "Oferta termina em",
    text: "Garanta sua condição antes que o tempo acabe.",
  },
  video: {
    label: "Vídeo",
    category: "Elementos básicos",
    icon: PlaySquare,
    title: "Veja como funciona",
    text: "Apresente seu produto em vídeo.",
  },
  gallery: {
    label: "Galeria",
    category: "Elementos básicos",
    icon: GalleryHorizontal,
    title: "Galeria do produto",
    text: "Conheça os detalhes do produto.",
  },
  text: {
    label: "Texto",
    category: "Elementos básicos",
    icon: Type,
    title: "Conteúdo em destaque",
    text: "Adicione uma descrição para orientar seu cliente.",
  },
  reviews: {
    label: "Avaliações",
    category: "Elementos de confiança",
    icon: Star,
    title: "Avaliações dos clientes",
    text: "Quem comprou recomenda.",
  },
  guarantee: {
    label: "Garantia",
    category: "Elementos de confiança",
    icon: ShieldCheck,
    title: "Garantia de satisfação",
    text: "Você pode solicitar o reembolso dentro do prazo da garantia.",
  },
  faq: {
    label: "FAQ",
    category: "Elementos de confiança",
    icon: CircleHelp,
    title: "Perguntas frequentes",
    text: "Como recebo meu pedido? A confirmação é enviada após o pagamento.",
  },
  list: {
    label: "Lista",
    category: "Elementos de escassez",
    icon: List,
    title: "O que você vai receber",
    text: "Acesso imediato\nSuporte especializado\nGarantia de satisfação",
  },
  progress: {
    label: "Progresso",
    category: "Elementos de escassez",
    icon: BarChart3,
    title: "Últimas unidades",
    text: "Esta oferta está quase esgotada.",
  },
  sales: {
    label: "Vendas",
    category: "Elementos de escassez",
    icon: ShoppingBag,
    title: "Alta procura",
    text: "Outras pessoas estão comprando esta oferta agora.",
  },
  seal: {
    label: "Selo de segurança",
    category: "Elementos de confiança",
    icon: ShieldCheck,
    title: "Compra 100% segura",
    text: "Ambiente protegido e confirmação automática.",
  },
};

const defaults = {
  enabled: true,
  slot: 2,
  rating: 5,
  display: "fixed",
  textColor: "#17171a",
  backgroundColor: "#ffffff",
  iconColor: "#7357e9",
  iconBackgroundColor: "#f0ebff",
  fontSize: 14,
  radius: 12,
  paddingY: 16,
  paddingX: 18,
  device: "all",
  align: "left",
  widthPercent: 100,
  horizontalAlign: "center",
  imageUrl: "",
  imageAlt: "",
  imageFit: "cover",
  imageHeight: 220,
  mediaUrl: "",
  linkUrl: "",
  durationMinutes: 10,
  progress: 72,
  titleColor: "#17171a",
  bodyColor: "#5f5b66",
  titleFontSize: 26,
  bodyFontSize: 15,
  titleWeight: 700,
  lineHeight: 160,
};
const categories = [
  "Mais utilizados",
  "Elementos básicos",
  "Elementos de confiança",
  "Elementos de escassez",
];
const Field = ({ label, children, help }) => (
  <label className="element-config-field">
    <span>{label}</span>
    {children}
    {help && <small>{help}</small>}
  </label>
);
const Toggle = ({ on, change, label }) => (
  <button
    type="button"
    className={`editor-toggle ${on ? "on" : ""}`}
    onClick={() => change(!on)}
    aria-label={`${on ? "Desativar" : "Ativar"} ${label}`}
  >
    <span />
  </button>
);

function ElementImageDropzone({ id, value, onChange, uploadImage }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const send = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 10 MB.");
      return;
    }
    if (!uploadImage) {
      setError("O envio de imagens não está disponível neste editor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await uploadImage(file);
      if (!result?.imageUrl)
        throw new Error("A imagem não retornou um endereço válido.");
      onChange(result.imageUrl);
    } catch (caught) {
      setError(caught?.message || "Não foi possível otimizar a imagem.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`element-image-dropzone ${busy ? "busy" : ""} ${dragging ? "dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void send(event.dataTransfer.files?.[0]);
      }}
      aria-busy={busy}
    >
      <input
        id={id}
        className="sr-only"
        type="file"
        disabled={busy}
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void send(event.target.files?.[0])}
      />
      {value ? (
        <img src={value} alt="Prévia do elemento" />
      ) : (
        <Upload size={22} aria-hidden="true" />
      )}
      <div>
        <b>
          {busy ? (
            <>
              <LoaderCircle className="spin" size={15} /> Otimizando...
            </>
          ) : (
            "Arraste a imagem aqui"
          )}
        </b>
        <small>Conversão automática para WebP, até 1600 px.</small>
        <span>
          <label htmlFor={id}>Selecionar imagem</label>
          {value && (
            <button type="button" onClick={() => onChange("")}>
              Remover
            </button>
          )}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default function CheckoutElementsPanel({
  config,
  updateConfig,
  addElement,
  updateElement,
  removeElement,
  uploadImage,
}) {
  const [mode, setMode] = useState(config.elementEditMode || "guided");
  const [editing, setEditing] = useState(null);
  const [original, setOriginal] = useState(null);
  const elements = useMemo(
    () => Array.isArray(config.customElements) ? config.customElements : [],
    [config.customElements],
  );
  const byType = useMemo(
    () => new Map(elements.map((item) => [item.type, item])),
    [elements],
  );
  const setModeValue = (value) => {
    setMode(value);
    updateConfig("elementEditMode", value);
  };
  const openEditor = (type, item) => {
    setOriginal(item ? { ...item } : null);
    setEditing(type);
  };
  const activate = (type, on) => {
    const current = byType.get(type);
    if (on && !current) {
      addElement(type, 0, Number.POSITIVE_INFINITY, { region: "main" });
      setOriginal(null);
      setTimeout(() => setEditing(type), 0);
    } else if (current) updateElement(current.id, { enabled: on });
  };
  const current = editing ? byType.get(editing) : null;
  const closeEditor = () => {
    setEditing(null);
    setOriginal(null);
  };
  const cancelEditor = () => {
    if (original && current) updateElement(current.id, original);
    closeEditor();
  };
  if (current) {
    const meta = elementCatalog[current.type] || elementCatalog.seal;
    const Icon = meta.icon;
    const change = (key, value) => updateElement(current.id, { [key]: value });
    return (
      <div className="element-config-sheet">
        <header>
          <button type="button" onClick={cancelEditor}>
            <ChevronLeft size={17} />
          </button>
          <span>
            <Icon size={18} />
          </span>
          <div>
            <b>{meta.label}</b>
            <small>{current.type} / elemento do checkout</small>
          </div>
          <button type="button" onClick={cancelEditor} aria-label="Fechar">
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="element-config-scroll">
          <div className="setting-line">
            <div>
              Ativar<small>Ocultar ou exibir este elemento no checkout.</small>
            </div>
            <Toggle
              on={current.enabled !== false}
              change={(value) => change("enabled", value)}
              label={meta.label}
            />
          </div>
          <Field
            label="Posição no checkout"
            help="Escolha a faixa superior de largura total ou apenas uma das duas colunas."
          >
            <select
              value={
                current.region === "sidebar"
                  ? "sidebar"
                  : current.region === "top"
                    ? "top"
                    : "main"
              }
              onChange={(event) =>
                updateElement(current.id, {
                  region: event.target.value,
                  slot: 0,
                })
              }
            >
              <option value="top">Acima das duas colunas</option>
              <option value="main">Conteúdo principal</option>
              <option value="sidebar">Abaixo do resumo lateral</option>
            </select>
          </Field>
          <Field label="Título">
            <input
              value={current.title || ""}
              maxLength="100"
              onChange={(event) => change("title", event.target.value)}
            />
          </Field>
          <Field label="Mensagem">
            <textarea
              rows="5"
              value={current.text || ""}
              maxLength="500"
              onChange={(event) => change("text", event.target.value)}
            />
          </Field>
          {current.type === "text" && (
            <>
              <h3>Tipografia do texto</h3>
              <div className="element-color-grid">
                <Field label="Cor do título">
                  <input
                    type="color"
                    value={current.titleColor || current.textColor || "#17171a"}
                    onChange={(event) => change("titleColor", event.target.value)}
                  />
                </Field>
                <Field label="Cor da descrição">
                  <input
                    type="color"
                    value={current.bodyColor || current.textColor || "#5f5b66"}
                    onChange={(event) => change("bodyColor", event.target.value)}
                  />
                </Field>
              </div>
              <div className="element-number-grid">
                <Field label="Tamanho do título (px)">
                  <input
                    type="number"
                    min="12"
                    max="64"
                    value={current.titleFontSize || 26}
                    onChange={(event) => change("titleFontSize", Number(event.target.value))}
                  />
                </Field>
                <Field label="Tamanho da descrição (px)">
                  <input
                    type="number"
                    min="10"
                    max="32"
                    value={current.bodyFontSize || 15}
                    onChange={(event) => change("bodyFontSize", Number(event.target.value))}
                  />
                </Field>
                <Field label="Peso do título">
                  <select
                    value={current.titleWeight || 700}
                    onChange={(event) => change("titleWeight", Number(event.target.value))}
                  >
                    <option value="400">Regular</option>
                    <option value="500">Médio</option>
                    <option value="600">Seminegrito</option>
                    <option value="700">Negrito</option>
                    <option value="800">Extra negrito</option>
                    <option value="900">Black</option>
                  </select>
                </Field>
                <Field label="Altura da linha (%)">
                  <input
                    type="number"
                    min="100"
                    max="220"
                    step="5"
                    value={current.lineHeight || 160}
                    onChange={(event) => change("lineHeight", Number(event.target.value))}
                  />
                </Field>
              </div>
            </>
          )}
          {current.type === "announcement" && (
            <Field label="Tipo de exibição">
              <select
                value={current.display || "fixed"}
                onChange={(event) => change("display", event.target.value)}
              >
                <option value="fixed">Fixo</option>
                <option value="carousel">Carrossel</option>
              </select>
            </Field>
          )}
          {current.type !== "text" && (
            <div className="element-media-settings">
              <span className="element-media-label">
                {["testimonial", "reviews"].includes(current.type)
                  ? "Foto do cliente"
                  : "Imagem do elemento"}
              </span>
              {["testimonial", "reviews"].includes(current.type) && (
                <small className="element-media-help">
                  Use uma foto quadrada e nítida. Ela será otimizada e exibida
                  como um avatar circular.
                </small>
              )}
              <ElementImageDropzone
                id={`element-image-${current.id}`}
                value={current.imageUrl || ""}
                onChange={(value) => change("imageUrl", value)}
                uploadImage={uploadImage}
              />
              <Field label="Ou use uma URL HTTPS">
                <input
                  type="url"
                  value={current.imageUrl || ""}
                  onChange={(event) => change("imageUrl", event.target.value)}
                />
              </Field>
              <Field label="Texto alternativo da imagem">
                <input
                  value={current.imageAlt || ""}
                  maxLength="160"
                  onChange={(event) => change("imageAlt", event.target.value)}
                  placeholder="Descreva a imagem para acessibilidade"
                />
              </Field>
              <div className="element-number-grid">
                <Field label="Ajuste da imagem">
                  <select
                    value={current.imageFit || "cover"}
                    onChange={(event) => change("imageFit", event.target.value)}
                  >
                    <option value="cover">Preencher área</option>
                    <option value="contain">Mostrar imagem inteira</option>
                  </select>
                </Field>
                <Field label="Altura (px)">
                  <input
                    type="number"
                    min="48"
                    max="520"
                    value={current.imageHeight || 220}
                    onChange={(event) =>
                      change("imageHeight", Number(event.target.value))
                    }
                  />
                </Field>
              </div>
            </div>
          )}
          {current.type === "video" && (
            <Field
              label="URL do vídeo"
              help="Aceita arquivo MP4/WebM em HTTPS."
            >
              <input
                type="url"
                value={current.mediaUrl || ""}
                onChange={(event) => change("mediaUrl", event.target.value)}
              />
            </Field>
          )}
          {current.type === "timer" && (
            <Field label="Duração em minutos">
              <input
                type="number"
                min="1"
                max="120"
                value={current.durationMinutes || 10}
                onChange={(event) =>
                  change("durationMinutes", Number(event.target.value))
                }
              />
            </Field>
          )}
          {["testimonial", "reviews"].includes(current.type) && (
            <Field label="Avaliação">
              <select
                value={current.rating || 5}
                onChange={(event) =>
                  change("rating", Number(event.target.value))
                }
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option value={value} key={value}>
                    {value} estrelas
                  </option>
                ))}
              </select>
            </Field>
          )}
          {current.type === "progress" && (
            <Field label={`Progresso — ${current.progress || 72}%`}>
              <input
                type="range"
                min="1"
                max="100"
                value={current.progress || 72}
                onChange={(event) =>
                  change("progress", Number(event.target.value))
                }
              />
            </Field>
          )}
          {config.elementEditMode === "free" && (
            <>
              <h3>Posicionamento livre</h3>
              <div className="element-number-grid">
                <Field label="Largura do elemento">
                  <select
                    value={current.widthPercent || 100}
                    onChange={(event) =>
                      change("widthPercent", Number(event.target.value))
                    }
                  >
                    <option value="25">25%</option>
                    <option value="33">33%</option>
                    <option value="50">50%</option>
                    <option value="66">66%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                  </select>
                </Field>
                <Field label="Posição horizontal">
                  <select
                    value={current.horizontalAlign || "center"}
                    onChange={(event) =>
                      change("horizontalAlign", event.target.value)
                    }
                  >
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </Field>
              </div>
              <p className="element-position-help">
                Você também pode arrastar o elemento para o lado desejado na
                prévia.
              </p>
            </>
          )}
          <h3>Estilo do elemento</h3>
          <div className="element-color-grid">
            {current.type !== "text" && (
              <Field label="Texto">
                <input
                  type="color"
                  value={current.textColor || "#17171a"}
                  onChange={(event) => change("textColor", event.target.value)}
                />
              </Field>
            )}
            <Field label="Fundo">
              <input
                type="color"
                value={current.backgroundColor || "#ffffff"}
                onChange={(event) =>
                  change("backgroundColor", event.target.value)
                }
              />
            </Field>
            {current.type !== "text" && (
              <>
                <Field label="Ícone">
                  <input
                    type="color"
                    value={current.iconColor || "#7357e9"}
                    onChange={(event) => change("iconColor", event.target.value)}
                  />
                </Field>
                <Field label="Fundo do ícone">
                  <input
                    type="color"
                    value={current.iconBackgroundColor || "#f0ebff"}
                    onChange={(event) => change("iconBackgroundColor", event.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
          <div className="element-number-grid">
            {current.type !== "text" && (
              <Field label="Fonte (px)">
                <input
                  type="number"
                  min="10"
                  max="32"
                  value={current.fontSize || 14}
                  onChange={(event) => change("fontSize", Number(event.target.value))}
                />
              </Field>
            )}
            <Field label="Raio (px)">
              <input
                type="number"
                min="0"
                max="40"
                value={current.radius ?? 12}
                onChange={(event) =>
                  change("radius", Number(event.target.value))
                }
              />
            </Field>
            <Field label="Padding vertical">
              <input
                type="number"
                min="0"
                max="64"
                value={current.paddingY ?? 16}
                onChange={(event) =>
                  change("paddingY", Number(event.target.value))
                }
              />
            </Field>
            <Field label="Padding horizontal">
              <input
                type="number"
                min="0"
                max="64"
                value={current.paddingX ?? 18}
                onChange={(event) =>
                  change("paddingX", Number(event.target.value))
                }
              />
            </Field>
          </div>
          <Field
            label="Alinhamento do conteúdo"
            help="Move imagem ou ícone junto com o título e a mensagem."
          >
            <select
              value={current.align || "left"}
              onChange={(event) => change("align", event.target.value)}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </Field>
          <Field label="Exibição por dispositivo">
            <select
              value={current.device || "all"}
              onChange={(event) => change("device", event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="desktop">Somente desktop</option>
              <option value="mobile">Somente celular</option>
            </select>
          </Field>
        </div>
        <footer>
          <button
            type="button"
            className="danger"
            onClick={() => {
              removeElement(current.id);
              closeEditor();
            }}
          >
            <Trash2 size={14} /> Remover
          </button>
          <button type="button" onClick={cancelEditor}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={closeEditor}>
            <Check size={14} /> Salvar
          </button>
        </footer>
      </div>
    );
  }
  const global = config.elementGlobalStyle || {
    radius: 12,
    spacing: 12,
    fontScale: 100,
  };
  const changeGlobal = (key, value) => {
    updateConfig("elementGlobalStyle", { ...global, [key]: value });
    if (key === "radius") {
      updateConfig("radius", value);
      updateConfig("timerRadius", value);
      updateConfig(
        "customElements",
        elements.map((item) => ({ ...item, radius: value })),
      );
    }
  };
  return (
    <>
      <h3>Modo de edição</h3>
      <div className="element-mode">
        <button
          type="button"
          className={mode === "guided" ? "active" : ""}
          onClick={() => setModeValue("guided")}
        >
          <b>Guiado</b>
          <small>Recomendado</small>
        </button>
        <button
          type="button"
          className={mode === "free" ? "active" : ""}
          onClick={() => setModeValue("free")}
        >
          <b>Livre</b>
          <small>Avançado</small>
        </button>
      </div>
      {categories.map((category) => (
        <section className="element-category" key={category}>
          <h4>{category}</h4>
          {Object.entries(elementCatalog)
            .filter(([, item]) => item.category === category)
            .map(([type, item]) => {
              const Icon = item.icon;
              const active = byType.get(type);
              return (
                <div
                  className={`element-catalog-row ${active?.enabled !== false && active ? "active" : ""}`}
                  key={type}
                  draggable={mode === "free"}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-solid-element-type",
                      type,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <span>
                    <Icon size={17} />
                  </span>
                  <button
                    type="button"
                    className="element-row-copy"
                    onClick={() =>
                      active ? openEditor(type, active) : activate(type, true)
                    }
                  >
                    <b>{item.label}</b>
                    {["text", "testimonial", "reviews", "faq", "list"].includes(
                      type,
                    ) && (
                      <small>
                        Gerencia conteúdo e estilo dentro do mesmo bloco.
                      </small>
                    )}
                  </button>
                  {active && (
                    <button
                      type="button"
                      className="element-edit"
                      onClick={() => openEditor(type, active)}
                      aria-label={`Editar ${item.label}`}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <Toggle
                    on={Boolean(active && active.enabled !== false)}
                    change={(value) => activate(type, value)}
                    label={item.label}
                  />
                </div>
              );
            })}
        </section>
      ))}
      <section className="element-global">
          <h3>Estilos globais</h3>
          <p className="panel-help">
            Controle o arredondamento e a distância entre todas as seções do checkout.
          </p>
          <Field label={`Arredondamento global — ${global.radius}px`}>
            <input
              type="range"
              min="0"
              max="32"
              value={global.radius}
              onChange={(event) =>
                changeGlobal("radius", Number(event.target.value))
              }
            />
          </Field>
          <Field label={`Espaçamento global — ${global.spacing}px`}>
            <input
              type="range"
              min="4"
              max="40"
              value={global.spacing}
              onChange={(event) =>
                changeGlobal("spacing", Number(event.target.value))
              }
            />
          </Field>
          <Field label={`Escala da fonte — ${global.fontScale}%`}>
            <input
              type="range"
              min="80"
              max="130"
              value={global.fontScale}
              onChange={(event) =>
                changeGlobal("fontScale", Number(event.target.value))
              }
            />
          </Field>
      </section>
    </>
  );
}

export const newElementDefaults = (type, slot = 2, region = "main") => ({
  ...defaults,
  id: `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type,
  slot,
  region,
  title: elementCatalog[type]?.title || "Novo elemento",
  text: elementCatalog[type]?.text || "Adicione seu conteúdo.",
});
