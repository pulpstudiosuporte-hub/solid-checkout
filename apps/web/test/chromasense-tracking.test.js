import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromaScrollDepth, describeTarget } from '../src/useChromaSense';
afterEach(() => vi.unstubAllGlobals());

describe('ChromaSense collection', () => {
  it('counts the visible viewport, including pages that fit without scrolling', () => {
    expect(chromaScrollDepth(0, 800, 3200)).toBe(25);
    expect(chromaScrollDepth(800, 800, 3200)).toBe(50);
    expect(chromaScrollDepth(2400, 800, 3200)).toBe(100);
    expect(chromaScrollDepth(0, 800, 600)).toBe(100);
  });
  it('marks non-interactive targets and never reads typed field contents', () => {
    class ElementStub {
      constructor(tagName, control) { this.tagName = tagName; this.control = control; this.classList = []; }
      closest() { return this.control ? this : null; }
      getAttribute() { return null; }
      get value() { throw new Error('Sensitive value must not be read'); }
      get textContent() { throw new Error('Personalized content must not be read'); }
    }
    vi.stubGlobal('Element', ElementStub);
    expect(describeTarget(new ElementStub('DIV', false))).toMatchObject({ interactive: false, targetLabel: 'Área do checkout' });
    expect(describeTarget(new ElementStub('INPUT', true))).toMatchObject({ interactive: true, targetLabel: 'Campo' });
  });
});
