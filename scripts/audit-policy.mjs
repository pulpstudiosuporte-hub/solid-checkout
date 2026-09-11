const expiresAt = new Date('2026-10-31T23:59:59Z');
const exceptions = {
  'deepmerge-ts': { version: '7.1.5', via: ['https://github.com/advisories/GHSA-ggr8-5vv4-36mx'] },
  '@prisma/config': { version: '7.9.1', via: ['deepmerge-ts'] },
  // Prisma pins this CLI-only driver; PostgreSQL runtime never opens MySQL connections.
  mysql2: { version: '3.15.3', via: ['https://github.com/advisories/GHSA-3f6p-5ww8-9rcr', 'https://github.com/advisories/GHSA-rgwj-5xj2-c3m3'] },
  prisma: { version: '7.9.1', via: ['@prisma/config', 'mysql2'] },
};

export function evaluateAudit(result, lock, schema, now = new Date()) {
  if (result.error || result.signal || ![0, 1].includes(result.status)) throw new Error('A consulta ao npm não foi concluída.');
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error('O npm não retornou um relatório JSON válido.'); }
  if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities || typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities) || !Number.isInteger(report.metadata?.vulnerabilities?.total)) throw new Error('Relatório de auditoria incompleto ou com erro.');
  const entries = Object.entries(report.vulnerabilities);
  if (report.metadata.vulnerabilities.total !== entries.length || (entries.length === 0 && result.status !== 0)) throw new Error('Resultado da auditoria inconsistente.');
  const postgresOnly = /provider\s*=\s*"postgresql"/.test(schema) && !/provider\s*=\s*"mysql"/.test(schema);
  const accepted = new Set();
  for (const [name, rule] of Object.entries(exceptions)) {
    const item = report.vulnerabilities[name];
    if (!item || item.severity !== 'high' || now > expiresAt || !postgresOnly || !Array.isArray(item.via) || !item.via.length || !Array.isArray(item.nodes) || !item.nodes.length) continue;
    if (!item.nodes.every(node => lock.packages?.[node]?.version === rule.version)) continue;
    if (name === 'mysql2' && (item.effects?.length !== 1 || item.effects[0] !== 'prisma')) continue;
    if (item.via.every(via => rule.via.includes(typeof via === 'string' ? via : via?.url) && (typeof via !== 'string' || accepted.has(via)))) accepted.add(name);
  }
  for (const [, item] of entries) if (!item || !['info', 'low', 'moderate', 'high', 'critical'].includes(item.severity) || !Array.isArray(item.via)) throw new Error('Entrada inválida no relatório de auditoria.');
  const unexpected = entries.filter(([name, item]) => ['high', 'critical'].includes(item.severity) && !accepted.has(name)).map(([name, item]) => ({ name, severity: item.severity, via: item.via }));
  return { unexpected, exceptions: [...accepted], counts: report.metadata.vulnerabilities };
}
