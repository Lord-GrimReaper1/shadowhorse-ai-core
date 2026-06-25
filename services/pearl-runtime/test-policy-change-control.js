const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const policyChangeControl = require('./server/services/policyChangeControl');

test('Policy change control - rejects when approvers are not distinct', () => {
  process.env.PEARL_POLICY_APPROVER_A_NAME = 'alice';
  process.env.PEARL_POLICY_APPROVER_B_NAME = 'bob';
  process.env.PEARL_POLICY_APPROVER_A_TOKEN = 'tokA';
  process.env.PEARL_POLICY_APPROVER_B_TOKEN = 'tokB';

  const result = policyChangeControl.validateDualApproval({
    approver_a_name: 'alice',
    approver_a_token: 'tokA',
    approver_b_name: 'alice',
    approver_b_token: 'tokB'
  });

  assert.strictEqual(result.approved, false);
  assert(result.errors.some(e => e.includes('distinct')));
});

test('Policy change control - approves valid dual signatures', () => {
  process.env.PEARL_POLICY_APPROVER_A_NAME = 'alice';
  process.env.PEARL_POLICY_APPROVER_B_NAME = 'bob';
  process.env.PEARL_POLICY_APPROVER_A_TOKEN = 'tokA';
  process.env.PEARL_POLICY_APPROVER_B_TOKEN = 'tokB';

  const result = policyChangeControl.validateDualApproval({
    approver_a_name: 'alice',
    approver_a_token: 'tokA',
    approver_b_name: 'bob',
    approver_b_token: 'tokB'
  });

  assert.strictEqual(result.approved, true);
  assert.strictEqual(result.errors.length, 0);
});

test('Policy change control - creates auditable request record', () => {
  process.env.PEARL_POLICY_APPROVER_A_NAME = 'alice';
  process.env.PEARL_POLICY_APPROVER_B_NAME = 'bob';
  process.env.PEARL_POLICY_APPROVER_A_TOKEN = 'tokA';
  process.env.PEARL_POLICY_APPROVER_B_TOKEN = 'tokB';

  const record = policyChangeControl.createPolicyChangeRecord({
    requested_by: 'michael',
    summary: 'Tighten policy language for directive integrity',
    rationale: 'Reduce ambiguity in refusal logic',
    affected_documents: ['pipeline/unity_bridge/PEARL_PRIME_DIRECTIVES.md'],
    current_policy_text: 'policy text snapshot',
    approver_a_name: 'alice',
    approver_b_name: 'bob'
  });

  assert(record.id);
  assert.strictEqual(record.status, 'approved_for_review');
  assert.strictEqual(record.approvals.length, 2);
  assert(record.current_policy_hash);

  const policyDir = path.join(__dirname, 'server', 'data', 'policy');
  const policyFile = path.join(policyDir, 'policy-change-requests.jsonl');
  assert(fs.existsSync(policyFile));
});
