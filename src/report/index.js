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