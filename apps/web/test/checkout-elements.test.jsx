import { describe, expect, it } from "vitest";
import { reorderCustomElements } from "../src/CheckoutEditor.jsx";

const element = (id, slot) => ({ id, slot, enabled: true });

describe("ordenação dos elementos do checkout", () => {
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
});
