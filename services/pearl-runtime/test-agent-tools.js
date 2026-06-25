const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const agentTools = require('./server/services/agentTools');

function createFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-agent-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', '03_worldbuilding'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'Materials'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'Instances', 'Worldbuilding', 'Biomes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# Agent Test Repo\n\nGame concept here.\n');
  fs.writeFileSync(path.join(root, 'docs', 'design.md'), '# Design\nEmergent narrative.\n');
  fs.writeFileSync(path.join(root, 'docs', '03_worldbuilding', 'biomes.md'), '# Biomes\n\nOvergrown City Zone reference.\n');
  fs.writeFileSync(path.join(root, 'assets', 'Materials', 'OvergrownAsphalt.mat'), 'Material:\n  m_Name: OvergrownAsphalt\n');
  fs.writeFileSync(path.join(root, 'assets', 'Instances', 'Worldbuilding', 'Biomes', 'Biome_biome_overgrown_city_zone.asset'), 'biomeId: biome_overgrown_city_zone\nbiomeName: Overgrown City Zone\n');
  fs.writeFileSync(path.join(root, '.env'), 'SECRET=blocked\n');
  return root;
}

function removeFixtureRepo(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function withFixtureRepo(fn) {
  const root = createFixtureRepo();
  const prev = process.env.PEARL_REPO_ROOTS;
  process.env.PEARL_REPO_ROOTS = root;
  try {
    fn(root);
  } finally {
    if (prev === undefined) {
      delete process.env.PEARL_REPO_ROOTS;
    } else {
      process.env.PEARL_REPO_ROOTS = prev;
    }
    removeFixtureRepo(root);
  }
}

test('Agent tools - read file returns content', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_read_file', { file_path: 'README.md' }, { conversationId: 'test-1' });
    assert(!result.error, 'Expected no error: ' + (result.error || ''));
    assert(result.content.includes('Game concept'), 'Expected file content in result');
    assert.strictEqual(result.file, 'README.md');
  });
});

test('Agent tools - read file blocks path traversal', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_read_file', { file_path: '../../etc/passwd' }, { conversationId: 'test-sec' });
    assert(result.error, 'Expected error for path traversal attempt');
  });
});

test('Agent tools - read file blocks .env access', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_read_file', { file_path: '.env' }, { conversationId: 'test-env' });
    assert(result.error, 'Expected error for .env access');
    assert(!result.content, 'Content should be undefined for blocked file');
  });
});

test('Agent tools - list dir returns entries and hides hidden files', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_list_dir', { directory: '.' }, { conversationId: 'test-dir' });
    assert(!result.error, 'Expected no error: ' + (result.error || ''));
    assert(result.items.length > 0, 'Expected at least one entry');
    const names = result.items.map(i => i.name);
    assert(!names.includes('.env'), '.env should be excluded from directory listing');
    assert(names.includes('README.md') || names.includes('docs'), 'Expected README.md or docs in listing');
  });
});

test('Agent tools - list dir blocks path traversal', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_list_dir', { directory: '../..' }, { conversationId: 'test-dir-sec' });
    assert(result.error, 'Expected error for path traversal attempt');
  });
});

test('Agent tools - search repo returns file list', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_search_repo', { query: 'design narrative', max_results: 5 }, { conversationId: 'test-search' });
    assert(!result.error, 'Expected no error: ' + (result.error || ''));
    assert(Array.isArray(result.results), 'Expected results to be an array');
    assert.strictEqual(result.query, 'design narrative');
  });
});

test('Agent tools - inventory assets returns exact biome matches and counts', () => {
  withFixtureRepo(() => {
    const result = agentTools.executeTool('pearl_inventory_assets', { query: 'overgrown city zone biome assets', max_results: 10 }, { conversationId: 'test-assets' });
    assert(!result.error, 'Expected no error: ' + (result.error || ''));
    assert(result.total_matches >= 2, 'Expected at least two matches');
    assert(result.unity_asset_count >= 2, 'Expected at least two Unity asset matches');
    assert(result.matches.some(match => match.file.includes('OvergrownAsphalt.mat')));
    assert(result.matches.some(match => match.file.includes('Biome_biome_overgrown_city_zone.asset')));
    assert(Array.isArray(result.missing_core_assets), 'Expected missing_core_assets array');
    assert(Array.isArray(result.recommended_asset_classes), 'Expected recommended_asset_classes array');
    assert(typeof result.created_asset_breakdown === 'object', 'Expected created_asset_breakdown object');
  });
});

test('Agent tools - task CRUD lifecycle', () => {
  const convId = 'task-test-' + Date.now();

  const created = agentTools.executeTool('pearl_create_task', { title: 'Review design docs', description: 'Check all canon files' }, { conversationId: convId });
  assert(created.created, 'Expected task to be created');
  assert(created.task.id, 'Expected task to have an id');
  assert.strictEqual(created.task.status, 'pending');

  const listed = agentTools.executeTool('pearl_list_tasks', {}, { conversationId: convId });
  assert.strictEqual(listed.count, 1, 'Expected 1 task');

  const completed = agentTools.executeTool('pearl_complete_task', { task_id: created.task.id }, { conversationId: convId });
  assert(completed.completed, 'Expected task to be completed');
  assert.strictEqual(completed.task.status, 'completed');

  const listedAfter = agentTools.executeTool('pearl_list_tasks', {}, { conversationId: convId });
  assert.strictEqual(listedAfter.tasks[0].status, 'completed');

  agentTools.clearSessionTasks(convId);
  const listedCleared = agentTools.executeTool('pearl_list_tasks', {}, { conversationId: convId });
  assert.strictEqual(listedCleared.count, 0, 'Expected 0 tasks after clear');
});

test('Agent tools - complete nonexistent task returns error', () => {
  const result = agentTools.executeTool('pearl_complete_task', { task_id: 'nonexistent-id' }, { conversationId: 'test-missing' });
  assert(result.error, 'Expected error for missing task');
});

test('Agent tools - unknown tool name returns error', () => {
  const result = agentTools.executeTool('pearl_does_not_exist', {}, { conversationId: 'test-unk' });
  assert(result.error, 'Expected error for unknown tool');
  assert(result.error.includes('Unknown tool'), 'Error should identify unknown tool');
});
