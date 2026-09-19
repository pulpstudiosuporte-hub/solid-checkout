import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';

// Runs only on the merchant's machine, like a regular project build.
// Project modules never execute on the Pirat API or the buyer's browser.
const module = await import(pathToFileURL(process.argv[2]).href);
const config = typeof module.default === 'function' ? await module.default() : module.default;
if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('O tema deve exportar um objeto de configuração.');
const json = JSON.stringify(config);
if (Buffer.byteLength(json) > 100_000) throw new Error('O tema ultrapassa 100 KB.');
await writeFile(process.argv[3], json, { encoding: 'utf8', mode: 0o600 });
