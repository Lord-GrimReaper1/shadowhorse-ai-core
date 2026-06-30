'use strict';

/**
 * agentTools.js
 * Defines the tool set Pearl can invoke during agentic multi-step turns.
 * All tools are read-only by default; write operations require human approval.
 * Security: path traversal is blocked, .env / secret files are excluded,
 * and all tool calls are bounded by MAX_AGENT_ITERATIONS in the chat route.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const repoContextService = require('./repoContextService');
const gitStatusService = require('./gitStatusService');
const networkCapabilityService = require('./networkCapabilityService');
const webSearchService = require('./webSearchService');

const MAX_AGENT_ITERATIONS = 8;
const MAX_FILE_READ_CHARS = 16000;
const ASSET_TOOL_MAX_SCAN_FILES = 2000;
const ASSET_SEARCH_ROOTS = [
  'assets',
  path.join('data', 'worldbuilding'),
  path.join('docs', '03_worldbuilding')
];
const ASSET_COUNTED_EXTENSIONS = new Set([
  '.mat',
  '.prefab',
  '.asset',
  '.unity',
  '.shader',
  '.controller',
  '.glb',
  '.gltf',
  '.fbx',
  '.obj',
  '.blend',
  '.png',
  '.jpg',
  '.jpeg',
  '.tga',
  '.wav',
  '.mp3',
  '.ogg'
]);
const ASSET_TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.asset',
  '.mat',
  '.prefab',
  '.unity',
  '.shader',
  '.controller',
  '.yml',
  '.yaml'
]);
const ASSET_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.vs',
  '.vscode',
  'Library',
  'Temp',
  'Logs',
  'GeneratedAssets',
  'PackageBackups',
  'ProfilerCaptures',
  'UserSettings',
  'node_modules'
]);
const ASSET_STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'again',
  'all',
  'also',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'between',
  'both',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'let',
  'many',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'order',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'say',
  'see',
  'should',
  'so',
  'some',
  'such',
  'than',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'this',
  'that',
  'they',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'want',
  'was',
  'we',
  'were',
  'when',
  'where',
  'which',
  'while',
  'who',
  'why',
  'will',
  'with',
  'would',
  'created',
  'create',
  'finish',
  'scene',
  'needs',
  'need',
  'what',
  'simple',
  'test',
  'locate',
  'tell',
  'digital',
  'assets',
  'asset',
  'biome',
  'zone',
  'you',
  'your'
]);

// Session-scoped task store: Map<conversationId, Map<taskId, task>>
const sessionTaskStore = new Map();

function getOrCreateTaskList(conversationId) {
  if (!sessionTaskStore.has(conversationId)) {
    sessionTaskStore.set(conversationId, new Map());
  }
  return sessionTaskStore.get(conversationId);
}

// ─── Tool schemas exposed to OpenAI ────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'pearl_read_file',
      description:
        'Read the full contents of a specific file from the allowed studio repo. ' +
        'Use this to inspect code, docs, or configs in detail before answering.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description:
              'Path relative to the repo root, e.g. "README.md" or ' +
              '"docs/01_canon/canon_statements.md".'
          },
          repo_hint: {
            type: 'string',
            description: 'Optional repo basename, e.g. "Crossroads-Game".'
          }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_search_repo',
      description:
        'Search for files relevant to a query within the allowed studio repo. ' +
        'Returns matching file paths. Use before pearl_read_file to find the right files.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query, e.g. "playtest feedback" or "NPC behavior rules".'
          },
          repo_hint: { type: 'string', description: 'Optional repo basename.' },
          max_results: {
            type: 'number',
            description: 'Max files to return. Default 8, max 20.'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_list_dir',
      description:
        'List the files and subfolders inside a directory in the studio repo. ' +
        'Use to explore structure before reading specific files.',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description:
              'Directory path relative to repo root, e.g. "docs/01_canon" or "pipeline".'
          },
          repo_hint: { type: 'string', description: 'Optional repo basename.' }
        },
        required: ['directory']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_inventory_assets',
      description:
        'Locate Unity assets and worldbuilding references for a biome, region, scene, or theme. ' +
        'Returns exact matching files, counts by category, and asset-type breakdowns. ' +
        'Use this before answering questions like "how many assets exist" or "what still needs to be created".',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Biome, scene, or asset query, e.g. "overgrown city zone biome".'
          },
          repo_hint: { type: 'string', description: 'Optional repo basename.' },
          max_results: {
            type: 'number',
            description: 'Max matching files to return. Default 12, max 30.'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_git_status',
      description:
        'Quickly check read-only Git status for an allowed studio repo. ' +
        'Use this for branch, sync, ahead/behind, commit presence, and GitHub/local comparison questions.',
      parameters: {
        type: 'object',
        properties: {
          repo_hint: { type: 'string', description: 'Optional repo basename, e.g. "Crossroads-Game" or "shadowhorse-ai-core".' },
          fetch_remote: {
            type: 'boolean',
            description: 'Whether to run git fetch before comparing. Use true only when the user asks about GitHub/remote freshness.'
          },
          remote: { type: 'string', description: 'Remote name. Default origin.' },
          max_commits: { type: 'number', description: 'Max ahead/behind commits to return. Default 10, max 30.' },
          commit: { type: 'string', description: 'Optional commit SHA to check for local presence.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_network_diagnostics',
      description:
        'Check Pearl runtime network capability and configured web search providers. ' +
        'Use when the user asks whether Pearl can reach GitHub, web search, APIs, or the internet.',
      parameters: {
        type: 'object',
        properties: {
          check_targets: {
            type: 'boolean',
            description: 'Whether to actively probe public service endpoints. Default false for quick config checks.'
          },
          timeout_ms: {
            type: 'number',
            description: 'Per-target timeout for active probes. Default 3000.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_web_search',
      description:
        'Search the public web through the configured provider. ' +
        'Use for current trends, recent APIs, current documentation, market/design trends, and facts that may have changed.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The web search query.' },
          provider: { type: 'string', enum: ['brave', 'tavily'], description: 'Optional provider. Default comes from PEARL_WEB_SEARCH_PROVIDER or brave.' },
          max_results: { type: 'number', description: 'Max search results. Default 5, max 8.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_read_web_page',
      description:
        'Read public web page text after a search result has been selected. ' +
        'This is disabled unless PEARL_WEB_FETCH_ENABLED=true.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Public http or https URL to read.' },
          max_chars: { type: 'number', description: 'Max text characters to return. Default 12000.' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_create_task',
      description:
        'Create a tracked task for the current session to break complex work into auditable steps.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short task title (3-7 words).' },
          description: { type: 'string', description: 'Optional longer description.' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_complete_task',
      description: 'Mark a tracked session task as completed.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The task ID to complete.' }
        },
        required: ['task_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pearl_list_tasks',
      description: 'List all tracked tasks for the current session.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveRepoRoot(repoHint) {
  const allowedRoots = repoContextService.resolveAllowedRepoRoots();
  return repoContextService.resolveRepoRoot(repoHint, allowedRoots);
}

function isInsideRoot(absolutePath, resolvedRoot) {
  const sep = path.sep;
  return absolutePath === resolvedRoot ||
    absolutePath.startsWith(resolvedRoot + sep);
}

function tokenizeAssetQuery(query = '') {
  return Array.from(new Set(
    String(query || '')
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(token => token.length >= 3 && !ASSET_STOP_WORDS.has(token))
  ));
}

function buildAssetNeedles(query = '') {
  const lowered = String(query || '').toLowerCase();
  const tokens = tokenizeAssetQuery(query);
  const needles = new Set(tokens);

  if (tokens.length > 1) {
    needles.add(tokens.join('_'));
    needles.add(tokens.join('-'));
    needles.add(tokens.join(' '));
  }

  if (lowered.includes('overgrown city zone')) {
    needles.add('overgrown city zone');
    needles.add('overgrown_city_zone');
    needles.add('biome_overgrown_city_zone');
  }

  return Array.from(needles);
}

function shouldSkipAssetEntry(entryName) {
  const lowerName = entryName.toLowerCase();
  return lowerName.startsWith('.') || lowerName.endsWith('.meta') || lowerName === '.ds_store';
}

function collectAssetFiles(repoRoot, relativeRoot, accumulator, limit) {
  if (accumulator.length >= limit) {
    return;
  }

  const absoluteRoot = path.join(repoRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) {
    return;
  }

  const stats = fs.statSync(absoluteRoot);
  if (stats.isFile()) {
    if (!shouldSkipAssetEntry(path.basename(relativeRoot))) {
      accumulator.push(relativeRoot);
    }
    return;
  }

  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (accumulator.length >= limit) {
      break;
    }

    if (shouldSkipAssetEntry(entry.name)) {
      continue;
    }

    if (entry.isDirectory() && ASSET_EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const relativePath = relativeRoot
      ? path.join(relativeRoot, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      collectAssetFiles(repoRoot, relativePath, accumulator, limit);
    } else if (entry.isFile()) {
      accumulator.push(relativePath);
    }
  }
}

function readAssetSearchText(absolutePath, ext) {
  if (!ASSET_TEXT_EXTENSIONS.has(ext)) {
    return '';
  }

  try {
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile() || stats.size > 128 * 1024) {
      return '';
    }
    return fs.readFileSync(absolutePath, 'utf8').toLowerCase();
  } catch (_err) {
    return '';
  }
}

function categorizeAssetMatch(relativePath, ext, content) {
  const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase();

  if (normalizedPath.includes('/biomes/') && ext === '.asset') {
    return 'biome_definition';
  }

  if (normalizedPath.startsWith('assets/') && ASSET_COUNTED_EXTENSIONS.has(ext)) {
    return 'unity_asset';
  }

  if (normalizedPath.startsWith('data/') || normalizedPath.startsWith('docs/')) {
    return 'reference';
  }

  if (content.includes('biomename:') || content.includes('biomeid:')) {
    return 'biome_definition';
  }

  return 'other';
}

function scoreAssetMatch(relativePath, content, needles, tokens) {
  const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase();
  let score = 0;
  let pathHits = 0;
  let contentHits = 0;
  let exactNeedleHits = 0;

  for (const needle of needles) {
    if (normalizedPath.includes(needle)) {
      pathHits += 1;
      exactNeedleHits += 1;
      score += needle.includes(' ') ? 16 : 12;
    }
    if (content && content.includes(needle)) {
      contentHits += 1;
      if (needle.includes(' ') || needle.includes('_') || needle.includes('-')) {
        exactNeedleHits += 1;
      }
      score += needle.includes(' ') ? 14 : 10;
    }
  }

  let matchedTokens = 0;
  for (const token of tokens) {
    if (normalizedPath.includes(token) || (content && content.includes(token))) {
      matchedTokens += 1;
    }
  }

  score += matchedTokens * 6;

  if (matchedTokens >= 2) {
    score += 12;
  }

  if (normalizedPath.includes('/worldbuilding/')) {
    score += 8;
  }

  if (normalizedPath.includes('/materials/') || normalizedPath.endsWith('.mat')) {
    score += 6;
  }

  if (normalizedPath.includes('/biomes/')) {
    score += 8;
  }

  return {
    score,
    matchedTokens,
    pathHits,
    contentHits,
    exactNeedleHits
  };
}

function inferCreatedAssetClass(match) {
  const file = String(match.file || '').toLowerCase();
  const ext = String(match.extension || '').toLowerCase();

  if (match.category === 'biome_definition') {
    return 'biome_definition';
  }
  if (ext === '.unity') {
    return 'scene';
  }
  if (ext === '.mat' || ext === '.shader') {
    return 'materials';
  }
  if (ext === '.prefab' || ext === '.fbx' || ext === '.obj' || ext === '.blend' || ext === '.glb' || ext === '.gltf') {
    return 'models_prefabs';
  }
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.tga') {
    return 'textures_renders';
  }
  if (ext === '.wav' || ext === '.mp3' || ext === '.ogg') {
    return 'audio';
  }
  if (file.includes('/regions/') && ext === '.asset') {
    return 'region_definition';
  }
  if (match.category === 'unity_asset' && ext === '.asset') {
    return 'scriptable_asset';
  }

  return null;
}

// ─── Tool handlers ──────────────────────────────────────────────────────────

function handleReadFile(args) {
  const { file_path, repo_hint } = args;
  if (!file_path || typeof file_path !== 'string') {
    return { error: 'file_path is required.' };
  }

  const repoRoot = resolveRepoRoot(repo_hint);
  if (!repoRoot) {
    return { error: 'No allowed repo root found for hint: ' + (repo_hint || '(default)') };
  }

  const resolvedRoot = path.resolve(repoRoot);
  const absolutePath = path.resolve(path.join(repoRoot, file_path));

  if (!isInsideRoot(absolutePath, resolvedRoot)) {
    return { error: 'Path traversal blocked.' };
  }

  // Block secret files
  const baseName = path.basename(absolutePath).toLowerCase();
  if (baseName === '.env' || baseName.startsWith('.env.')) {
    return { error: 'Access to secret environment files is not permitted.' };
  }

  if (!fs.existsSync(absolutePath)) {
    return { error: 'File not found: ' + file_path };
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return { error: 'Not a file: ' + file_path };
  }

  if (stats.size > MAX_FILE_READ_CHARS * 4) {
    return {
      error: 'File too large (' + stats.size + ' bytes). Max is ' + (MAX_FILE_READ_CHARS * 4) + ' bytes.'
    };
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const truncated = content.length > MAX_FILE_READ_CHARS;
  return {
    file: file_path,
    content: content.slice(0, MAX_FILE_READ_CHARS),
    truncated,
    total_chars: content.length
  };
}

function handleSearchRepo(args) {
  const { query, repo_hint, max_results = 8 } = args;
  if (!query || typeof query !== 'string') {
    return { error: 'query is required.' };
  }

  const repoRoot = resolveRepoRoot(repo_hint);
  if (!repoRoot) {
    return { error: 'No allowed repo root found.' };
  }

  const safeMax = Math.min(Math.max(1, Number(max_results) || 8), 20);
  const discovered = repoContextService.discoverRepoFiles(repoRoot, query, 120);
  const results = discovered.slice(0, safeMax).map(f => ({ file: f }));
  return { query, results, count: results.length };
}

function handleListDir(args) {
  const { directory, repo_hint } = args;
  if (!directory || typeof directory !== 'string') {
    return { error: 'directory is required.' };
  }

  const repoRoot = resolveRepoRoot(repo_hint);
  if (!repoRoot) {
    return { error: 'No allowed repo root found.' };
  }

  const resolvedRoot = path.resolve(repoRoot);
  const absoluteDir = path.resolve(path.join(repoRoot, directory));

  if (!isInsideRoot(absoluteDir, resolvedRoot)) {
    return { error: 'Path traversal blocked.' };
  }

  if (!fs.existsSync(absoluteDir)) {
    return { error: 'Directory not found: ' + directory };
  }

  if (!fs.statSync(absoluteDir).isDirectory()) {
    return { error: 'Not a directory: ' + directory };
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const items = entries
    .filter(e => !e.name.startsWith('.'))
    .map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));

  return { directory, items, count: items.length };
}

function handleInventoryAssets(args) {
  const { query, repo_hint, max_results = 12 } = args;
  if (!query || typeof query !== 'string') {
    return { error: 'query is required.' };
  }

  const repoRoot = resolveRepoRoot(repo_hint);
  if (!repoRoot) {
    return { error: 'No allowed repo root found.' };
  }

  const tokens = tokenizeAssetQuery(query);
  const needles = buildAssetNeedles(query);
  const safeMax = Math.min(Math.max(1, Number(max_results) || 12), 30);
  const candidates = [];

  for (const root of ASSET_SEARCH_ROOTS) {
    collectAssetFiles(repoRoot, root, candidates, ASSET_TOOL_MAX_SCAN_FILES);
    if (candidates.length >= ASSET_TOOL_MAX_SCAN_FILES) {
      break;
    }
  }

  const uniqueCandidates = Array.from(new Set(candidates));
  const matches = [];

  for (const relativePath of uniqueCandidates) {
    const absolutePath = path.join(repoRoot, relativePath);
    const displayPath = relativePath.replace(/\\/g, '/');
    const ext = path.extname(relativePath).toLowerCase();
    const content = readAssetSearchText(absolutePath, ext);
    const normalizedPath = displayPath.toLowerCase();
    const matchStats = scoreAssetMatch(relativePath, content, needles, tokens);
    const isAssetPath = normalizedPath.startsWith('assets/');
    const isStrongMatch =
      matchStats.exactNeedleHits >= 1 ||
      matchStats.matchedTokens >= Math.min(2, tokens.length || 1) ||
      (isAssetPath && matchStats.pathHits >= 1);

    if (matchStats.score <= 0 || !isStrongMatch) {
      continue;
    }

    matches.push({
      file: displayPath,
      category: categorizeAssetMatch(relativePath, ext, content),
      extension: ext || '(none)',
      score: matchStats.score
    });
  }

  matches.sort((left, right) => right.score - left.score || left.file.localeCompare(right.file));

  const countsByCategory = {};
  const countsByExtension = {};
  for (const match of matches) {
    countsByCategory[match.category] = (countsByCategory[match.category] || 0) + 1;
    countsByExtension[match.extension] = (countsByExtension[match.extension] || 0) + 1;
  }

  const createdAssetMatches = matches.filter(match => match.category === 'unity_asset' || match.category === 'biome_definition');
  const referenceMatches = matches.filter(match => match.category === 'reference');
  const createdAssetBreakdown = {};
  for (const match of createdAssetMatches) {
    const cls = inferCreatedAssetClass(match);
    if (!cls) {
      continue;
    }
    createdAssetBreakdown[cls] = (createdAssetBreakdown[cls] || 0) + 1;
  }

  const hasCoreScene = (createdAssetBreakdown.scene || 0) > 0;
  const hasCoreBiome = (createdAssetBreakdown.biome_definition || 0) > 0;
  const hasCoreSurface = (createdAssetBreakdown.materials || 0) > 0;
  const hasCoreModels = (createdAssetBreakdown.models_prefabs || 0) > 0;
  const missingCoreAssets = [];

  if (!hasCoreBiome) {
    missingCoreAssets.push('biome_definition');
  }
  if (!hasCoreScene) {
    missingCoreAssets.push('scene_file');
  }
  if (!hasCoreSurface) {
    missingCoreAssets.push('materials_shaders');
  }
  if (!hasCoreModels) {
    missingCoreAssets.push('models_prefabs');
  }

  const recommendedAssetClasses = [];
  if ((createdAssetBreakdown.textures_renders || 0) === 0) {
    recommendedAssetClasses.push('textures_and_renders');
  }
  if ((createdAssetBreakdown.audio || 0) === 0) {
    recommendedAssetClasses.push('ambient_audio');
  }
  recommendedAssetClasses.push('set_dressing_props');
  recommendedAssetClasses.push('interactive_entities');
  const dedupedRecommended = Array.from(new Set(recommendedAssetClasses));

  return {
    query,
    tokens,
    total_matches: matches.length,
    related_file_count: matches.length,
    created_asset_count: createdAssetMatches.length,
    unity_asset_count: createdAssetMatches.length,
    biome_definition_count: countsByCategory.biome_definition || 0,
    reference_count: countsByCategory.reference || 0,
    related_reference_count: referenceMatches.length,
    counts_by_category: countsByCategory,
    counts_by_extension: countsByExtension,
    created_asset_breakdown: createdAssetBreakdown,
    missing_core_assets: missingCoreAssets,
    recommended_asset_classes: dedupedRecommended,
    top_created_assets: createdAssetMatches.slice(0, safeMax).map(match => match.file),
    top_reference_files: referenceMatches.slice(0, safeMax).map(match => match.file),
    matches: matches.slice(0, safeMax)
  };
}

function handleCreateTask(args, conversationId) {
  const { title, description = '' } = args;
  if (!title || typeof title !== 'string') {
    return { error: 'title is required.' };
  }
  const taskId = uuidv4().split('-')[0];
  const tasks = getOrCreateTaskList(conversationId);
  const task = {
    id: taskId,
    title: title.trim(),
    description,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  tasks.set(taskId, task);
  return { created: true, task };
}

function handleCompleteTask(args, conversationId) {
  const { task_id } = args;
  const tasks = getOrCreateTaskList(conversationId);
  if (!tasks.has(task_id)) {
    return { error: 'Task not found: ' + task_id };
  }
  const task = tasks.get(task_id);
  task.status = 'completed';
  task.completed_at = new Date().toISOString();
  return { completed: true, task };
}

function handleListTasks(args, conversationId) {
  const tasks = getOrCreateTaskList(conversationId);
  return { tasks: Array.from(tasks.values()), count: tasks.size };
}

function handleGitStatus(args) {
  return gitStatusService.getStatus({
    repoHint: args.repo_hint,
    fetchRemote: args.fetch_remote === true,
    remote: args.remote || 'origin',
    maxCommits: args.max_commits,
    commit: args.commit
  });
}

function handleNetworkDiagnostics(args) {
  return networkCapabilityService.diagnose({
    checkTargets: args.check_targets === true,
    timeoutMs: args.timeout_ms
  });
}

function handleWebSearch(args) {
  return webSearchService.search({
    query: args.query,
    provider: args.provider,
    maxResults: args.max_results
  });
}

function handleReadWebPage(args) {
  return webSearchService.readPage({
    url: args.url,
    maxChars: args.max_chars
  });
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

function executeTool(toolName, toolArgs, context = {}) {
  const { conversationId = 'default' } = context;
  const args = toolArgs || {};
  switch (toolName) {
    case 'pearl_read_file':    return handleReadFile(args);
    case 'pearl_search_repo': return handleSearchRepo(args);
    case 'pearl_list_dir':    return handleListDir(args);
    case 'pearl_inventory_assets': return handleInventoryAssets(args);
    case 'pearl_git_status': return handleGitStatus(args);
    case 'pearl_network_diagnostics': return handleNetworkDiagnostics(args);
    case 'pearl_web_search': return handleWebSearch(args);
    case 'pearl_read_web_page': return handleReadWebPage(args);
    case 'pearl_create_task': return handleCreateTask(args, conversationId);
    case 'pearl_complete_task': return handleCompleteTask(args, conversationId);
    case 'pearl_list_tasks':  return handleListTasks(args, conversationId);
    default: return { error: 'Unknown tool: ' + toolName };
  }
}

function clearSessionTasks(conversationId) {
  sessionTaskStore.delete(conversationId);
}

module.exports = {
  TOOL_DEFINITIONS,
  MAX_AGENT_ITERATIONS,
  executeTool,
  clearSessionTasks
};
