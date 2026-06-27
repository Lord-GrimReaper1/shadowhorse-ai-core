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

test('simple conversational objectives stay in chat-only runtime', () => {
  assert.equal(runtime.isLikelyChatOnlyObjective('List your prime directives'), true);
  assert.equal(runtime.isLikelyChatOnlyObjective('What do you think about this approach?'), true);
  assert.equal(runtime.isLikelyChatOnlyObjective('Explain your limitations clearly.'), true);
  assert.equal(runtime.isLikelyChatOnlyObjective('Pearl, repeat the answer to my last question again, please.'), true);
  assert.equal(runtime.isLikelyChatOnlyObjective('Bro, tell me what the process is if one of your Prime Directive needs an update.'), true);
  assert.equal(runtime.isLikelyChatOnlyObjective('Perot, how many humans does it take to approve a prime directive change?'), true);
  assert.equal(runtime.isLikelyChatOnlyObjective('Who is required to approve a Prime Directive change?'), true);

  const job = runtime.enqueue({ title: 'Prime directives', objective: 'List your prime directives', includeRepoContext: true });
  assert.equal(job.runtime.chat_only, true);
  assert.equal(job.runtime.include_repo_context, false);
});

test('implementation and project status objectives still use durable agent work', () => {
  assert.equal(runtime.isLikelyChatOnlyObjective('Where do we stand on the Unity Package Manager work?'), false);
  assert.equal(runtime.isLikelyChatOnlyObjective('Update the microphone icon and fix speech to text.'), false);
  assert.equal(runtime.isLikelyChatOnlyObjective('Inspect the repo and tell me what code is left.'), false);
  assert.equal(runtime.isLikelyChatOnlyObjective('Update the file that stores Pearl runtime routing.'), false);

  const job = runtime.enqueue({ title: 'Package status', objective: 'Where do we stand on the Unity Package Manager work?' });
  assert.equal(job.runtime.chat_only, false);
  assert.equal(job.runtime.include_repo_context, true);
});

test('chat-only runtime payload disables tools and repository scans', () => {
  const job = runtime.enqueue({ title: 'Question', objective: 'What are your prime directives?', conversationId: 'chat-runtime-test' });
  const payload = runtime.buildChatOnlyPayload(job, job.runtime);
  assert.equal(payload.prompt, 'What are your prime directives?');
  assert.equal(payload.conversation_id, 'chat-runtime-test');
  assert.equal(payload.include_repo_context, false);
  assert.equal(payload.enable_agent_mode, false);
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
  assert.match(instruction, /Do not include sections named Evidence and Analysis/i);
});

test('research completes without a false commit approval gate', () => {
  assert.equal(runtime.completionStatus({ changed_files: [] }), 'completed');
  assert.equal(runtime.completionStatus({ changed_files: ['Assets/Test.cs'] }), 'awaiting_commit_approval');
});
