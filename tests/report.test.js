import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEvaluationReport } from '../src/report/index.js';

test('report generator summarizes allowed and blocked runs', () => {
  const report = generateEvaluationReport([
    { evaluation: { allowed: true, requiresHumanApproval: false } },
    { evaluation: { allowed: false, requiresHumanApproval: true } },
    { evaluation: { allowed: true, requiresHumanApproval: true } }
  ]);

  assert.equal(report.total, 3);
  assert.equal(report.allowed, 2);
  assert.equal(report.blocked, 1);
  assert.equal(report.approvals, 2);
});
