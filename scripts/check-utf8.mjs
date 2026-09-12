import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

// Nixpacks reads source files before running the build. Reject invalid text
// locally so a Windows encoding change cannot silently break deployment.
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.toml', '.txt', '.sql', '.prisma', '.conf', '.sh']);
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const decoder = new TextDecoder('utf-8', { fatal: true });
const invalid = [];
for (const file of files) {
  if (!extensions.has(extname(file)) && !/(^|\/)(Dockerfile[^/]*|\.npmrc|\.dockerignore)$/.test(file)) continue;
  const content = readFileSync(file);
  try { decoder.decode(content); } catch { invalid.push(file); }
}
if (invalid.length) {
  console.error(`Invalid UTF-8; save these files as UTF-8 before deploying:\n${invalid.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Source files use valid UTF-8.');
}
