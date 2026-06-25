const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoContextService = require('./server/services/repoContextService');

function createFixtureRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crossroads-repo-context-'));
  fs.mkdirSync(path.join(repoRoot, 'docs', '01_canon'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'docs', '03_worldbuilding'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'assets', 'Materials'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'assets', 'Instances', 'Worldbuilding', 'Biomes'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'services', 'pearl-runtime', 'server', 'routes'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'README.md'),
    '# Fixture Repo\n\nA systemic survival game about consequence and reconstruction.\n'
  );
  fs.writeFileSync(
    path.join(repoRoot, 'docs', '01_canon', 'canon_statements.md'),
    'Canon: players rebuild through responsibility, scarcity, and social consequence.\n'
  );
  fs.writeFileSync(
    path.join(repoRoot, 'services', 'pearl-runtime', 'server', 'routes', 'assistant.js'),
    'module.exports = function assistantRoute() { return "Pearl base code"; };\n'
  );
  fs.writeFileSync(
    path.join(repoRoot, 'assets', 'Materials', 'OvergrownAsphalt.mat'),
    'Material:\n  m_Name: OvergrownAsphalt\n'
  );
  fs.writeFileSync(
    path.join(repoRoot, 'assets', 'Instances', 'Worldbuilding', 'Biomes', 'Biome_biome_overgrown_city_zone.asset'),
    'biomeId: biome_overgrown_city_zone\nbiomeName: Overgrown City Zone\n'
  );
  fs.writeFileSync(
    path.join(repoRoot, 'docs', '03_worldbuilding', 'biome_types_spec.md'),
    '# Biomes\n\nOvergrown City Zone supports reclaimed urban scenes.\n'
  );
  fs.writeFileSync(
    path.join(repoRoot, '.env'),
    'OPENAI_API_KEY=should-not-be-exposed\n'
  );

  return repoRoot;
}

function removeFixtureRepo(repoRoot) {
  fs.rmSync(repoRoot, { recursive: true, force: true });
}

test('Repo context - builds grounded context from allowed repo root', () => {
  const repoRoot = createFixtureRepo();

  try {
    const result = repoContextService.buildRepoContext({
      prompt: 'Read the repo and tell me what you think of the game concept.',
      allowedRoots: [repoRoot]
    });

    assert(result, 'Expected repo context to be built');
    assert.strictEqual(result.repoRoot, path.resolve(repoRoot));
    assert.strictEqual(result.repoName, path.basename(repoRoot));
    assert(result.filesUsed.includes('README.md'));
    assert(result.contextText.includes('Fixture Repo'));
    assert(result.contextText.includes('responsibility, scarcity, and social consequence'));
  } finally {
    removeFixtureRepo(repoRoot);
  }
});

test('Repo context - resolves repo by basename hint', () => {
  const repoRoot = createFixtureRepo();

  try {
    const resolved = repoContextService.resolveRepoRoot(path.basename(repoRoot), [path.resolve(repoRoot)]);
    assert.strictEqual(resolved, path.resolve(repoRoot));
  } finally {
    removeFixtureRepo(repoRoot);
  }
});

test('Repo context - returns null for disallowed repo hint', () => {
  const repoRoot = createFixtureRepo();

  try {
    const result = repoContextService.buildRepoContext({
      repoHint: 'different-repo',
      prompt: 'Summarize this project.',
      allowedRoots: [repoRoot]
    });

    assert.strictEqual(result, null);
  } finally {
    removeFixtureRepo(repoRoot);
  }
});

test('Repo context - discovers assistant code for self/code prompts', () => {
  const repoRoot = createFixtureRepo();

  try {
    const discovered = repoContextService.discoverRepoFiles(
      repoRoot,
      'Pearl should inspect her own base code and assistant middleware.'
    );

    assert(discovered.includes(path.join('services', 'pearl-runtime', 'server', 'routes', 'assistant.js')));
    assert(!discovered.includes('.env'));

    const result = repoContextService.buildRepoContext({
      prompt: 'Pearl, inspect your own assistant code and suggest how to improve yourself.',
      allowedRoots: [repoRoot]
    });

    assert(result.contextText.includes('assistant.js'));
    assert(result.contextText.includes('Pearl base code'));
    assert(!result.contextText.includes('should-not-be-exposed'));
  } finally {
    removeFixtureRepo(repoRoot);
  }
});

test('Repo context - search mode returns relevant assistant snippets', () => {
  const repoRoot = createFixtureRepo();

  try {
    const result = repoContextService.buildRepoContext({
      prompt: 'Find assistant middleware route code for pearl.',
      mode: 'search',
      maxResultFiles: 4,
      allowedRoots: [repoRoot]
    });

    assert(result, 'Expected repo context in search mode');
    assert.strictEqual(result.mode, 'search');
    assert(result.filesUsed.length >= 1);
    assert(result.contextText.includes('Repository context mode: search'));
    assert(result.contextText.includes('assistant.js'));
    assert(!result.contextText.includes('should-not-be-exposed'));
  } finally {
    removeFixtureRepo(repoRoot);
  }
});

test('Repo context - biome asset prompts prioritize worldbuilding assets over assistant code', () => {
  const repoRoot = createFixtureRepo();

  try {
    const discovered = repoContextService.discoverRepoFiles(
      repoRoot,
      'Locate the overgrown city zone biome assets and count what exists for the scene.'
    );

    assert(discovered.includes(path.join('assets', 'Materials', 'OvergrownAsphalt.mat')));
    assert(discovered.includes(path.join('assets', 'Instances', 'Worldbuilding', 'Biomes', 'Biome_biome_overgrown_city_zone.asset')));

    const result = repoContextService.buildRepoContext({
      prompt: 'Locate the overgrown city zone biome assets and count what exists for the scene.',
      mode: 'search',
      maxResultFiles: 4,
      allowedRoots: [repoRoot]
    });

    assert(result, 'Expected repo context in search mode');
    assert(result.filesUsed.some(file => file.includes('OvergrownAsphalt.mat')));
    assert(result.filesUsed.some(file => file.includes('Biome_biome_overgrown_city_zone.asset')));
    assert(!result.filesUsed.some(file => file.includes('assistant.js')));
  } finally {
    removeFixtureRepo(repoRoot);
  }
});
