'use strict';

const express = require('express');
const packageManager = require('../services/unityPackageManager');
const jobs = require('../services/implementationJobService');
const changes = require('../services/codeChangeService');
const agentRuntime = require('../services/agentRuntimeService');
const auditService = require('../services/auditService');

const router = express.Router();

router.post('/agent-runs', (req, res) => {
  try {
    const job = agentRuntime.enqueue({
      title: req.body?.title || 'Pearl implementation run', objective: req.body?.objective,
      conversationId: req.body?.conversation_id, repoHint: req.body?.repo_hint,
      includeRepoContext: req.body?.include_repo_context !== false
    });
    auditService.writeAuditEvent({ event: 'agent_run_queued', job_id: job.id, conversation_id: job.conversation_id });
    return res.status(202).json({ accepted: true, job });
  } catch (error) { return res.status(400).json({ accepted: false, error: error.message }); }
});

router.get('/agent-runs', (req, res) => {
  try { return res.json({ jobs: jobs.list({ limit: req.query.limit, conversationId: req.query.conversation_id, runtimeOnly: true }) }); }
  catch (error) { return res.status(400).json({ error: error.message }); }
});

router.get('/agent-runs/:jobId', (req, res) => {
  try {
    const job = jobs.read(req.params.jobId);
    if (!job.runtime?.enabled) return res.status(404).json({ error: 'Agent run not found.' });
    return res.json(job);
  } catch (error) { return res.status(404).json({ error: error.message }); }
});

router.post('/agent-runs/:jobId/cancel', (req, res) => {
  try {
    const job = agentRuntime.cancel(req.params.jobId);
    auditService.writeAuditEvent({ event: 'agent_run_cancelled', job_id: job.id });
    return res.json({ cancelled: true, job });
  } catch (error) { return res.status(400).json({ cancelled: false, error: error.message }); }
});

router.post('/agent-runs/:jobId/retry', (req, res) => {
  try {
    const job = agentRuntime.retry(req.params.jobId);
    auditService.writeAuditEvent({ event: 'agent_run_retried', job_id: job.id });
    return res.json({ queued: true, job });
  } catch (error) { return res.status(400).json({ queued: false, error: error.message }); }
});

router.get('/implementation-jobs', (req, res) => {
  try { return res.json({ jobs: jobs.list({ limit: req.query.limit, conversationId: req.query.conversation_id }) }); }
  catch (error) { return res.status(400).json({ error: error.message }); }
});

router.get('/implementation-jobs/:jobId', (req, res) => {
  try { return res.json(jobs.read(req.params.jobId)); }
  catch (error) { return res.status(404).json({ error: error.message }); }
});

router.get('/code-proposals', (req, res) => res.json({ proposals: changes.list({ jobId: req.query.job_id }) }));

router.post('/code-proposals/:proposalId/approve', (req, res) => {
  try {
    const proposal = changes.approve({
      proposalId: req.params.proposalId,
      confirmedFingerprint: req.body?.confirmed_fingerprint,
      approvalToken: req.body?.approval_token,
      approvedBy: req.body?.approved_by
    });
    const job = agentRuntime.resume(proposal.job_id);
    auditService.writeAuditEvent({ event: 'code_write_approved', proposal_id: proposal.id, job_id: proposal.job_id, approved_by: proposal.approved_by });
    return res.json({ approved: true, proposal, job });
  } catch (error) {
    auditService.writeAuditEvent({ event: 'code_write_approval_rejected', proposal_id: req.params.proposalId, reason: error.message });
    return res.status(403).json({ approved: false, error: error.message });
  }
});

router.get('/unity/packages', (req, res) => {
  try { return res.json(packageManager.listPackages({ repoHint: req.query.repo_hint })); }
  catch (error) { return res.status(400).json({ error: error.message }); }
});

router.get('/unity/package-proposals', (_req, res) => res.json({ proposals: packageManager.listProposals() }));

router.post('/unity/package-proposals/:proposalId/approve', (req, res) => {
  try {
    const proposal = packageManager.approvePackageChange({
      proposalId: req.params.proposalId,
      confirmedFingerprint: req.body?.confirmed_fingerprint,
      approvalToken: req.body?.approval_token,
      approvedBy: req.body?.approved_by,
      intent: req.body?.intent || 'apply'
    });
    auditService.writeAuditEvent({
      event: 'unity_package_change_approved', proposal_id: proposal.id,
      proposal_fingerprint: proposal.fingerprint, approved_by: proposal.approved_by,
      approval_intent: req.body?.intent || 'apply', package_name: proposal.package_name,
      package_action: proposal.action
    });
    return res.json({ approved: true, proposal });
  } catch (error) {
    auditService.writeAuditEvent({ event: 'unity_package_change_approval_rejected', proposal_id: req.params.proposalId, reason: error.message });
    return res.status(403).json({ approved: false, error: error.message });
  }
});

module.exports = router;
