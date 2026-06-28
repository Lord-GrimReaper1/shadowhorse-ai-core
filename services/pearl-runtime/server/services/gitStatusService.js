'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const repoContextService = require('./repoContextService');

const DEFAULT_TIMEOUT_MS = 8000;

function runGit(repoRoot, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    return {
      ok: true,
      stdout: execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: timeoutMs,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || error.message || '').trim(),
      code: error.status || null
    };
  }
}

function resolveRepoRoot(repoHint) {
  const allowedRoots = repoContextService.resolveAllowedRepoRoots();
  return repoContextService.resolveRepoRoot(repoHint, allowedRoots);
}

function isGitRepo(repoRoot) {
  if (!repoRoot || !fs.existsSync(repoRoot)) {
    return false;
  }
  const gitDir = path.join(repoRoot, '.git');
  if (fs.existsSync(gitDir)) {
    return true;
  }
  const result = runGit(repoRoot, ['rev-parse', '--is-inside-work-tree'], 3000);
  return result.ok && result.stdout === 'true';
}

function getCurrentBranch(repoRoot) {
  const branch = runGit(repoRoot, ['branch', '--show-current'], 3000);
  if (branch.ok && branch.stdout) {
    return branch.stdout;
  }
  const ref = runGit(repoRoot, ['rev-parse', '--short', 'HEAD'], 3000);
  return ref.ok ? `detached:${ref.stdout}` : null;
}

function getUpstream(repoRoot) {
  const upstream = runGit(repoRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], 3000);
  return upstream.ok && upstream.stdout ? upstream.stdout : null;
}

function parseCommitLines(raw) {
  if (!raw) {
    return [];
  }
  return raw.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [sha, ...messageParts] = line.split(/\s+/);
      return { sha, message: messageParts.join(' ') };
    });
}

function checkCommit(repoRoot, commit) {
  if (!commit || typeof commit !== 'string') {
    return null;
  }
  const safeCommit = commit.trim();
  if (!/^[a-f0-9]{6,40}$/i.test(safeCommit)) {
    return { commit: safeCommit, valid: false, present_locally: false };
  }
  const exists = runGit(repoRoot, ['cat-file', '-e', `${safeCommit}^{commit}`], 3000);
  if (!exists.ok) {
    return { commit: safeCommit, valid: true, present_locally: false };
  }
  const ancestor = runGit(repoRoot, ['merge-base', '--is-ancestor', safeCommit, 'HEAD'], 3000);
  return {
    commit: safeCommit,
    valid: true,
    present_locally: ancestor.ok,
    object_exists: true
  };
}

function getStatus({ repoHint, fetchRemote = false, remote = 'origin', maxCommits = 10, commit } = {}) {
  const repoRoot = resolveRepoRoot(repoHint);
  if (!repoRoot) {
    return { error: 'No allowed repo root found.', repo_hint: repoHint || null };
  }
  if (!isGitRepo(repoRoot)) {
    return { error: 'Allowed repo root is not a Git working tree.', repo_root: repoRoot };
  }

  const branch = getCurrentBranch(repoRoot);
  const upstream = getUpstream(repoRoot);
  const safeMax = Math.min(Math.max(1, Number(maxCommits) || 10), 30);
  const result = {
    repo_root: repoRoot,
    repo_name: path.basename(repoRoot),
    branch,
    upstream,
    fetched: false
  };

  if (fetchRemote) {
    const fetchResult = runGit(repoRoot, ['fetch', String(remote || 'origin')], DEFAULT_TIMEOUT_MS);
    result.fetched = fetchResult.ok;
    if (!fetchResult.ok) {
      result.fetch_error = fetchResult.stderr || fetchResult.stdout || 'Git fetch failed.';
    }
  }

  const status = runGit(repoRoot, ['status', '--short', '--branch'], 4000);
  result.status_text = status.ok ? status.stdout : '';
  if (!status.ok) {
    result.status_error = status.stderr || status.stdout || 'Git status failed.';
  }

  const aheadBehind = upstream || `${remote}/${branch || 'main'}`;
  const remoteOnly = runGit(repoRoot, ['log', '--oneline', `HEAD..${aheadBehind}`, `-${safeMax}`], 5000);
  const localOnly = runGit(repoRoot, ['log', '--oneline', `${aheadBehind}..HEAD`, `-${safeMax}`], 5000);

  result.remote_commits_not_local = remoteOnly.ok ? parseCommitLines(remoteOnly.stdout) : [];
  result.local_commits_not_remote = localOnly.ok ? parseCommitLines(localOnly.stdout) : [];
  result.remote_compare_ref = aheadBehind;
  result.remote_compare_error = remoteOnly.ok ? null : (remoteOnly.stderr || remoteOnly.stdout || null);
  result.local_compare_error = localOnly.ok ? null : (localOnly.stderr || localOnly.stdout || null);
  result.commit_check = checkCommit(repoRoot, commit);
  result.synced =
    result.remote_commits_not_local.length === 0 &&
    result.local_commits_not_remote.length === 0 &&
    !result.remote_compare_error &&
    !result.local_compare_error;

  return result;
}

module.exports = {
  getStatus,
  isGitRepo,
  parseCommitLines
};
