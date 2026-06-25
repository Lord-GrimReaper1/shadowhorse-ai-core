'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repoContextService = require('./repoContextService');
const jobs = require('./implementationJobService');

const PROPOSAL_DIR = path.join(__dirname, '..', 'data', 'code-proposals');
const PROTECTED_FRAGMENTS = [
  '/.git/', '/.env', '/secrets/', '/credentials/',
  '/pipeline/unity_bridge/pearl_prime_directives.md',
  '/pipeline/middleware/nodejs/server/services/policyguardrails.js',
  '/pipeline/middleware/nodejs/server/services/policychangecontrol.js',
  '/docs/shadowhorse/',
  '/docs/policy/',
  '/src/policy/',
  '/services/pearl-runtime/server/services/policyguardrails.js',
  '/services/pearl-runtime/server/services/policychangecontrol.js'
];

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function ensureDirectory() { fs.mkdirSync(PROPOSAL_DIR, { recursive: true }); }
function proposalPath(id) { return path.join(PROPOSAL_DIR, `code-proposal_${id}.json`); }
function save(proposal) {
  ensureDirectory();
  const target = proposalPath(proposal.id);
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return proposal;
}

function resolveTarget(repoHint, relativePath) {
  const root = repoContextService.resolveRepoRoot(repoHint, repoContextService.resolveAllowedRepoRoots());
  if (!root) throw new Error('No allowed repository root found.');
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(root, String(relativePath || ''));
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Path traversal blocked.');
  const normalized = `/${path.relative(resolvedRoot, target).replace(/\\/g, '/').toLowerCase()}`;
  if (PROTECTED_FRAGMENTS.some(fragment => normalized.includes(fragment))) throw new Error(`Protected path cannot be changed: ${relativePath}`);
  return { root: resolvedRoot, target };
}

function publicProposal(proposal) {
  const { content, root, target, ...safe } = proposal;
  return safe;
}

function requireProposal(id) {
  const target = proposalPath(String(id || ''));
  if (!fs.existsSync(target)) throw new Error(`Unknown code proposal: ${id}`);
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function propose({ jobId, repoHint, filePath, content, rationale = '' } = {}) {
  jobs.read(jobId);
  if (!filePath || typeof content !== 'string') throw new Error('file_path and content are required.');
  const resolved = resolveTarget(repoHint, filePath);
  const current = fs.existsSync(resolved.target) ? fs.readFileSync(resolved.target, 'utf8') : null;
  const data = {
    id: crypto.randomUUID(), job_id: jobId, repo_hint: repoHint || null,
    file_path: path.relative(resolved.root, resolved.target).replace(/\\/g, '/'),
    previous_sha256: current === null ? null : sha256(current), proposed_sha256: sha256(content),
    rationale: String(rationale || '').trim(), created_at: new Date().toISOString()
  };
  const proposal = save({
    ...data, fingerprint: sha256(JSON.stringify(data)), status: 'pending_human_approval',
    root: resolved.root, target: resolved.target, content,
    approved_by: null, approved_at: null, backup_path: null
  });
  jobs.checkpoint({ jobId, status: 'awaiting_write_approval', summary: `Code change proposed for ${data.file_path}.`, evidence: proposal.fingerprint, files: [data.file_path] });
  return publicProposal(proposal);
}

function approve({ proposalId, confirmedFingerprint, approvalToken, approvedBy } = {}) {
  const proposal = requireProposal(proposalId);
  if (!process.env.PEARL_APPROVAL_TOKEN || approvalToken !== process.env.PEARL_APPROVAL_TOKEN) throw new Error('Valid human approval token required.');
  if (confirmedFingerprint !== proposal.fingerprint) throw new Error('Proposal fingerprint does not match.');
  if (!approvedBy) throw new Error('approved_by is required.');
  if (proposal.status !== 'pending_human_approval') throw new Error(`Proposal cannot be approved from status: ${proposal.status}`);
  proposal.status = 'approved';
  proposal.approved_by = String(approvedBy).trim();
  proposal.approved_at = new Date().toISOString();
  save(proposal);
  return publicProposal(proposal);
}

function apply({ proposalId } = {}) {
  const proposal = requireProposal(proposalId);
  if (proposal.status !== 'approved') throw new Error(`Proposal is not human-approved: ${proposal.status}`);
  const current = fs.existsSync(proposal.target) ? fs.readFileSync(proposal.target, 'utf8') : null;
  if ((current === null ? null : sha256(current)) !== proposal.previous_sha256) throw new Error('Target file changed after proposal creation. Create a new proposal.');
  const backupDir = path.join(proposal.root, '.pearl-backups', proposal.job_id);
  fs.mkdirSync(path.dirname(proposal.target), { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  if (current !== null) {
    proposal.backup_path = path.join(backupDir, proposal.file_path.replace(/[\\/]/g, '__'));
    fs.writeFileSync(proposal.backup_path, current, 'utf8');
  }
  const temporary = `${proposal.target}.pearl-${proposal.id}.tmp`;
  fs.writeFileSync(temporary, proposal.content, 'utf8');
  fs.renameSync(temporary, proposal.target);
  proposal.status = 'applied';
  proposal.applied_at = new Date().toISOString();
  save(proposal);
  jobs.checkpoint({ jobId: proposal.job_id, status: 'editing', summary: `Applied approved change to ${proposal.file_path}.`, evidence: proposal.proposed_sha256, files: [proposal.file_path] });
  return publicProposal(proposal);
}

function list({ jobId } = {}) {
  ensureDirectory();
  return fs.readdirSync(PROPOSAL_DIR)
    .filter(name => name.startsWith('code-proposal_') && name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(PROPOSAL_DIR, name), 'utf8')))
    .filter(proposal => !jobId || proposal.job_id === jobId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(publicProposal);
}

module.exports = { propose, approve, apply, list };
