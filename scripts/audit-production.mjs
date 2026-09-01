import { spawnSync } from 'node:child_process';

// Prisma 7.9.1 pins deepmerge-ts 7.1.5. The upstream fix is only available in
// deepmerge-ts 8 and npm currently proposes an incompatible Prisma downgrade.
// This narrow exception keeps CI sensitive to every other high/critical issue.
const temporaryAllowlist = new Set(['deepmerge-ts', '@prisma/config', 'prisma']);
const exceptionExpiresAt = new Date('2026-12-31T23:59:59Z');
const audit = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm audit --omit=dev --json'], { encoding: 'utf8' })
  : spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' });
let report;
try { report = JSON.parse(audit.stdout); } catch { console.error(audit.stderr || audit.stdout || 'npm audit did not return JSON'); process.exit(1); }

const vulnerabilities = Object.entries(report.vulnerabilities ?? {}).filter(([, value]) => ['high', 'critical'].includes(value.severity));
const unexpected = vulnerabilities.filter(([name]) => !temporaryAllowlist.has(name));
const deepmerge = report.vulnerabilities?.['deepmerge-ts'];
const expectedAdvisory = Array.isArray(deepmerge?.via) && deepmerge.via.some(item => typeof item === 'object' && item?.source === 1145093);

if (unexpected.length || vulnerabilities.length && (!expectedAdvisory || new Date() > exceptionExpiresAt)) {
  console.error(JSON.stringify({ unexpected: unexpected.map(([name, value]) => ({ name, severity: value.severity, via: value.via })) }, null, 2));
  process.exit(1);
}
if (vulnerabilities.length) console.warn('Temporary audit exception: Prisma 7.9.1 -> deepmerge-ts GHSA-ggr8-5vv4-36mx. Remove when Prisma supports deepmerge-ts 8.');
else console.log('No high or critical production vulnerabilities found.');
