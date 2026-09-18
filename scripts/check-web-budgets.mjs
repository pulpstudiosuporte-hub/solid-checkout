import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const directory = new URL('../apps/web/dist/assets/', import.meta.url);
const files = readdirSync(directory);
// Dark-mode variables retain literal light-theme fallbacks across legacy screens.
// Allow their small source overhead and also cap the compressed CSS delivered.
for (const [pattern, limit] of [[/^AdminApp-.*\.css$/, 315_000], [/^AdminApp-.*\.js$/, 150_000], [/^WorldMap-.*\.js$/, 5_000], [/^FlatWorldMap-.*\.js$/, 5_000], [/^3d-globe-.*\.js$/, 1_000_000], [/^vendor-react-.*\.js$/, 210_000], [/^PublicApp-.*\.js$/, 80_000]]) {
  const matched = files.filter(file => pattern.test(file));
  if (matched.length !== 1) throw new Error(`Expected one bundle matching ${pattern}`);
  const size = statSync(new URL(matched[0], directory)).size;
  if (size > limit) throw new Error(`${matched[0]}: ${size} bytes exceeds ${limit}`);
  console.log(`${matched[0]}: ${size}/${limit} bytes`);
  if (/^AdminApp-.*\.css$/.test(matched[0])) {
    const compressed = gzipSync(readFileSync(new URL(matched[0], directory))).length;
    if (compressed > 58_000) throw new Error(`Admin CSS gzip: ${compressed} bytes exceeds 58000`);
    console.log(`Admin CSS gzip: ${compressed}/58000 bytes`);
  }
}
