// Matches SphereGeometry's equirectangular UVs: Greenwich at +X, east towards -Z.
export function globePosition(lat: number, lng: number, radius: number): [number, number, number] {
  const latitude = lat * Math.PI / 180;
  const longitude = lng * Math.PI / 180;
  return [radius * Math.cos(latitude) * Math.cos(longitude), radius * Math.sin(latitude), -radius * Math.cos(latitude) * Math.sin(longitude)];
}

export function validGlobeCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}
