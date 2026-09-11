import { readdirSync, statSync } from 'node:fs';
const directory = new URL('../apps/web/dist/assets/', import.meta.url);
const files = readdirSync(directory);
for (const [pattern, limit] of [[/^AdminApp-.*\.css$/, 300_000], [/^AdminApp-.*\.js$/, 150_000], [/^WorldMap-.*\.js$/, 5_000], [/^PublicApp-.*\.js$/, 80_000]]) {
  const matched = files.filter(file => pattern.test(file));
  if (matched.length !== 1) throw new Error(`Expected one bundle matching ${pattern}`);
  const size = statSync(new URL(matched[0], directory)).size;
  if (size > limit) throw new Error(`${matched[0]}: ${size} bytes exceeds ${limit}`);
  console.log(`${matched[0]}: ${size}/${limit} bytes`);
}
