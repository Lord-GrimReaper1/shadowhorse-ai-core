import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWeeklyMetricsReport } from '../src/report/index.js';

test('weekly report calculates core pilot metrics', () => {
  const report = generateWeeklyMetricsReport([
    {
      evaluation: { allowed: true },
      overridden: false,
      escalated: true,
      shouldEscalate: true,
      turnaroundMs: 1000
    },
    {
      evaluation: { allowed: false },
      overridden: true,
      escalated: true,
      shouldEscalate: false,
      turnaroundMs: 2000
    },
    {
      evaluation: { allowed: true },
      overridden: false,
      escalated: false,
      shouldEscalate: false,
      turnaroundMs: 1500
    }
  ]);

  assert.equal(report.total, 3);
  assert.equal(report.safetyPassRate, 2 / 3);
  assert.equal(report.humanOverrideRate, 1 / 3);
  assert.equal(report.medianTurnaroundMs, 1500);
  assert.equal(report.approvalFrictionRate, 0.5);
});
