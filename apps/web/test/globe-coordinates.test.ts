import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, Raycaster, SphereGeometry, Vector3 } from 'three';
import { globePosition, validGlobeCoordinate } from '../src/components/ui/globe-coordinates';

describe('globe coordinates', () => {
  it('places cities at their matching Earth texture UV, across both hemispheres', () => {
    const geometry = new SphereGeometry(2, 128, 64);
    const material = new MeshBasicMaterial();
    const globe = new Mesh(geometry, material);
    for (const [lat, lng] of [[-23.5505, -46.6333], [-3.119, -60.0217], [51.5074, -0.1278], [35.6762, 139.6503], [-36.8485, 174.7633]] as const) {
      const direction = new Vector3(...globePosition(lat, lng, 1));
      expect(direction.length()).toBeCloseTo(1, 8);
      const hit = new Raycaster(direction.clone().multiplyScalar(5), direction.clone().negate()).intersectObject(globe)[0];
      expect(hit?.uv?.x).toBeCloseTo((lng + 180) / 360, 3);
      expect(hit?.uv?.y).toBeCloseTo((lat + 90) / 180, 3);
    }
    geometry.dispose(); material.dispose();
  });
  it('accepts the entire globe, rejects invalid coordinates and the default 0/0 pair', () => {
    expect(validGlobeCoordinate(-36.8485, 174.7633)).toBe(true);
    expect(validGlobeCoordinate(90, 180)).toBe(true);
    expect(validGlobeCoordinate(0, -50)).toBe(true);
    for (const [lat, lng] of [[NaN, 0], [0, Infinity], [91, 0], [0, -181], [0, 0]] as const) expect(validGlobeCoordinate(lat, lng)).toBe(false);
  });
});
