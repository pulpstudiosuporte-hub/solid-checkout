// Shared by the editor and the downloadable CLI. No runtime dependencies.
export const themeFields = Object.create(null);
const fields = (names, rule) => names.split(' ').forEach(name => { themeFields[name] = rule; });
fields('primary pageBg cardBg headerBg textColor pageTextColor headerTextColor buttonTextColor borderColor inputBg inputBorderColor buttonBgColor progressActiveColor progressInactiveColor progressActiveTextColor progressInactiveTextColor progressLabelColor progressActiveLabelColor footerBackgroundColor footerTextColor timerBgColor timerTextColor timerNumberColor', { type: 'color' });
fields('radius inputRadius', { type: 'integer', min: 0, max: 28 });
fields('contentWidth', { type: 'integer', min: 650, max: 1280 });
fields('showProgress showSummary', { type: 'boolean' });
themeFields.template = { type: 'enum', values: ['minimal', 'conversion', 'showcase', 'compact', 'retail', 'marketplace'] };
themeFields.layout = { type: 'enum', values: ['split', 'centered'] };
themeFields.font = { type: 'enum', values: ['Plus Jakarta Sans', 'Poppins', 'Montserrat', 'DM Sans', 'Roboto', 'Inter', 'Arial', 'Georgia'] };
themeFields.progressStyle = { type: 'enum', values: ['outline', 'solid', 'icons', 'chevrons'] };
themeFields.summaryDevice = { type: 'enum', values: ['all', 'desktop', 'mobile'] };
themeFields.buttonEffect = { type: 'enum', values: ['lift', 'pulse', 'shine', 'glow', 'gradient', 'press', 'none'] };

export const MAX_THEME_BYTES = 32768;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateTheme(value) {
  const errors = [];
  if (!object(value)) return ['O tema precisa ser um objeto JSON.'];
  for (const key of Object.keys(value)) if (!['schemaVersion', 'name', 'config'].includes(key)) errors.push(`Campo desconhecido: ${key}.`);
  if (value.schemaVersion !== 1) errors.push('schemaVersion precisa ser 1.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) errors.push('name precisa ter de 1 a 80 caracteres.');
  if (!object(value.config)) return [...errors, 'config precisa ser um objeto.'];
  if (!Object.hasOwn(value.config, 'template')) errors.push('config.template é obrigatório.');
  for (const [key, item] of Object.entries(value.config)) {
    const rule = themeFields[key];
    if (!rule) { errors.push(`config.${key} não faz parte do contrato de temas v1.`); continue; }
    const valid = rule.type === 'color' ? typeof item === 'string' && /^#[a-f\d]{6}$/i.test(item)
      : rule.type === 'boolean' ? typeof item === 'boolean'
      : rule.type === 'integer' ? Number.isInteger(item) && item >= rule.min && item <= rule.max
      : rule.values.includes(item);
    if (!valid) errors.push(`config.${key}: esperado ${rule.type === 'enum' ? rule.values.join(' | ') : rule.type === 'integer' ? `inteiro de ${rule.min} a ${rule.max}` : rule.type === 'color' ? 'cor #RRGGBB' : 'true ou false'}.`);
  }
  return errors;
}

export function parseTheme(source) {
  if (new TextEncoder().encode(source).length > MAX_THEME_BYTES) throw new Error('O tema excede 32 KB.');
  let value;
  try { value = JSON.parse(source); } catch { throw new Error('JSON inválido. Confira aspas e vírgulas.'); }
  const errors = validateTheme(value);
  if (errors.length) throw new Error(errors.join('\n'));
  return { schemaVersion: 1, name: value.name.trim(), config: { ...value.config } };
}

export function exportTheme(config, name = 'Meu tema') {
  const theme = { schemaVersion: 1, name, config: Object.fromEntries(Object.entries(config).filter(([key]) => Object.hasOwn(themeFields, key))) };
  return parseTheme(JSON.stringify(theme));
}

export function applyTheme(config, theme) {
  const clean = parseTheme(JSON.stringify(theme));
  return { ...config, ...clean.config };
}
