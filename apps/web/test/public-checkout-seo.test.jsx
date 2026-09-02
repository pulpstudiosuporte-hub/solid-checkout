import { describe, expect, it } from "vitest";
import { checkoutSeoMetadata } from "../src/PublicCheckout";

describe("checkoutSeoMetadata", () => {
  it("usa a identidade configurada pelo lojista", () => {
    const metadata = checkoutSeoMetadata(
      {
        primary: "#7357e9",
        seoTitle: "Curso SOLID | Minha loja",
        seoDescription: "Finalize sua inscricao com seguranca.",
        faviconUrl: "https://cdn.example.com/favicon.webp",
      },
      { name: "Checkout principal" },
    );

    expect(metadata).toEqual({
      title: "Curso SOLID | Minha loja",
      description: "Finalize sua inscricao com seguranca.",
      favicon: "https://cdn.example.com/favicon.webp",
    });
  });

  it("nao exibe a marca SOLID quando o lojista nao configurou SEO", () => {
    const metadata = checkoutSeoMetadata(
      { primary: "#7357e9", seoTitle: "", seoDescription: "", faviconUrl: "" },
      { name: "Oferta de verao" },
    );

    expect(metadata.title).toBe("Oferta de verao");
    expect(metadata.description).toBe("Finalize sua compra com segurança.");
    expect(metadata.favicon).toMatch(/^data:image\/svg\+xml,/);
  });
});
