const { test } = require('node:test');
const assert = require('node:assert/strict');

const agentTools = require('./server/services/registerUnityPackageTools');

test('Pearl exposes Unity package tools to the agent loop', () => {
  const names = agentTools.TOOL_DEFINITIONS.map((entry) => entry.function.name);
  assert.equal(names.includes('pearl_list_unity_packages'), true);
  assert.equal(names.includes('pearl_propose_unity_package_change'), true);
  assert.equal(names.includes('pearl_apply_approved_unity_package_change'), true);
  assert.equal(names.includes('pearl_rollback_approved_unity_package_change'), true);
});

test('Unity package tool failures return structured results', () => {
  const result = agentTools.executeTool('pearl_apply_approved_unity_package_change', {
    proposal_id: 'missing'
  });
  assert.equal(typeof result.error, 'string');
  assert.equal(result.tool, 'pearl_apply_approved_unity_package_change');
});
