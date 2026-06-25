const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const jobs = require('./server/services/implementationJobService');
const changes = require('./server/services/codeChangeService');
const tools = require('./server/services/registerDeveloperTools');

test('implementation jobs persist checkpoints and final reports', () => {
  const job = jobs.create({ title: 'Build integration', objective: 'Create a safe Unity bridge.', conversationId: 'test-conversation' });
  jobs.checkpoint({ jobId: job.id, status: 'analyzing', summary: 'Located the integration boundary.', evidence: 'Assets/Tools/Editor' });
  const final = jobs.checkpoint({
    jobId: job.id, status: 'awaiting_commit_approval', summary: 'Implementation and tests complete.',
    files: ['assets/Tools/Editor/PackageManagerIntegration.cs'], tests: [{ name: 'compile', status: 'passed' }],
    proposedCommitMessage: 'Add package manager integration'
  });
  assert.equal(final.status, 'awaiting_commit_approval');
  assert.deepEqual(final.changed_files, ['assets/Tools/Editor/PackageManagerIntegration.cs']);
  assert.equal(jobs.read(job.id).proposed_commit_message, 'Add package manager integration');
});

test('code writes require fingerprint-bound human approval', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-code-'));
  process.env.PEARL_REPO_ROOTS = root;
  process.env.PEARL_APPROVAL_TOKEN = 'test-approval';
  const job = jobs.create({ title: 'Write file', objective: 'Create an ordinary implementation file.' });
  const proposal = changes.propose({ jobId: job.id, filePath: 'Assets/Tools/Editor/TestIntegration.cs', content: 'class TestIntegration {}\n' });
  assert.equal(proposal.status, 'pending_human_approval');
  assert.throws(() => changes.approve({ proposalId: proposal.id, confirmedFingerprint: 'wrong', approvalToken: 'test-approval', approvedBy: 'tester' }), /fingerprint/i);
  changes.approve({ proposalId: proposal.id, confirmedFingerprint: proposal.fingerprint, approvalToken: 'test-approval', approvedBy: 'tester' });
  changes.apply({ proposalId: proposal.id });
  assert.equal(fs.readFileSync(path.join(root, 'Assets/Tools/Editor/TestIntegration.cs'), 'utf8'), 'class TestIntegration {}\n');
});

test('directive and secret paths remain protected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-protected-'));
  process.env.PEARL_REPO_ROOTS = root;
  const job = jobs.create({ title: 'Protected write', objective: 'Verify protection.' });
  assert.throws(() => changes.propose({ jobId: job.id, filePath: 'pipeline/unity_bridge/PEARL_PRIME_DIRECTIVES.md', content: 'changed' }), /Protected path/);
  assert.throws(() => changes.propose({ jobId: job.id, filePath: '.env', content: 'SECRET=x' }), /Protected path/);
});

test('developer tools expose durable operations and proposal rediscovery', () => {
  const names = tools.TOOL_DEFINITIONS.map(entry => entry.function.name);
  assert.equal(tools.MAX_AGENT_ITERATIONS, 20);
  assert.equal(names.includes('pearl_create_implementation_job'), true);
  assert.equal(names.includes('pearl_checkpoint_implementation_job'), true);
  assert.equal(names.includes('pearl_propose_code_write'), true);
  assert.equal(names.includes('pearl_list_code_proposals'), true);
  assert.equal(names.includes('pearl_apply_approved_code_write'), true);
});
