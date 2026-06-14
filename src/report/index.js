export function generateEvaluationReport(entries = []) {
  const runs = Array.isArray(entries) ? entries : [];
  const blocked = runs.filter((entry) => entry?.evaluation?.allowed === false).length;
  const allowed = runs.filter((entry) => entry?.evaluation?.allowed !== false).length;
  const approvals = runs.filter((entry) => entry?.evaluation?.requiresHumanApproval).length;

  return {
    total: runs.length,
    allowed,
    blocked,
    approvals,
    blockRate: runs.length === 0 ? 0 : blocked / runs.length
  };
}

export function generateWeeklyMetricsReport(entries = []) {
  const runs = Array.isArray(entries) ? entries : [];
  const total = runs.length;

  const safetyPassCount = runs.filter((entry) => entry?.evaluation?.allowed !== false).length;
  const overrideCount = runs.filter((entry) => entry?.overridden === true).length;
  const escalationCount = runs.filter((entry) => entry?.escalated === true).length;
  const unnecessaryEscalationCount = runs.filter(
    (entry) => entry?.escalated === true && entry?.shouldEscalate === false
  ).length;

  const turnaroundValues = runs
    .map((entry) => Number(entry?.turnaroundMs))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  const medianTurnaroundMs =
    turnaroundValues.length === 0
      ? null
      : turnaroundValues[Math.floor(turnaroundValues.length / 2)];

  return {
    total,
    safetyPassRate: total === 0 ? 0 : safetyPassCount / total,
    canonConsistencyRate: total === 0 ? 0 : (total - overrideCount) / total,
    humanOverrideRate: total === 0 ? 0 : overrideCount / total,
    medianTurnaroundMs,
    approvalFrictionRate: escalationCount === 0 ? 0 : unnecessaryEscalationCount / escalationCount,
    counts: {
      safetyPassCount,
      overrideCount,
      escalationCount,
      unnecessaryEscalationCount
    }
  };
}
