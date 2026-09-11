import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { evaluateAudit } from './audit-policy.mjs';
const options = { encoding: 'utf8', timeout: 120_000, maxBuffer: 20 * 1024 * 1024 };
const audit = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm audit --omit=dev --json'], options)
  : spawnSync('npm', ['audit', '--omit=dev', '--json'], options);
try {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const schema = readFileSync(new URL('../packages/database/prisma/schema.prisma', import.meta.url), 'utf8');
  const result = evaluateAudit(audit, lock, schema);
  console.log(JSON.stringify(result, null, 2));
  if (result.unexpected.length) process.exitCode = 1;
} catch (error) {
  console.error('Falha na consulta de dependencias: ' + error.message);
  process.exitCode = 1;
}
