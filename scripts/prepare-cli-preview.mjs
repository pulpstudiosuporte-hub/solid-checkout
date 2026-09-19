import { mkdir, readFile, writeFile } from 'node:fs/promises';
const folder = '.visual-check/cli-ui-project';
await mkdir(`${folder}/src`, { recursive: true });
await writeFile(`${folder}/src/theme.mjs`, `export default ${await readFile('apps/api/test/fixtures/cli-config.json', 'utf8')};\n`);
process.argv = [process.execPath, '.visual-check/connected-cli/cli.mjs', 'dev', folder, '--port', '4318'];
await import('../.visual-check/connected-cli/cli.mjs');
