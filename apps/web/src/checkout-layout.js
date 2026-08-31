export const checkoutNativeBlocks = ["hero", "timer", "progress", "content"];

export function buildCheckoutLayoutEntries(config) {
  const blocks =
    Array.isArray(config.blockOrder) && config.blockOrder.length
      ? config.blockOrder
      : checkoutNativeBlocks;
  const custom = Array.isArray(config.customElements)
    ? config.customElements
    : [];
  const entries = [];

  for (let slot = 0; slot <= blocks.length; slot += 1) {
    custom
      .filter((item) => (Number.isInteger(item.slot) ? item.slot : 2) === slot)
      .forEach((item) => entries.push({ kind: "custom", id: item.id, item }));
    if (slot < blocks.length) {
      entries.push({ kind: "block", id: blocks[slot] });
    }
  }

  return entries;
}

export function checkoutLayoutPositionMap(config) {
  return new Map(
    buildCheckoutLayoutEntries(config).map((entry, index) => [
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
  const customElements = [];
  entries.forEach((entry) => {
    if (entry.kind === "block") {
      blockOrder.push(entry.id);
      slot += 1;
    } else {
      customElements.push({ ...entry.item, slot });
    }
  });

  return { ...config, blockOrder, customElements };
}
