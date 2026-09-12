// world-map.svg: dotted-map 3.1.0, default world bounds, WGS84 Mercator.
// Keep the background and markers in the same SVG coordinate system.
const ECCENTRICITY = Math.sqrt(0.0066943799901413165);
const mercatorY = latitude => {
  const radians = latitude * Math.PI / 180;
  const sin = Math.sin(radians);
  return Math.log(Math.tan(Math.PI / 4 + radians / 2) * ((1 - ECCENTRICITY * sin) / (1 + ECCENTRICITY * sin)) ** (ECCENTRICITY / 2));
};
const NORTH = mercatorY(71);
const SOUTH = mercatorY(-56);
export const coordinate = (value, limit) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const result = Number(value);
  return Number.isFinite(result) && Math.abs(result) <= limit ? result : null;
};
export function projectPoint(latitude, longitude) {
  const lat = coordinate(latitude, 90);
  const lng = coordinate(longitude, 180);
  if (lat === null || lng === null || (lat === 0 && lng === 0) || lat < -56 || lat > 71 || lng < -168 || lng > 168) return null;
  return { x: (lng + 168) / 336 * 800, y: (NORTH - mercatorY(lat)) / (NORTH - SOUTH) * 400 };
}
