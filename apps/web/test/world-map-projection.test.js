import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { projectPoint } from '../src/components/ui/world-map-projection';

describe('projection aligned to the static dotted map', () => {
  it('places Sao Paulo in southeast Brazil with the asset projection', () => {
    const point = projectPoint(-23.5505, -46.6333);
    expect(point.x).toBeCloseTo(288.96833, 4);
    expect(point.y).toBeCloseTo(297.45606, 4);
  });
  it('matches land dots for geographically separate cities in the actual SVG', () => {
    const svg = readFileSync(new URL('../public/illustrations/world-map.svg', import.meta.url), 'utf8');
    const dots = [...svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
    for (const [lat, lng] of [[-23.5505, -46.6333], [-3.119, -60.0217], [-15.7939, -47.8828], [40.7128, -74.006], [51.5074, -0.1278], [35.6762, 139.6503]]) {
      const point = projectPoint(lat, lng);
      const distance = Math.min(...dots.map(dot => Math.hypot(dot.x - point.x / 800 * 198, dot.y - point.y / 400 * 100)));
      expect(distance).toBeLessThan(1.3);
    }
  });
  it('does not turn missing, invalid or out-of-frame coordinates into ocean or edge markers', () => {
    for (const [lat, lng] of [[null, null], ['', ''], [false, true], [' ', '-46'], ['NaN', '2'], [0, 0], [95, 10], [-23, -190], [80, 20], [-23, 175]]) expect(projectPoint(lat, lng)).toBeNull();
    expect(projectPoint('0', '-50')).not.toBeNull();
    expect(projectPoint('-23.55', '-46.63')).not.toBeNull();
  });
});
