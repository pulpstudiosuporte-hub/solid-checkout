import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { themeFields } from '../apps/web/src/theme-kit/contract.mjs';
import { templates } from '../apps/web/src/theme-kit/templates.mjs';

const base = new URL('../', import.meta.url);
const properties = Object.fromEntries(Object.entries(themeFields).map(([key, rule]) => [key,
  rule.type === 'enum' ? { enum: rule.values } : rule.type === 'color' ? { type: 'string', pattern: '^#[a-fA-F0-9]{6}$' }
    : rule.type === 'integer' ? { type: 'integer', minimum: rule.min, maximum: rule.max } : { type: 'boolean' },
]));
const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Pirat Theme v1', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'name', 'config'], properties: {
    schemaVersion: { const: 1 }, name: { type: 'string', minLength: 1, maxLength: 80, pattern: '\\S' },
    config: { type: 'object', additionalProperties: false, required: ['template'], properties },
  },
};
const files = {};
for (const [name, path] of Object.entries({ 'pirat.mjs': 'scripts/theme-kit/pirat.mjs', 'contract.mjs': 'apps/web/src/theme-kit/contract.mjs', 'THEME-RULES.md': 'scripts/theme-kit/THEME-RULES.md' })) files[name] = await readFile(new URL(path, base));
files['theme.schema.json'] = strToU8(JSON.stringify(schema, null, 2) + '\n');
files['README.md'] = strToU8('# Pirat Theme Kit\n\nRequer Node.js 22 ou superior. Sem instalação de dependências.\n\n```sh\nnode pirat.mjs init minha-loja retail\nnode pirat.mjs validate minha-loja\nnode pirat.mjs build minha-loja\n```\n\nEdite minha-loja/theme.json com sua IA. Consulte THEME-RULES.md e theme.schema.json. Importe minha-loja/dist/theme.pirat.json no editor em Modelos → Importar tema. A CLI não publica nem autentica. Modelos: minimal, retail e marketplace.\n');
for (const [id, theme] of Object.entries(templates)) files[`templates/${id}.json`] = strToU8(JSON.stringify(theme, null, 2) + '\n');
const output = new URL('apps/web/public/downloads/', base);
await mkdir(output, { recursive: true });
// Fixed metadata makes the download reproducible across builds.
await writeFile(new URL('pirat-theme-kit-v1.zip', output), zipSync(Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, [bytes, { mtime: new Date('2026-01-01T00:00:00Z') }]]))));
await writeFile(new URL('theme-v1.schema.json', output), files['theme.schema.json']);
for (const [id] of Object.entries(templates)) await writeFile(new URL(`${id}.pirat.json`, output), files[`templates/${id}.json`]);
console.log('Kit, schema e três temas gerados em public/downloads.');
