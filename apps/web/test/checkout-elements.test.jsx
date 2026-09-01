import { describe, expect, it } from "vitest";
import {
  checkoutLayoutEntries,
  reorderCheckoutLayout,
  reorderCustomElements,
} from "../src/CheckoutEditor.jsx";
import { checkoutLayoutPositionMap } from "../src/checkout-layout.js";
import { elementCatalog } from "../src/CheckoutElementsPanel.jsx";
import { checkoutElementIconTypes } from "../src/CheckoutElementIcon.jsx";

const element = (id, slot) => ({ id, slot, enabled: true });

describe("ordenação dos elementos do checkout", () => {
  it("mantém um ícone próprio para cada elemento disponível", () => {
    expect([...checkoutElementIconTypes].sort()).toEqual(
      Object.keys(elementCatalog).sort(),
    );
  });

  it("reposiciona elementos dentro do mesmo intervalo", () => {
    const result = reorderCustomElements(
      [element("a", 2), element("b", 2), element("c", 2)],
      "c",
      2,
      0,
    );

    expect(result.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("move um elemento para uma posição exata de outro intervalo", () => {
    const result = reorderCustomElements(
      [element("a", 1), element("b", 3), element("c", 3)],
      "a",
      3,
      1,
    );

    expect(result.map((item) => [item.id, item.slot])).toEqual([
      ["b", 3],
      ["a", 3],
      ["c", 3],
    ]);
  });

  it("mantém a ordem ao soltar no próprio intervalo visual", () => {
    const result = reorderCustomElements(
      [element("a", 2), element("b", 2)],
      "a",
      2,
      1,
    );

    expect(result.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("salva o alinhamento escolhido pelo ponto horizontal do drop", () => {
    const result = reorderCustomElements(
      [element("a", 2), element("b", 2)],
      "a",
      2,
      2,
      { horizontalAlign: "right" },
    );

    expect(result.at(-1)).toMatchObject({
      id: "a",
      slot: 2,
      horizontalAlign: "right",
    });
  });

  it("move um complemento para o resumo lateral sem duplicá-lo", () => {
    const result = reorderCustomElements(
      [
        { ...element("notice", 0), region: "main" },
        { ...element("proof", 0), region: "sidebar" },
      ],
      "notice",
      0,
      1,
      { region: "sidebar" },
    );

    expect(result.filter((item) => item.id === "notice")).toHaveLength(1);
    expect(result.map((item) => [item.id, item.region])).toEqual([
      ["proof", "sidebar"],
      ["notice", "sidebar"],
    ]);
  });

  it("trata elementos antigos sem destino como conteúdo principal", () => {
    const result = reorderCustomElements(
      [element("legacy", 2), { ...element("side", 0), region: "sidebar" }],
      "legacy",
      0,
      0,
    );

    expect(result.find((item) => item.id === "legacy")).toMatchObject({
      region: "main",
    });
  });

  it("mantém complementos superiores na faixa de largura total", () => {
    const result = reorderCustomElements(
      [
        { ...element("notice", 0), region: "main" },
        { ...element("banner", 0), region: "top" },
      ],
      "notice",
      0,
      1,
      { region: "top" },
    );

    expect(result.map((item) => [item.id, item.region])).toEqual([
      ["banner", "top"],
      ["notice", "top"],
    ]);
  });

  it("inclui elementos personalizados na ordem visual completa", () => {
    const entries = checkoutLayoutEntries({
      blockOrder: ["hero", "timer", "progress", "content"],
      customElements: [
        {
          ...element("notice", 1),
          region: "top",
          type: "notice",
          title: "Aviso",
        },
        {
          ...element("faq", 3),
          region: "top",
          type: "faq",
          title: "Dúvidas",
        },
      ],
    });

    expect(entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "block:hero",
      "custom:notice",
      "block:timer",
      "block:progress",
      "custom:faq",
    ]);
  });

  it("move um elemento personalizado através de um bloco principal", () => {
    const config = {
      blockOrder: ["hero", "timer", "progress", "content"],
      customElements: [
        { ...element("notice", 2), region: "top", type: "notice" },
      ],
    };

    const result = reorderCheckoutLayout(config, "custom:notice", -1);

    expect(result.blockOrder).toEqual(config.blockOrder);
    expect(result.customElements[0]).toMatchObject({ id: "notice", slot: 1 });
    expect(
      checkoutLayoutEntries(result).map((entry) => `${entry.kind}:${entry.id}`),
    ).toEqual([
      "block:hero",
      "custom:notice",
      "block:timer",
      "block:progress",
    ]);
  });

  it("move um bloco através de um elemento sem perder sua posição", () => {
    const config = {
      blockOrder: ["hero", "timer", "progress", "content"],
      customElements: [
        { ...element("notice", 2), region: "top", type: "notice" },
      ],
    };

    const result = reorderCheckoutLayout(config, "block:timer", 1);

    expect(result.blockOrder).toEqual(config.blockOrder);
    expect(result.customElements[0]).toMatchObject({ id: "notice", slot: 1 });
    expect(
      checkoutLayoutEntries(result).map((entry) => `${entry.kind}:${entry.id}`),
    ).toEqual([
      "block:hero",
      "custom:notice",
      "block:timer",
      "block:progress",
    ]);
  });

  it("gera a mesma ordem exclusiva usada no checkout publicado", () => {
    const positions = checkoutLayoutPositionMap({
      blockOrder: ["timer", "progress", "content", "hero"],
      customElements: [
        { ...element("notice", 0), region: "top", type: "notice" },
        { ...element("reviews", 3), region: "top", type: "reviews" },
      ],
    });

    expect(Object.fromEntries(positions)).toEqual({
      "custom:notice": 1,
      "block:timer": 2,
      "block:progress": 3,
      "block:hero": 4,
      "custom:reviews": 5,
      "block:content": 6,
    });
  });

  it("não mistura complementos das colunas na faixa superior", () => {
    const entries = checkoutLayoutEntries({
      blockOrder: ["hero", "timer", "progress", "content"],
      customElements: [
        { ...element("top", 1), region: "top", type: "announcement" },
        { ...element("main", 0), region: "main", type: "reviews" },
        { ...element("side", 0), region: "sidebar", type: "banner" },
      ],
    });

    expect(entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "block:hero",
      "custom:top",
      "block:timer",
      "block:progress",
    ]);
  });
});
