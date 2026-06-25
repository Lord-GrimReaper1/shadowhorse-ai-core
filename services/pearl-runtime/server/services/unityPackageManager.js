'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repoContextService = require('./repoContextService');

const PACKAGE_NAME_PATTERN = /^com\.[a-z0-9][a-z0-9._-]*$/;
const REGISTRY_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const PROTECTED_REMOVALS = new Set([
  'com.unity.ai.assistant',
  'com.unity.ai.inference'
]);
const proposals = new Map();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolveProjectRoot(repoHint) {
  const allowedRoots = repoContextService.resolveAllowedRepoRoots();
  const root = repoContextService.resolveRepoRoot(repoHint, allowedRoots);
  if (!root) {
    throw new Error('No allowed Unity project root found.');
  }
  return path.resolve(root);
}

function manifestPath(projectRoot) {
  return path.join(projectRoot, 'Packages', 'manifest.json');
}

function readManifest(projectRoot) {
  const filePath = manifestPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error('Unity Packages/manifest.json was not found.');
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!manifest.dependencies || typeof manifest.dependencies !== 'object' || Array.isArray(manifest.dependencies)) {
    throw new Error('Unity package manifest must contain a dependencies object.');
  }
  return { filePath, raw, manifest };
}

function validatePackageName(packageName) {
  const normalized = String(packageName || '').trim().toLowerCase();
  if (!PACKAGE_NAME_PATTERN.test(normalized)) {
    throw new Error('Only Unity registry package names such as com.vendor.package are supported.');
  }
  return normalized;
}

function validateRegistryVersion(version) {
  const normalized = String(version || '').trim();
  if (!REGISTRY_VERSION_PATTERN.test(normalized)) {
    throw new Error('Only Unity registry package versions are supported in V1.');
  }
  return normalized;
}

function publicProposal(proposal) {
  return {
    id: proposal.id,
    action: proposal.action,
    package_name: proposal.package_name,
    previous_version: proposal.previous_version,
    requested_version: proposal.requested_version,
    rationale: proposal.rationale,
    manifest_sha256: proposal.manifest_sha256,
    fingerprint: proposal.fingerprint,
    status: proposal.status,
    created_at: proposal.created_at,
    approved_by: proposal.approved_by || null,
    approved_at: proposal.approved_at || null,
    applied_at: proposal.applied_at || null,
    rolled_back_at: proposal.rolled_back_at || null,
    backup_path: proposal.backup_path || null
  };
}

function listPackages({ repoHint } = {}) {
  const projectRoot = resolveProjectRoot(repoHint);
  const { manifest } = readManifest(projectRoot);
  const packages = Object.entries(manifest.dependencies)
    .map(([name, version]) => ({ name, version }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    project_root: projectRoot,
    manifest: 'Packages/manifest.json',
    package_count: packages.length,
    packages
  };
}

function proposePackageChange({ action, packageName, version, rationale = '', repoHint } = {}) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['add', 'update', 'remove'].includes(normalizedAction)) {
    throw new Error('Package action must be add, update, or remove.');
  }
  const normalizedName = validatePackageName(packageName);
  if (normalizedAction === 'remove' && PROTECTED_REMOVALS.has(normalizedName)) {
    throw new Error(`Protected Pearl package cannot be removed: ${normalizedName}`);
  }
  const normalizedVersion = normalizedAction === 'remove' ? null : validateRegistryVersion(version);
  const projectRoot = resolveProjectRoot(repoHint);
  const { raw, manifest } = readManifest(projectRoot);
  const currentVersion = manifest.dependencies[normalizedName] || null;

  if (normalizedAction === 'add' && currentVersion !== null) throw new Error(`Package is already installed; use update: ${normalizedName}`);
  if (normalizedAction === 'update' && currentVersion === null) throw new Error(`Package is not installed; use add: ${normalizedName}`);
  if (normalizedAction === 'remove' && currentVersion === null) throw new Error(`Package is not installed: ${normalizedName}`);
  if (normalizedAction === 'update' && currentVersion === normalizedVersion) throw new Error(`Package already uses version ${normalizedVersion}.`);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const proposalData = {
    id,
    action: normalizedAction,
    package_name: normalizedName,
    previous_version: currentVersion,
    requested_version: normalizedVersion,
    rationale: String(rationale || '').trim(),
    project_root: projectRoot,
    manifest_sha256: sha256(raw),
    created_at: createdAt
  };
  const proposal = {
    ...proposalData,
    fingerprint: sha256(JSON.stringify(proposalData)),
    status: 'pending_human_approval',
    approved_by: null,
    approved_at: null,
    applied_at: null,
    backup_path: null,
    rolled_back_at: null
  };
  proposals.set(id, proposal);
  return publicProposal(proposal);
}

function requireProposal(proposalId) {
  const proposal = proposals.get(String(proposalId || ''));
  if (!proposal) throw new Error(`Unknown Unity package proposal: ${proposalId}`);
  return proposal;
}

function approvePackageChange({ proposalId, confirmedFingerprint, approvalToken, approvedBy, intent = 'apply' }) {
  const proposal = requireProposal(proposalId);
  const approvalSecret = process.env.PEARL_APPROVAL_TOKEN;
  if (!approvalSecret) throw new Error('PEARL_APPROVAL_TOKEN must be configured before package changes can run.');
  if (!approvalToken || approvalToken !== approvalSecret) throw new Error('Valid human approval token required.');
  if (!approvedBy || typeof approvedBy !== 'string') throw new Error('approvedBy is required.');
  if (confirmedFingerprint !== proposal.fingerprint) throw new Error('Confirmed proposal fingerprint does not match.');

  if (intent === 'apply') {
    if (proposal.status !== 'pending_human_approval') throw new Error(`Proposal cannot be approved from status: ${proposal.status}`);
    proposal.status = 'approved';
  } else if (intent === 'rollback') {
    if (proposal.status !== 'applied') throw new Error(`Rollback cannot be approved from status: ${proposal.status}`);
    proposal.status = 'rollback_approved';
  } else {
    throw new Error('Approval intent must be apply or rollback.');
  }

  proposal.approved_by = approvedBy.trim();
  proposal.approved_at = new Date().toISOString();
  return publicProposal(proposal);
}

function applyApprovedPackageChange({ proposalId }) {
  const proposal = requireProposal(proposalId);
  if (proposal.status !== 'approved') throw new Error(`Proposal is not human-approved: ${proposal.status}`);
  const { filePath, raw, manifest } = readManifest(proposal.project_root);
  if (sha256(raw) !== proposal.manifest_sha256) throw new Error('Unity package manifest changed after this proposal was created. Create a new proposal.');
  const currentVersion = manifest.dependencies[proposal.package_name] || null;
  if (currentVersion !== proposal.previous_version) throw new Error('Package state changed after this proposal was created. Create a new proposal.');

  if (proposal.action === 'remove') delete manifest.dependencies[proposal.package_name];
  else manifest.dependencies[proposal.package_name] = proposal.requested_version;

  const orderedDependencies = Object.fromEntries(Object.entries(manifest.dependencies).sort(([left], [right]) => left.localeCompare(right)));
  const nextManifest = `${JSON.stringify({ ...manifest, dependencies: orderedDependencies }, null, 2)}\n`;
  const backupDirectory = path.join(proposal.project_root, 'Packages', '.pearl-backups');
  const backupPath = path.join(backupDirectory, `manifest.${proposal.id}.json`);
  fs.mkdirSync(backupDirectory, { recursive: true });
  fs.writeFileSync(backupPath, raw, 'utf8');
  const temporaryPath = `${filePath}.pearl-${proposal.id}.tmp`;
  fs.writeFileSync(temporaryPath, nextManifest, 'utf8');
  fs.renameSync(temporaryPath, filePath);

  proposal.status = 'applied';
  proposal.applied_at = new Date().toISOString();
  proposal.backup_path = backupPath;
  return {
    proposal: publicProposal(proposal),
    manifest: 'Packages/manifest.json',
    packages_lock_managed_by_unity: true,
    unity_resolution_required: true,
    message: 'Package manifest updated. Unity must resolve packages and compile before the change is considered verified.'
  };
}

function rollbackApprovedPackageChange({ proposalId }) {
  const proposal = requireProposal(proposalId);
  if (proposal.status !== 'rollback_approved' || !proposal.backup_path) throw new Error('Proposal is not human-approved for rollback.');
  const filePath = manifestPath(proposal.project_root);
  const backup = fs.readFileSync(proposal.backup_path, 'utf8');
  const temporaryPath = `${filePath}.pearl-rollback-${proposal.id}.tmp`;
  fs.writeFileSync(temporaryPath, backup, 'utf8');
  fs.renameSync(temporaryPath, filePath);
  proposal.status = 'rolled_back';
  proposal.rolled_back_at = new Date().toISOString();
  return { proposal: publicProposal(proposal), manifest: 'Packages/manifest.json', unity_resolution_required: true };
}

function listProposals() {
  return Array.from(proposals.values()).map(publicProposal);
}

function clearProposals() {
  proposals.clear();
}

module.exports = {
  listPackages,
  proposePackageChange,
  approvePackageChange,
  applyApprovedPackageChange,
  rollbackApprovedPackageChange,
  listProposals,
  clearProposals
};
