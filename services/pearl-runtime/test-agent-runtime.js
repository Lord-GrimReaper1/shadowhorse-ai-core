const { test } = require('node:test');
const assert = require('node:assert/strict');

const jobs = require('./server/services/implementationJobService');
const runtime = require('./server/services/agentRuntimeService');

test('agent runtime queues durable work with conversation identity', () => {
  const job = runtime.enqueue({
    title: 'Build runtime test', objective: 'Verify a durable queued run.', conversationId: 'runtime-test-conversation'
  });
  assert.equal(job.status, 'queued');
  assert.equal(job.runtime.enabled, true);
  assert.equal(job.runtime.state, 'queued');
  assert.equal(job.conversation_id, 'runtime-test-conversation');
  assert.equal(jobs.read(job.id).objective, 'Verify a durable queued run.');
});

test('queued agent runs can be cancelled and retried', () => {
  const job = runtime.enqueue({ title: 'Cancel test', objective: 'Verify cancellation.' });
  const cancelled = runtime.cancel(job.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.runtime.cancel_requested, true);
  const retried = runtime.retry(job.id);
  assert.equal(retried.status, 'queued');
  assert.equal(retried.runtime.state, 'queued');
  assert.equal(retried.runtime.cancel_requested, false);
});

test('expired runtime leases recover to the queue after restart', () => {
  const job = runtime.enqueue({ title: 'Recovery test', objective: 'Verify lease recovery.' });
  jobs.patch(job.id, {
    status: 'analyzing',
    runtime: { ...job.runtime, state: 'running', lease_owner: 'abandoned-worker', lease_expires_at: new Date(Date.now() - 1000).toISOString() }
  });
  runtime.recoverAbandonedRuns();
  const recovered = jobs.read(job.id);
  assert.equal(recovered.status, 'queued');
  assert.equal(recovered.runtime.state, 'queued');
  assert.equal(recovered.runtime.lease_owner, null);
});

test('human write approval can resume a waiting agent run', () => {
  const job = runtime.enqueue({ title: 'Approval resume', objective: 'Verify continuation after approval.' });
  jobs.patch(job.id, { status: 'awaiting_write_approval', runtime: { ...job.runtime, state: 'waiting_for_approval' } });
  const resumed = runtime.resume(job.id);
  assert.equal(resumed.status, 'queued');
  assert.equal(resumed.runtime.state, 'queued');
  assert.equal(resumed.runtime.finished_at, null);
});

test('runtime instructions require objective-specific repository and package evidence', () => {
  const instruction = runtime.buildRuntimeInstruction({ id: 'job-1', objective: 'Assess Unity Package Manager progress.' });
  assert.match(instruction, /search and read relevant files/i);
  assert.match(instruction, /list installed packages and package proposals/i);
  assert.match(instruction, /empty new-job proposal list.*prior project work does not exist/i);
  assert.match(instruction, /Do not ask the human to restate work/i);
});

test('runtime instructions keep internal execution out of normal conversation', () => {
  const instruction = runtime.buildRuntimeInstruction({ id: 'job-quiet', objective: 'Tell me your prime directives.' });
  assert.match(instruction, /Keep all runtime mechanics private/i);
  assert.match(instruction, /Do not narrate tool calls/i);
  assert.match(instruction, /simple informational question.*only the relevant answer/i);
  assert.match(instruction, /explicitly asks for status, audit evidence, job IDs/i);
});

test('research completes without a false commit approval gate', () => {
  assert.equal(runtime.completionStatus({ changed_files: [] }), 'completed');
  assert.equal(runtime.completionStatus({ changed_files: ['Assets/Test.cs'] }), 'awaiting_commit_approval');
});
