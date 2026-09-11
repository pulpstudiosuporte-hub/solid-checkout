import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit } from './audit-policy.mjs';
const schema = 'provider = "postgresql"';
const evaluate = (report, status = 0, lock = {}) => evaluateAudit({ status, stdout: JSON.stringify(report) }, lock, schema, new Date('2026-09-10'));
const clean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
test('fails closed on network errors and incomplete reports', () => {
  for (const report of [{ error: { code: 'ENOTFOUND' } }, {}, { vulnerabilities: {} }, { ...clean, metadata: undefined }]) assert.throws(() => evaluate(report));
  assert.throws(() => evaluate(clean, 1));
  assert.throws(() => evaluateAudit({ status: null, error: new Error('timeout') }, {}, schema));
  assert.throws(() => evaluateAudit({ status: 0, stdout: 'not JSON' }, {}, schema));
  assert.deepEqual(evaluate(clean).unexpected, []);
});
test('a new advisory or installed version invalidates a package exception', () => {
  const item = { severity: 'high', via: [{ url: 'https://github.com/advisories/GHSA-ggr8-5vv4-36mx' }], nodes: ['node_modules/deepmerge-ts'] };
  const report = { ...clean, vulnerabilities: { 'deepmerge-ts': item }, metadata: { vulnerabilities: { total: 1 } } };
  const lock = { packages: { 'node_modules/deepmerge-ts': { version: '7.1.5' } } };
  assert.equal(evaluate(report, 1, lock).unexpected.length, 0);
  item.via.push({ url: 'https://github.com/advisories/new-unreviewed-advisory' });
  assert.equal(evaluate(report, 1, lock).unexpected.length, 1);
  item.via.pop();
  lock.packages['node_modules/deepmerge-ts'].version = '7.1.4';
  assert.equal(evaluate(report, 1, lock).unexpected.length, 1);
});

test('exceptions reject expiry, critical severity and missing advisory references', () => {
  const item = { severity: 'high', via: [{ url: 'https://github.com/advisories/GHSA-ggr8-5vv4-36mx' }], nodes: ['node_modules/deepmerge-ts'] };
  const report = { ...clean, vulnerabilities: { 'deepmerge-ts': item }, metadata: { vulnerabilities: { total: 1 } } };
  const lock = { packages: { 'node_modules/deepmerge-ts': { version: '7.1.5' } } };
  assert.equal(evaluateAudit({ status: 1, stdout: JSON.stringify(report) }, lock, schema, new Date('2026-11-01')).unexpected.length, 1);
  item.severity = 'critical';
  assert.equal(evaluate(report, 1, lock).unexpected.length, 1);
  item.severity = 'high'; item.via = [];
  assert.equal(evaluate(report, 1, lock).unexpected.length, 1);
});
