// Format conversion only: preserve the generated composition and dimensions.
import sharp from 'sharp';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Informe a pasta das imagens originais geradas como argumento.');
const files = {
  essencial: 'exec-ec7b881c-f84b-46b0-823f-20eca98bc170.png',
  varejo: 'exec-a2e3fe80-aff2-4cf9-a829-c0c143772688.png',
  marketplace: 'exec-c6f800a6-e0f2-44b8-a183-71e43a35fe45.png',
  atelie: 'exec-c1980ca1-c483-4d24-8c2f-d66b67c9963a.png',
  botanica: 'exec-09bb0758-0df6-47d9-abfb-dc0f3e3e674c.png',
};
for (const [name, input] of Object.entries(files)) {
  const output = `solid-site/public/brand/templates/${name}-art.webp`;
  const info = await sharp(join(source, input)).webp({ quality: 88 }).toFile(output);
  await copyFile(output, `apps/web/public/brand/templates/${name}-art.webp`);
  console.log(`${name}: ${info.width}x${info.height}, ${info.size} bytes`);
}
