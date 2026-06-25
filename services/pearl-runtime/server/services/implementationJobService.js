'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const JOB_DIR = path.join(__dirname, '..', 'data', 'agent-jobs');
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const ALLOWED_STATUSES = new Set([
  'queued', 'analyzing', 'editing', 'testing', 'reviewing',
  'blocked', 'awaiting_write_approval', 'awaiting_commit_approval',
  'completed', 'failed', 'cancelled'
]);

function ensureDirectory() { fs.mkdirSync(JOB_DIR, { recursive: true }); }
function jobPath(id) { return path.join(JOB_DIR, `agent-job_${id}.json`); }

function write(job) {
  ensureDirectory();
  job.updated_at = new Date().toISOString();
  const target = jobPath(job.id);
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return job;
}

function read(id) {
  const target = jobPath(String(id || ''));
  if (!fs.existsSync(target)) throw new Error(`Unknown implementation job: ${id}`);
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function create({ title, objective, conversationId, repoHint, requestedBy = 'human', runtime } = {}) {
  if (!title || !objective) throw new Error('title and objective are required.');
  const now = new Date().toISOString();
  return write({
    id: crypto.randomUUID(), type: 'pearl_implementation',
    title: String(title).trim(), objective: String(objective).trim(),
    conversation_id: conversationId || null, repo_hint: repoHint || null,
    requested_by: requestedBy, status: 'queued', created_at: now, updated_at: now,
    checkpoints: [{ status: 'queued', summary: 'Implementation job created.', created_at: now }],
    changed_files: [], test_results: [], blockers: [], proposed_commit_message: null,
    runtime: runtime || null, final_response: null, agent_steps: []
  });
}

function checkpoint({ jobId, status, summary, evidence, files, tests, blocker, proposedCommitMessage } = {}) {
  const job = read(jobId);
  if (TERMINAL_STATUSES.has(job.status)) throw new Error(`Job is already terminal: ${job.status}`);
  if (!ALLOWED_STATUSES.has(status)) throw new Error(`Unsupported job status: ${status}`);
  if (!summary) throw new Error('checkpoint summary is required.');
  const item = { status, summary: String(summary).trim(), evidence: evidence ? String(evidence).trim() : null, created_at: new Date().toISOString() };
  job.status = status;
  job.checkpoints.push(item);
  if (Array.isArray(files)) job.changed_files = Array.from(new Set([...job.changed_files, ...files.map(String)]));
  if (Array.isArray(tests)) job.test_results.push(...tests);
  if (blocker) job.blockers.push({ summary: String(blocker), created_at: item.created_at });
  if (proposedCommitMessage) job.proposed_commit_message = String(proposedCommitMessage).trim();
  return write(job);
}

function patch(jobId, values = {}) {
  const job = read(jobId);
  const immutable = new Set(['id', 'created_at', 'type']);
  for (const [key, value] of Object.entries(values)) {
    if (!immutable.has(key)) job[key] = value;
  }
  return write(job);
}

function list({ limit = 20, conversationId, runtimeOnly = false } = {}) {
  ensureDirectory();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  return fs.readdirSync(JOB_DIR)
    .filter(name => name.startsWith('agent-job_') && name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(JOB_DIR, name), 'utf8')))
    .filter(job => !conversationId || job.conversation_id === conversationId)
    .filter(job => !runtimeOnly || job.runtime?.enabled === true)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, safeLimit);
}

module.exports = { create, checkpoint, patch, read, list, ALLOWED_STATUSES, TERMINAL_STATUSES };
