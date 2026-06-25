const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoContextService = require('./server/services/repoContextService');
const packageManager = require('./server/services/unityPackageManager');

const originalResolveAllowedRepoRoots = repoContextService.resolveAllowedRepoRoots;
const originalResolveRepoRoot = repoContextService.resolveRepoRoot;
const originalApprovalToken = process.env.PEARL_APPROVAL_TOKEN;

function createUnityProject(dependencies = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-unity-packages-'));
  const packages = path.join(root, 'Packages');
  fs.mkdirSync(packages, { recursive: true });
  fs.writeFileSync(path.join(packages, 'manifest.json'), `${JSON.stringify({ dependencies }, null, 2)}\n`, 'utf8');
  repoContextService.resolveAllowedRepoRoots = () => [root];
  repoContextService.resolveRepoRoot = () => root;
  process.env.PEARL_APPROVAL_TOKEN = 'human-approved';
  return root;
}

function approve(proposal, intent = 'apply') {
  return packageManager.approvePackageChange({
    proposalId: proposal.id,
    confirmedFingerprint: proposal.fingerprint,
    approvalToken: 'human-approved',
    approvedBy: 'studio-owner',
    intent
  });
}

afterEach(() => {
  repoContextService.resolveAllowedRepoRoots = originalResolveAllowedRepoRoots;
  repoContextService.resolveRepoRoot = originalResolveRepoRoot;
  packageManager.clearProposals();
  if (originalApprovalToken === undefined) delete process.env.PEARL_APPROVAL_TOKEN;
  else process.env.PEARL_APPROVAL_TOKEN = originalApprovalToken;
});

test('Unity packages can be listed without approval', () => {
  createUnityProject({ 'com.unity.inputsystem': '1.18.0' });
  const result = packageManager.listPackages();
  assert.equal(result.package_count, 1);
  assert.deepEqual(result.packages[0], { name: 'com.unity.inputsystem', version: '1.18.0' });
});

test('package proposal does not write before approval', () => {
  const root = createUnityProject({});
  const proposal = packageManager.proposePackageChange({ action: 'add', packageName: 'com.unity.test-framework', version: '1.4.6' });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'Packages', 'manifest.json'), 'utf8'));
  assert.equal(manifest.dependencies['com.unity.test-framework'], undefined);
  assert.equal(proposal.status, 'pending_human_approval');
});

test('Pearl cannot apply a package proposal before separate human approval', () => {
  createUnityProject({});
  const proposal = packageManager.proposePackageChange({ action: 'add', packageName: 'com.unity.test-framework', version: '1.4.6' });
  assert.throws(() => packageManager.applyApprovedPackageChange({ proposalId: proposal.id }), /not human-approved/);
});

test('approved package proposal updates manifest and creates backup', () => {
  const root = createUnityProject({});
  const proposal = packageManager.proposePackageChange({ action: 'add', packageName: 'com.unity.test-framework', version: '1.4.6' });
  approve(proposal);
  const result = packageManager.applyApprovedPackageChange({ proposalId: proposal.id });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'Packages', 'manifest.json'), 'utf8'));
  assert.equal(manifest.dependencies['com.unity.test-framework'], '1.4.6');
  assert.equal(fs.existsSync(result.proposal.backup_path), true);
  assert.equal(result.unity_resolution_required, true);
});

test('invalid approval token cannot approve package proposal', () => {
  createUnityProject({});
  const proposal = packageManager.proposePackageChange({ action: 'add', packageName: 'com.unity.test-framework', version: '1.4.6' });
  assert.throws(() => packageManager.approvePackageChange({
    proposalId: proposal.id,
    confirmedFingerprint: proposal.fingerprint,
    approvalToken: 'wrong',
    approvedBy: 'studio-owner'
  }), /approval token/);
});

test('protected Pearl packages cannot be removed', () => {
  createUnityProject({ 'com.unity.ai.assistant': '2.12.0-pre.2' });
  assert.throws(() => packageManager.proposePackageChange({ action: 'remove', packageName: 'com.unity.ai.assistant' }), /Protected Pearl package/);
});

test('applied package proposal requires separate rollback approval', () => {
  const root = createUnityProject({});
  const proposal = packageManager.proposePackageChange({ action: 'add', packageName: 'com.unity.test-framework', version: '1.4.6' });
  approve(proposal);
  packageManager.applyApprovedPackageChange({ proposalId: proposal.id });
  assert.throws(() => packageManager.rollbackApprovedPackageChange({ proposalId: proposal.id }), /not human-approved for rollback/);
  approve(proposal, 'rollback');
  packageManager.rollbackApprovedPackageChange({ proposalId: proposal.id });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'Packages', 'manifest.json'), 'utf8'));
  assert.equal(manifest.dependencies['com.unity.test-framework'], undefined);
});
