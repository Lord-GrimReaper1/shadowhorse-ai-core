import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DeveloperMode, sha256 } from '../src/developer/index.js';

async function createWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'pearl-developer-mode-'));
}

test('developer mode rejects protected directive paths', () => {
  const developer = new DeveloperMode();
  assert.throws(() => developer.proposeChange({
    requestedBy: 'pearl',
    summary: 'Change policy',
    operations: [{
      type: 'write_file',
      path: 'src/policy/index.js',
      content: 'unsafe'
    }]
  }), /Protected paths/);
});

test('developer mode requires fingerprint-bound human approval', async () => {
  const developer = new DeveloperMode();
  const workspace = await createWorkspace();
  const proposal = developer.proposeChange({
    requestedBy: 'pearl',
    summary: 'Add a studio helper',
    rationale: 'Reduce repetitive setup work.',
    operations: [{
      type: 'write_file',
      path: 'src/tools/helper.js',
      content: 'export const ready = true;\n'
    }]
  });

  assert.equal(proposal.status, 'pending_human_approval');
  assert.throws(() => developer.approveChange(proposal.id, {
    approvedBy: 'studio-owner',
    confirmedFingerprint: 'wrong'
  }), /fingerprint/);

  const approval = developer.approveChange(proposal.id, {
    approvedBy: 'studio-owner',
    confirmedFingerprint: proposal.fingerprint
  });
  const result = await developer.applyChange(proposal.id, {
    workspaceRoot: workspace,
    executionToken: approval.execution_token
  });

  assert.equal(result.proposal.status, 'applied');
  assert.equal(
    await fs.readFile(path.join(workspace, 'src/tools/helper.js'), 'utf8'),
    'export const ready = true;\n'
  );
});

test('developer mode rejects stale expected file hashes', async () => {
  const developer = new DeveloperMode();
  const workspace = await createWorkspace();
  const filePath = path.join(workspace, 'src/existing.js');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, 'current\n', 'utf8');

  const proposal = developer.proposeChange({
    requestedBy: 'pearl',
    summary: 'Update existing helper',
    operations: [{
      type: 'write_file',
      path: 'src/existing.js',
      content: 'new\n',
      expected_sha256: sha256('older\n')
    }]
  });
  const approval = developer.approveChange(proposal.id, {
    approvedBy: 'studio-owner',
    confirmedFingerprint: proposal.fingerprint
  });

  await assert.rejects(
    developer.applyChange(proposal.id, {
      workspaceRoot: workspace,
      executionToken: approval.execution_token
    }),
    /Stale file content/
  );
});

test('developer mode rolls applied changes back with human approval', async () => {
  const developer = new DeveloperMode();
  const workspace = await createWorkspace();
  const filePath = path.join(workspace, 'src/value.js');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, 'before\n', 'utf8');

  const proposal = developer.proposeChange({
    requestedBy: 'pearl',
    summary: 'Update a value',
    operations: [{
      type: 'write_file',
      path: 'src/value.js',
      content: 'after\n',
      expected_sha256: sha256('before\n')
    }]
  });
  const approval = developer.approveChange(proposal.id, {
    approvedBy: 'studio-owner',
    confirmedFingerprint: proposal.fingerprint
  });
  await developer.applyChange(proposal.id, {
    workspaceRoot: workspace,
    executionToken: approval.execution_token
  });
  await developer.rollbackChange(proposal.id, { approvedBy: 'studio-owner' });

  assert.equal(await fs.readFile(filePath, 'utf8'), 'before\n');
  assert.equal(developer.describeProposal(proposal.id).status, 'rolled_back');
});

test('developer mode delegates tests to a host-controlled executor', async () => {
  const developer = new DeveloperMode();
  const proposal = developer.proposeChange({
    requestedBy: 'pearl',
    summary: 'Prepare testable change',
    operations: [{
      type: 'write_file',
      path: 'src/tool.js',
      content: 'export default true;\n'
    }]
  });
  developer.approveChange(proposal.id, {
    approvedBy: 'studio-owner',
    confirmedFingerprint: proposal.fingerprint
  });

  const result = await developer.runApprovedTests(proposal.id, {
    testExecutor: async ({ touched_paths }) => ({ ok: true, touched_paths })
  });

  assert.deepEqual(result, { ok: true, touched_paths: ['src/tool.js'] });
});
