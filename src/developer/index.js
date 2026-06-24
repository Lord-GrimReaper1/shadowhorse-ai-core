import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_PROTECTED_PATHS = Object.freeze([
  /^src\/policy(?:\/|$)/i,
  /^docs\/shadowhorse\/shadowhorse_canon/i,
  /^docs\/shadowhorse\/enforcement_matrix/i,
  /(?:^|\/)pearl_prime_directives\.md$/i,
  /(?:^|\/)prime_directives?(?:\/|\.|$)/i,
  /(?:^|\/)\.env(?:\.|$)/i,
  /(?:^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeRelativePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/');
}

function assertRelativePath(value) {
  const normalized = normalizeRelativePath(value);
  if (!normalized || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) {
    throw new Error('Operation path must be relative to the workspace root.');
  }
  if (normalized.split('/').includes('..')) {
    throw new Error('Path traversal is not permitted.');
  }
  return normalized;
}

function validateOperation(operation) {
  if (!operation || operation.type !== 'write_file') {
    throw new Error('Developer Mode V1 supports write_file operations only.');
  }

  const filePath = assertRelativePath(operation.path);
  if (typeof operation.content !== 'string') {
    throw new Error(`write_file content must be a string: ${filePath}`);
  }

  return {
    type: 'write_file',
    path: filePath,
    content: operation.content,
    expected_sha256: operation.expected_sha256 || null
  };
}

async function readOptionalFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export class DeveloperMode {
  constructor({ protectedPaths = DEFAULT_PROTECTED_PATHS, now = () => new Date() } = {}) {
    this.protectedPaths = [...protectedPaths];
    this.now = now;
    this.proposals = new Map();
  }

  isProtectedPath(filePath) {
    const normalized = assertRelativePath(filePath);
    return this.protectedPaths.some((pattern) => pattern.test(normalized));
  }

  proposeChange({ requestedBy = 'unknown', summary, rationale = '', operations }) {
    if (!summary || typeof summary !== 'string') {
      throw new Error('Change proposal summary is required.');
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('At least one change operation is required.');
    }

    const normalizedOperations = operations.map(validateOperation);
    const protectedTargets = normalizedOperations
      .map((operation) => operation.path)
      .filter((filePath) => this.isProtectedPath(filePath));

    if (protectedTargets.length > 0) {
      throw new Error(`Protected paths cannot be modified: ${protectedTargets.join(', ')}`);
    }

    const id = randomUUID();
    const createdAt = this.now().toISOString();
    const fingerprint = sha256(JSON.stringify({
      id,
      requestedBy,
      summary,
      rationale,
      operations: normalizedOperations,
      createdAt
    }));

    const proposal = {
      id,
      requested_by: requestedBy,
      summary: summary.trim(),
      rationale: String(rationale || '').trim(),
      operations: normalizedOperations,
      fingerprint,
      status: 'pending_human_approval',
      created_at: createdAt,
      approval: null,
      applied_at: null,
      rollback: null
    };

    this.proposals.set(id, proposal);
    return this.describeProposal(proposal);
  }

  describeProposal(proposalOrId) {
    const proposal = typeof proposalOrId === 'string'
      ? this.requireProposal(proposalOrId)
      : proposalOrId;

    return {
      id: proposal.id,
      requested_by: proposal.requested_by,
      summary: proposal.summary,
      rationale: proposal.rationale,
      operations: proposal.operations.map((operation) => ({
        type: operation.type,
        path: operation.path,
        expected_sha256: operation.expected_sha256,
        new_sha256: sha256(operation.content),
        new_size: Buffer.byteLength(operation.content, 'utf8')
      })),
      fingerprint: proposal.fingerprint,
      status: proposal.status,
      created_at: proposal.created_at,
      approved_by: proposal.approval?.approved_by || null,
      approved_at: proposal.approval?.approved_at || null,
      applied_at: proposal.applied_at
    };
  }

  listProposals() {
    return Array.from(this.proposals.values()).map((proposal) => this.describeProposal(proposal));
  }

  approveChange(proposalId, { approvedBy, confirmedFingerprint }) {
    const proposal = this.requireProposal(proposalId);
    if (proposal.status !== 'pending_human_approval') {
      throw new Error(`Proposal is not awaiting approval: ${proposal.status}`);
    }
    if (!approvedBy || typeof approvedBy !== 'string') {
      throw new Error('approvedBy is required.');
    }
    if (confirmedFingerprint !== proposal.fingerprint) {
      throw new Error('Proposal fingerprint confirmation does not match.');
    }

    const executionToken = randomUUID();
    proposal.status = 'approved';
    proposal.approval = {
      approved_by: approvedBy.trim(),
      approved_at: this.now().toISOString(),
      execution_token_hash: sha256(executionToken)
    };

    return {
      proposal: this.describeProposal(proposal),
      execution_token: executionToken
    };
  }

  async previewChange(proposalId, { workspaceRoot }) {
    const proposal = this.requireProposal(proposalId);
    const root = path.resolve(workspaceRoot);
    const changes = [];

    for (const operation of proposal.operations) {
      const absolutePath = path.resolve(root, operation.path);
      if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
        throw new Error(`Operation escaped workspace root: ${operation.path}`);
      }
      const currentContent = await readOptionalFile(absolutePath);
      changes.push({
        path: operation.path,
        exists: currentContent !== null,
        current_sha256: currentContent === null ? null : sha256(currentContent),
        new_sha256: sha256(operation.content),
        changed: currentContent !== operation.content
      });
    }

    return {
      proposal: this.describeProposal(proposal),
      changes
    };
  }

  async applyChange(proposalId, { workspaceRoot, executionToken, backupRoot }) {
    const proposal = this.requireProposal(proposalId);
    if (proposal.status !== 'approved') {
      throw new Error(`Proposal is not approved: ${proposal.status}`);
    }
    if (sha256(String(executionToken || '')) !== proposal.approval.execution_token_hash) {
      throw new Error('Execution token is invalid.');
    }

    const root = path.resolve(workspaceRoot);
    const resolvedBackupRoot = path.resolve(
      backupRoot || path.join(root, '.pearl', 'backups', proposal.id)
    );
    const rollbackEntries = [];

    for (const operation of proposal.operations) {
      if (this.isProtectedPath(operation.path)) {
        throw new Error(`Protected path cannot be modified: ${operation.path}`);
      }

      const absolutePath = path.resolve(root, operation.path);
      if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
        throw new Error(`Operation escaped workspace root: ${operation.path}`);
      }

      const currentContent = await readOptionalFile(absolutePath);
      const currentHash = currentContent === null ? null : sha256(currentContent);
      if (operation.expected_sha256 && operation.expected_sha256 !== currentHash) {
        throw new Error(`Stale file content for ${operation.path}.`);
      }

      if (currentContent !== null) {
        const backupPath = path.join(resolvedBackupRoot, operation.path);
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, currentContent, 'utf8');
        rollbackEntries.push({ path: operation.path, backup_path: backupPath, existed: true });
      } else {
        rollbackEntries.push({ path: operation.path, backup_path: null, existed: false });
      }

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      const temporaryPath = `${absolutePath}.pearl-${proposal.id}.tmp`;
      await fs.writeFile(temporaryPath, operation.content, 'utf8');
      await fs.rename(temporaryPath, absolutePath);
    }

    proposal.status = 'applied';
    proposal.applied_at = this.now().toISOString();
    proposal.rollback = {
      workspace_root: root,
      entries: rollbackEntries
    };
    proposal.approval.execution_token_hash = null;

    return {
      proposal: this.describeProposal(proposal),
      backup_root: resolvedBackupRoot,
      files_written: proposal.operations.map((operation) => operation.path)
    };
  }

  async rollbackChange(proposalId, { approvedBy }) {
    const proposal = this.requireProposal(proposalId);
    if (proposal.status !== 'applied' || !proposal.rollback) {
      throw new Error('Only applied proposals can be rolled back.');
    }
    if (!approvedBy || typeof approvedBy !== 'string') {
      throw new Error('Human approval is required for rollback.');
    }

    for (const entry of [...proposal.rollback.entries].reverse()) {
      const absolutePath = path.resolve(proposal.rollback.workspace_root, entry.path);
      if (entry.existed) {
        const backupContent = await fs.readFile(entry.backup_path, 'utf8');
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, backupContent, 'utf8');
      } else {
        await fs.rm(absolutePath, { force: true });
      }
    }

    proposal.status = 'rolled_back';
    proposal.rollback.approved_by = approvedBy.trim();
    proposal.rollback.rolled_back_at = this.now().toISOString();
    return this.describeProposal(proposal);
  }

  async runApprovedTests(proposalId, { testExecutor }) {
    const proposal = this.requireProposal(proposalId);
    if (!['approved', 'applied'].includes(proposal.status)) {
      throw new Error('Tests require an approved or applied proposal.');
    }
    if (typeof testExecutor !== 'function') {
      throw new Error('A host-controlled testExecutor function is required.');
    }

    return testExecutor({
      proposal: this.describeProposal(proposal),
      touched_paths: proposal.operations.map((operation) => operation.path)
    });
  }

  requireProposal(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Unknown proposal: ${proposalId}`);
    }
    return proposal;
  }
}

export { DEFAULT_PROTECTED_PATHS, sha256 };
