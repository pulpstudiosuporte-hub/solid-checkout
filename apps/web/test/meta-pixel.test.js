import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let scripts;
let pixel;
beforeEach(async () => {
  vi.resetModules(); scripts = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', { createElement: () => ({ remove: vi.fn() }), head: { appendChild: script => scripts.push(script) } });
  vi.stubGlobal('sessionStorage', { getItem: vi.fn(), setItem: vi.fn() });
  pixel = await import('../src/meta-pixel.js');
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
async function ready(id) {
  const loaded = pixel.loadMetaPixel(id);
  window.fbq.callMethod = vi.fn();
  scripts.at(-1).onload();
  await loaded;
}
describe('Meta browser SDK', () => {
  it('retries a failed download without initializing the Pixel twice', async () => {
    const failed = pixel.loadMetaPixel('123456');
    const rejection = expect(failed).rejects.toThrow('Pixel indisponível');
    scripts[0].onerror(); await rejection;
    await ready('123456');
    expect(scripts).toHaveLength(2);
    expect(window.fbq.queue).toHaveLength(1);
    pixel.trackMeta('123456', 'InitiateCheckout', {}, 'session:InitiateCheckout');
    expect(window.fbq.callMethod).toHaveBeenCalledTimes(1);
  });
  it('scopes and deduplicates conversion events per Pixel even with blocked storage', async () => {
    sessionStorage.getItem.mockImplementation(() => { throw new Error('blocked'); });
    sessionStorage.setItem.mockImplementation(() => { throw new Error('blocked'); });
    await ready('123456'); await pixel.loadMetaPixel('654321');
    window.fbq.callMethod.mockClear();
    for (const id of ['123456', '123456', '654321']) pixel.trackMeta(id, 'Purchase', { value: 149 }, 'session:Purchase');
    expect(window.fbq.callMethod.mock.calls).toEqual([
      ['trackSingle', '123456', 'Purchase', { value: 149 }, { eventID: 'session:Purchase' }],
      ['trackSingle', '654321', 'Purchase', { value: 149 }, { eventID: 'session:Purchase' }],
    ]);
  });
  it('respects persisted conversions but sends page views on each page opening', async () => {
    await ready('123456');
    sessionStorage.getItem.mockReturnValue('1');
    pixel.trackMeta('123456', 'Purchase', {}, 'session:Purchase');
    pixel.trackMeta('123456', 'PageView'); pixel.trackMeta('123456', 'PageView');
    expect(window.fbq.callMethod.mock.calls.map(call => call[2])).toEqual(['PageView', 'PageView']);
  });
});
