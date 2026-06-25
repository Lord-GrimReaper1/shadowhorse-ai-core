'use strict';

const agentTools = require('./agentTools');
const jobs = require('./implementationJobService');
const changes = require('./codeChangeService');

const DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'pearl_create_implementation_job',
      description: 'Create a durable implementation job before beginning multi-file development work.',
      parameters: { type: 'object', properties: { title: { type: 'string' }, objective: { type: 'string' }, repo_hint: { type: 'string' } }, required: ['title', 'objective'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_checkpoint_implementation_job',
      description: 'Record concrete progress, evidence, tests, blockers, or the final pre-commit report for a durable job.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string' },
          status: { type: 'string', enum: ['analyzing', 'editing', 'testing', 'reviewing', 'blocked', 'awaiting_commit_approval', 'completed', 'failed'] },
          summary: { type: 'string' }, evidence: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
          tests: { type: 'array', items: { type: 'object' } }, blocker: { type: 'string' }, proposed_commit_message: { type: 'string' }
        },
        required: ['job_id', 'status', 'summary']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_get_implementation_job',
      description: 'Read the durable state and checkpoint history for an implementation job.',
      parameters: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_propose_code_write',
      description: 'Propose the complete contents of one ordinary implementation file. This never writes until a human approves the fingerprint.',
      parameters: {
        type: 'object',
        properties: { job_id: { type: 'string' }, repo_hint: { type: 'string' }, file_path: { type: 'string' }, content: { type: 'string' }, rationale: { type: 'string' } },
        required: ['job_id', 'file_path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_list_code_proposals',
      description: 'List code-write proposals for a durable job, including proposal IDs and approval status. Use after a human approval resumes a job.',
      parameters: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_apply_approved_code_write',
      description: 'Apply a code-write proposal only after the separate human approval endpoint approves its exact fingerprint.',
      parameters: { type: 'object', properties: { proposal_id: { type: 'string' } }, required: ['proposal_id'] }
    }
  }
];

agentTools.TOOL_DEFINITIONS.push(...DEFINITIONS);
agentTools.MAX_AGENT_ITERATIONS = 20;
const previousExecute = agentTools.executeTool;

agentTools.executeTool = function executeDeveloperTool(name, args = {}, context = {}) {
  try {
    switch (name) {
      case 'pearl_create_implementation_job':
        return jobs.create({ title: args.title, objective: args.objective, repoHint: args.repo_hint, conversationId: context.conversationId, requestedBy: 'pearl' });
      case 'pearl_checkpoint_implementation_job':
        return jobs.checkpoint({ jobId: args.job_id, status: args.status, summary: args.summary, evidence: args.evidence, files: args.files, tests: args.tests, blocker: args.blocker, proposedCommitMessage: args.proposed_commit_message });
      case 'pearl_get_implementation_job': return jobs.read(args.job_id);
      case 'pearl_propose_code_write':
        return changes.propose({ jobId: args.job_id, repoHint: args.repo_hint, filePath: args.file_path, content: args.content, rationale: args.rationale });
      case 'pearl_list_code_proposals': return { proposals: changes.list({ jobId: args.job_id }) };
      case 'pearl_apply_approved_code_write': return changes.apply({ proposalId: args.proposal_id });
      default: return previousExecute(name, args, context);
    }
  } catch (error) {
    return { error: error.message, tool: name, requires_human_approval: /approved|approval/i.test(error.message) };
  }
};

module.exports = agentTools;
