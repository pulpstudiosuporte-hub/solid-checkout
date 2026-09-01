export const checkoutNativeBlocks = ["hero", "timer", "progress", "content"];
export const checkoutTopBlocks = ["hero", "timer", "progress"];

const elementRegion = (item) =>
  item?.region === "top"
    ? "top"
    : item?.region === "sidebar"
      ? "sidebar"
      : "main";

function orderedTopBlocks(config) {
  const saved = Array.isArray(config.blockOrder) ? config.blockOrder : [];
  return [
    ...saved.filter((id) => checkoutTopBlocks.includes(id)),
    ...checkoutTopBlocks.filter((id) => !saved.includes(id)),
  ];
}

function topSlot(item, maximum) {
  if (!Number.isInteger(item?.slot)) return 0;
  return Math.max(0, Math.min(item.slot, maximum));
}

/**
 * Builds the single full-width lane shown above the two checkout columns.
 * Native blocks and merchant elements share this sequence, while `content`
 * remains the fixed boundary where the main and summary columns begin.
 */
export function buildCheckoutLayoutEntries(config) {
  const blocks = orderedTopBlocks(config);
  const custom = (Array.isArray(config.customElements)
    ? config.customElements
    : []
  ).filter(
    (item) => item.enabled !== false && elementRegion(item) === "top",
  );
  const entries = [];

  for (let slot = 0; slot <= blocks.length; slot += 1) {
    custom
      .filter((item) => topSlot(item, blocks.length) === slot)
      .forEach((item) => entries.push({ kind: "custom", id: item.id, item }));
    if (slot < blocks.length) {
      entries.push({ kind: "block", id: blocks[slot] });
    }
  }

  return entries;
}

export function checkoutLayoutPositionMap(config) {
  const entries = [
    ...buildCheckoutLayoutEntries(config),
    { kind: "block", id: "content" },
  ];
  return new Map(
    entries.map((entry, index) => [
      `${entry.kind}:${entry.id}`,
      index + 1,
    ]),
  );
}

export function reorderCheckoutLayout(config, entryKey, direction) {
  const entries = buildCheckoutLayoutEntries(config);
  const from = entries.findIndex(
    (entry) => `${entry.kind}:${entry.id}` === entryKey,
  );
  const to = from + direction;
  if (from < 0 || to < 0 || to >= entries.length) return config;

  [entries[from], entries[to]] = [entries[to], entries[from]];
  let slot = 0;
  const blockOrder = [];
  const orderedTopElements = [];
  entries.forEach((entry) => {
    if (entry.kind === "block") {
      blockOrder.push(entry.id);
      slot += 1;
    } else {
      orderedTopElements.push({ ...entry.item, region: "top", slot });
    }
  });

  const untouchedElements = (Array.isArray(config.customElements)
    ? config.customElements
    : []
  ).filter(
    (item) => item.enabled === false || elementRegion(item) !== "top",
  );

  return {
    ...config,
    blockOrder: [...blockOrder, "content"],
    customElements: [...untouchedElements, ...orderedTopElements],
  };
}
