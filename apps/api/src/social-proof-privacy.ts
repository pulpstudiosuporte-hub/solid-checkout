const safeText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().replace(/[\r\n\t]/g, ' ').slice(0, max) : '';

export const anonymizeSocialProofName = (value: unknown): string => {
  const firstName = safeText(value, 80).split(/\s+/)[0] ?? '';
  if (!firstName) return '';
  return `${firstName.slice(0, 1).toLocaleUpperCase('pt-BR')}***`;
};

export const anonymizeSocialProofLocation = (
  address: Record<string, unknown>,
  tracking: Record<string, unknown>,
): string => safeText(address.state, 40) || safeText(tracking.geo_region, 40) || safeText(tracking.geo_country, 40);

export const sanitizeSocialProofProduct = (value: unknown): string => safeText(value, 120) || 'este item';
