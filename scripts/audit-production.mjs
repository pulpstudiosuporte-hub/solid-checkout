import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Prisma 7.9.1 pins deepmerge-ts 7.1.5 and mysql2 3.15.3. The application uses
// PostgreSQL exclusively; mysql2 is an unused Prisma CLI dependency. npm only
// proposes an incompatible Prisma downgrade. These exact, expiring exceptions
// keep CI sensitive to every other high/critical issue.
const temporaryAllowlist = new Set(['deepmerge-ts', '@prisma/config', 'mysql2', 'prisma']);
const exceptionExpiresAt = new Date('2026-10-31T23:59:59Z');
const audit = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm audit --omit=dev --json'], { encoding: 'utf8' })
  : spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' });
let report;
try { report = JSON.parse(audit.stdout); } catch { console.error(audit.stderr || audit.stdout || 'npm audit did not return JSON'); process.exit(1); }

const vulnerabilities = Object.entries(report.vulnerabilities ?? {}).filter(([, value]) => ['high', 'critical'].includes(value.severity));
const unexpected = vulnerabilities.filter(([name]) => !temporaryAllowlist.has(name));
const deepmerge = report.vulnerabilities?.['deepmerge-ts'];
const mysql = report.vulnerabilities?.mysql2;
const expectedDeepmergeAdvisory = Array.isArray(deepmerge?.via) && deepmerge.via.some(item => typeof item === 'object' && item?.source === 1145093);
const expectedMysqlAdvisory = Array.isArray(mysql?.via) && mysql.via.some(item => typeof item === 'object' && item?.source === 1153173);
const mysqlOnlyAffectsPrisma = Array.isArray(mysql?.effects) && mysql.effects.length === 1 && mysql.effects[0] === 'prisma';
const schema = readFileSync(new URL('../packages/database/prisma/schema.prisma', import.meta.url), 'utf8');
const postgresOnly = /provider\s*=\s*"postgresql"/.test(schema) && !/provider\s*=\s*"mysql"/.test(schema);
const expectedExceptions = expectedDeepmergeAdvisory && expectedMysqlAdvisory && mysqlOnlyAffectsPrisma && postgresOnly;

if (unexpected.length || vulnerabilities.length && (!expectedExceptions || new Date() > exceptionExpiresAt)) {
  console.error(JSON.stringify({ unexpected: unexpected.map(([name, value]) => ({ name, severity: value.severity, via: value.via })) }, null, 2));
  process.exit(1);
}
if (vulnerabilities.length) console.warn('Temporary audit exceptions: Prisma 7.9.1 -> deepmerge-ts GHSA-ggr8-5vv4-36mx and unused mysql2 GHSA-3f6p-5ww8-9rcr. PostgreSQL-only use verified. Remove after a compatible Prisma update.');
else console.log('No high or critical production vulnerabilities found.');
