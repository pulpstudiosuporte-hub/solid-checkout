#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseTheme, MAX_THEME_BYTES } from './contract.mjs';

const [command, target, option, ...extra] = process.argv.slice(2);
const help = `Pirat Themes v1 — Node.js 22+
  node pirat.mjs init meu-tema minimal|retail|marketplace
  node pirat.mjs validate meu-tema
  node pirat.mjs build meu-tema

Edite theme.json com sua IA. Build gera dist/theme.pirat.json.
No editor Pirat: Modelos → Importar tema → Aplicar na prévia.
Salvar rascunho e Publicar continuam sendo ações separadas.`;

try {
  if (!command || command === '--help') { console.log(help); }
  else {
    if (!['init', 'validate', 'build'].includes(command) || !target || extra.length || command !== 'init' && option) throw new Error(help);
    const directory = resolve(target);
    if (command === 'init') {
      const template = option || 'minimal';
      if (!['minimal', 'retail', 'marketplace'].includes(template)) throw new Error('Modelo inválido: use minimal, retail ou marketplace.');
      const source = await readFile(new URL(`./templates/${template}.json`, import.meta.url), 'utf8');
      parseTheme(source);
      // An existing folder is never overwritten, even when empty.
      await mkdir(directory);
      await writeFile(join(directory, 'theme.json'), source, { flag: 'wx' });
      await writeFile(join(directory, 'AGENTS.md'), await readFile(new URL('./THEME-RULES.md', import.meta.url)), { flag: 'wx' });
      await writeFile(join(directory, 'theme.schema.json'), await readFile(new URL('./theme.schema.json', import.meta.url)), { flag: 'wx' });
      console.log(`Tema criado: ${directory}`);
    } else {
      const file = join(directory, 'theme.json');
      if ((await stat(file)).size > MAX_THEME_BYTES) throw new Error('O tema excede 32 KB.');
      const theme = parseTheme(await readFile(file, 'utf8'));
      if (command === 'build') {
        const output = join(directory, 'dist');
        await mkdir(output, { recursive: true });
        // Build only replaces its own generated artifact, never source files.
        await writeFile(join(output, 'theme.pirat.json'), `${JSON.stringify(theme, null, 2)}\n`);
        console.log(`Pronto para importar: ${join(output, 'theme.pirat.json')}`);
      } else console.log(`Tema válido: ${theme.name}`);
    }
  }
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'A pasta já existe. Escolha uma pasta nova; nenhum arquivo foi substituído.' : error.message);
  process.exitCode = 1;
}
