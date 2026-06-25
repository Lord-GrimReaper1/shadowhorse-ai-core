const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const POLICY_CHANGE_DIR = path.join(__dirname, '..', 'data', 'policy');
const POLICY_CHANGE_FILE = path.join(POLICY_CHANGE_DIR, 'policy-change-requests.jsonl');

function ensurePolicyDir() {
  if (!fs.existsSync(POLICY_CHANGE_DIR)) {
    fs.mkdirSync(POLICY_CHANGE_DIR, { recursive: true });
  }
}

function hashText(input) {
  return crypto.createHash('sha256').update(String(input || ''), 'utf8').digest('hex');
}

function getConfiguredApprovers() {
  return {
    approverA: process.env.PEARL_POLICY_APPROVER_A_NAME || 'approver_a',
    approverB: process.env.PEARL_POLICY_APPROVER_B_NAME || 'approver_b',
    tokenA: process.env.PEARL_POLICY_APPROVER_A_TOKEN || '',
    tokenB: process.env.PEARL_POLICY_APPROVER_B_TOKEN || ''
  };
}

function validateDualApproval(input) {
  const cfg = getConfiguredApprovers();
  const errors = [];

  if (!cfg.tokenA || !cfg.tokenB) {
    errors.push('dual-approval tokens are not configured');
  }

  const nameA = String(input.approver_a_name || '').trim();
  const nameB = String(input.approver_b_name || '').trim();
  const tokenA = String(input.approver_a_token || '').trim();
  const tokenB = String(input.approver_b_token || '').trim();

  if (!nameA || !nameB) {
    errors.push('both approver names are required');
  }
  if (nameA && nameB && nameA.toLowerCase() === nameB.toLowerCase()) {
    errors.push('approvers must be distinct humans');
  }

  if (nameA && nameA !== cfg.approverA) {
    errors.push('approver A name mismatch');
  }
  if (nameB && nameB !== cfg.approverB) {
    errors.push('approver B name mismatch');
  }
  if (tokenA !== cfg.tokenA) {
    errors.push('approver A token mismatch');
  }
  if (tokenB !== cfg.tokenB) {
    errors.push('approver B token mismatch');
  }

  return {
    approved: errors.length === 0,
    errors,
    approvers: {
      approverA: cfg.approverA,
      approverB: cfg.approverB
    }
  };
}

function writePolicyChangeRequest(record) {
  ensurePolicyDir();
  fs.appendFileSync(POLICY_CHANGE_FILE, JSON.stringify(record) + '\n', 'utf8');
}

function createPolicyChangeRecord(input) {
  const now = new Date().toISOString();
  const payload = {
    id: crypto.randomUUID(),
    created_at: now,
    status: 'approved_for_review',
    requested_by: String(input.requested_by || 'unknown').trim(),
    summary: String(input.summary || '').trim(),
    rationale: String(input.rationale || '').trim(),
    affected_documents: Array.isArray(input.affected_documents) ? input.affected_documents : [],
    current_policy_hash: hashText(String(input.current_policy_text || '')),
    approvals: [
      {
        name: String(input.approver_a_name || '').trim(),
        approved_at: now
      },
      {
        name: String(input.approver_b_name || '').trim(),
        approved_at: now
      }
    ]
  };

  writePolicyChangeRequest(payload);
  return payload;
}

module.exports = {
  validateDualApproval,
  createPolicyChangeRecord,
  hashText,
  getConfiguredApprovers
};
