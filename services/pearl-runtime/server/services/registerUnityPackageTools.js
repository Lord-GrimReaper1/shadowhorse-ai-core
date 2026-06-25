'use strict';

const agentTools = require('./agentTools');
const packageManager = require('./unityPackageManager');

const UNITY_PACKAGE_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'pearl_list_unity_packages',
      description: 'List packages currently declared in the Unity Packages/manifest.json file.',
      parameters: { type: 'object', properties: { repo_hint: { type: 'string', description: 'Optional Unity project repository name.' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_propose_unity_package_change',
      description: 'Create a fingerprinted proposal to add, update, or remove a Unity registry package. This does not modify files.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'update', 'remove'] },
          package_name: { type: 'string', description: 'Unity registry package name, such as com.unity.test-framework.' },
          version: { type: 'string', description: 'Registry version for add or update.' },
          rationale: { type: 'string', description: 'Why the package change is needed.' },
          repo_hint: { type: 'string', description: 'Optional Unity project repository name.' }
        },
        required: ['action', 'package_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_list_unity_package_proposals',
      description: 'List Unity package proposals and their approval status.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_apply_approved_unity_package_change',
      description: 'Apply a Unity package proposal only after the separate human approval endpoint has approved it.',
      parameters: { type: 'object', properties: { proposal_id: { type: 'string' } }, required: ['proposal_id'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_rollback_approved_unity_package_change',
      description: 'Roll back an applied Unity package proposal only after separate human rollback approval.',
      parameters: { type: 'object', properties: { proposal_id: { type: 'string' } }, required: ['proposal_id'] }
    }
  }
];

agentTools.TOOL_DEFINITIONS.push(...UNITY_PACKAGE_TOOL_DEFINITIONS);
const originalExecuteTool = agentTools.executeTool;

agentTools.executeTool = function executeToolWithUnityPackages(toolName, args = {}, context) {
  try {
    switch (toolName) {
      case 'pearl_list_unity_packages':
        return packageManager.listPackages({ repoHint: args.repo_hint });
      case 'pearl_propose_unity_package_change':
        return packageManager.proposePackageChange({
          action: args.action,
          packageName: args.package_name,
          version: args.version,
          rationale: args.rationale,
          repoHint: args.repo_hint
        });
      case 'pearl_list_unity_package_proposals':
        return { proposals: packageManager.listProposals() };
      case 'pearl_apply_approved_unity_package_change':
        return packageManager.applyApprovedPackageChange({ proposalId: args.proposal_id });
      case 'pearl_rollback_approved_unity_package_change':
        return packageManager.rollbackApprovedPackageChange({ proposalId: args.proposal_id });
      default:
        return originalExecuteTool(toolName, args, context);
    }
  } catch (error) {
    return {
      error: error.message,
      tool: toolName,
      requires_human_approval: /approved|approval/i.test(error.message)
    };
  }
};

module.exports = agentTools;
