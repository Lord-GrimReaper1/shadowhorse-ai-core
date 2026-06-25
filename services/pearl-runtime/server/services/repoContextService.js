const fs = require('fs');
const path = require('path');

const DEFAULT_CONTEXT_BUDGET = 12000;
const DEFAULT_MAX_DISCOVERED_FILES = 120;
const DEFAULT_SEARCH_RESULT_FILES = 8;
const MAX_FILE_BYTES = 256 * 1024;
const SEARCH_SNIPPET_RADIUS = 3;
const DEFAULT_REPO_FILES = [
  'README.md',
  'docs/00_index/README.md',
  'docs/00_index/index.md',
  'docs/01_canon/canon_statements.md',
  'docs/01_canon/design_ethos_anti_patterns.md',
  'docs/01_canon/living_roadmap_checklist.md',
  'docs/02_design/README.md',
  'pipeline/README.md'
];
const SAFE_TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.cs',
  '.py',
  '.mat',
  '.prefab',
  '.asset',
  '.unity',
  '.shader',
  '.controller',
  '.yml',
  '.yaml'
]);
const EXCLUDED_FILENAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
]);
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.vs',
  '.vscode',
  'node_modules',
  'Library',
  'Temp',
  'Logs',
  'GeneratedAssets',
  'PackageBackups',
  'ProfilerCaptures',
  'UserSettings'
]);
const EXCLUDED_PATH_SUBSTRINGS = [
  'pipeline/middleware/nodejs/server/data/',
  'services/pearl-runtime/server/data/',
  'docs/06_production/copilot_chats/'
];

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWord(text = '', word = '') {
  if (!text || !word) {
    return false;
  }

  return new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(text);
}

function hasAnyWholeWord(text = '', words = []) {
  return words.some(word => hasWholeWord(text, word));
}

function promptTokens(prompt = '') {
  return Array.from(new Set(
    prompt
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(token => token.length >= 3)
  ));
}

function normalizeRoot(rootPath) {
  return path.resolve(rootPath).replace(/[\\/]+$/, '');
}

function splitEnvList(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  return value
    .split(path.delimiter)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function defaultRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function resolveAllowedRepoRoots(envValue = process.env.PEARL_REPO_ROOTS) {
  const configuredRoots = splitEnvList(envValue);
  const roots = configuredRoots.length > 0 ? configuredRoots : [defaultRepoRoot()];
  return Array.from(new Set(roots.map(normalizeRoot)));
}

function resolveRepoRoot(repoHint, allowedRoots = resolveAllowedRepoRoots()) {
  if (!Array.isArray(allowedRoots) || allowedRoots.length === 0) {
    return null;
  }

  if (!repoHint || typeof repoHint !== 'string' || repoHint.trim().length === 0) {
    return allowedRoots[0];
  }

  const trimmedHint = repoHint.trim();
  const normalizedHint = normalizeRoot(trimmedHint);
  const exactMatch = allowedRoots.find(root => normalizeRoot(root) === normalizedHint);
  if (exactMatch) {
    return exactMatch;
  }

  const basenameMatch = allowedRoots.find(root => path.basename(root).toLowerCase() === trimmedHint.toLowerCase());
  if (basenameMatch) {
    return basenameMatch;
  }

  return null;
}

function readRepoFile(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return null;
  }

  if (stats.size > MAX_FILE_BYTES) {
    return null;
  }

  return fs.readFileSync(absolutePath, 'utf8').trim();
}

function isSafeTextFile(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const ext = path.extname(relativePath).toLowerCase();
  const baseName = path.basename(relativePath).toLowerCase();

  if (EXCLUDED_FILENAMES.has(baseName)) {
    return false;
  }

  if (!SAFE_TEXT_EXTENSIONS.has(ext)) {
    return false;
  }

  if (EXCLUDED_PATH_SUBSTRINGS.some(fragment => normalizedPath.toLowerCase().includes(fragment))) {
    return false;
  }

  return !relativePath
    .split(/[\\/]+/)
    .some(segment => EXCLUDED_DIRECTORIES.has(segment));
}

function collectCandidateFiles(repoRoot, relativeRoot, accumulator, maxFiles) {
  if (accumulator.length >= maxFiles) {
    return;
  }

  const absoluteRoot = path.join(repoRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) {
    return;
  }

  const stats = fs.statSync(absoluteRoot);
  if (stats.isFile()) {
    if (isSafeTextFile(relativeRoot)) {
      accumulator.push(relativeRoot);
    }
    return;
  }

  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (accumulator.length >= maxFiles) {
      break;
    }

    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const relativePath = relativeRoot
      ? path.join(relativeRoot, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      collectCandidateFiles(repoRoot, relativePath, accumulator, maxFiles);
      continue;
    }

    if (entry.isFile() && isSafeTextFile(relativePath)) {
      accumulator.push(relativePath);
    }
  }
}

function inferDynamicRoots(prompt = '') {
  const normalizedPrompt = prompt.toLowerCase();
  const dynamicRoots = [];
  const selfCodePrompt =
    hasAnyWholeWord(normalizedPrompt, ['pearl', 'assistant', 'middleware', 'self']) ||
    normalizedPrompt.includes('base code') ||
    normalizedPrompt.includes('own code');
  const assetPrompt =
    hasAnyWholeWord(normalizedPrompt, ['asset', 'assets', 'biome', 'scene', 'zone', 'material', 'model', 'prefab']) ||
    normalizedPrompt.includes('overgrown');
  const progressPrompt = hasAnyWholeWord(normalizedPrompt, ['progress', 'roadmap', 'milestone', 'status', 'update']);

  if (selfCodePrompt && !assetPrompt) {
    dynamicRoots.push('src');
    dynamicRoots.push('services/pearl-runtime/server');
    dynamicRoots.push('services/pearl-runtime/package.json');
    dynamicRoots.push('README.md');
  }

  if (normalizedPrompt.includes('unity') || normalizedPrompt.includes('gameplay')) {
    dynamicRoots.push('scripts');
    dynamicRoots.push('unity');
  }

  if (normalizedPrompt.includes('playtest') || normalizedPrompt.includes('scenario')) {
    dynamicRoots.push('docs/04_scenarios_playtests');
    dynamicRoots.push('data/playtest_responses');
  }

  if (assetPrompt) {
    dynamicRoots.push('assets');
    dynamicRoots.push('data/worldbuilding');
    dynamicRoots.push('docs/03_worldbuilding');
    dynamicRoots.push('unity');
  }

  if (progressPrompt) {
    dynamicRoots.push('docs/01_canon/living_roadmap_checklist.md');
    dynamicRoots.push('CHECKPOINT_FEB_3_2026.md');
    dynamicRoots.push('data/pipeline_health');
    dynamicRoots.push('data/playtest_responses');
  }

  return dynamicRoots;
}

function scoreFilePath(relativePath, prompt = '') {
  const lowerPrompt = prompt.toLowerCase();
  const lowerPath = relativePath.toLowerCase();
  const tokens = promptTokens(prompt);
  const assetFocusedPrompt =
    hasAnyWholeWord(lowerPrompt, ['asset', 'assets', 'biome', 'scene', 'zone', 'material', 'model', 'prefab']) ||
    lowerPrompt.includes('overgrown');
  let score = 0;

  if (lowerPath === 'readme.md') score += 50;
  if (lowerPath.includes('canon')) score += 30;
  if (lowerPath.includes('design')) score += 20;
  if (lowerPath.includes('assistant')) score += 40;
  if (lowerPath.includes('middleware')) score += 35;
  if (lowerPath.includes('server')) score += 20;
  if (lowerPath.includes('route')) score += 10;
  if (lowerPath.includes('assets/') || lowerPath.startsWith('assets\\')) score += 25;
  if (lowerPath.includes('worldbuilding')) score += 25;
  if (lowerPath.includes('biome')) score += 30;
  if (lowerPath.includes('scene')) score += 20;
  if (lowerPath.includes('material') || lowerPath.endsWith('.mat')) score += 15;
  if (lowerPath.includes('model') || lowerPath.includes('prefab')) score += 15;
  if (lowerPath.includes('roadmap') || lowerPath.includes('checkpoint')) score += 45;
  if (lowerPath.includes('pipeline_health')) score += 35;
  if (lowerPrompt.includes('repo') || lowerPrompt.includes('repository')) score += 15;
  if (lowerPrompt.includes('concept') || lowerPrompt.includes('game')) score += 15;
  if (lowerPrompt.includes('opinion') || lowerPrompt.includes('thought')) score += 10;
  if (lowerPrompt.includes('code') || lowerPrompt.includes('implementation')) score += 25;
  if (lowerPrompt.includes('pearl') || lowerPrompt.includes('assistant')) score += 25;
  if (lowerPrompt.includes('asset') || lowerPrompt.includes('assets') || lowerPrompt.includes('scene')) score += 25;
  if (lowerPrompt.includes('biome') || lowerPrompt.includes('overgrown') || lowerPrompt.includes('zone')) score += 30;
  if (assetFocusedPrompt && (lowerPath.includes('pipeline') || lowerPath.includes('server') || lowerPath.includes('assistant'))) score -= 40;
  if (assetFocusedPrompt && (lowerPath.includes('assets/') || lowerPath.startsWith('assets\\'))) score += 35;
  if (assetFocusedPrompt && lowerPath.includes('worldbuilding')) score += 20;
  if (lowerPrompt.includes('progress') || lowerPrompt.includes('roadmap') || lowerPrompt.includes('milestone') || lowerPrompt.includes('status')) {
    if (lowerPath.includes('roadmap') || lowerPath.includes('checkpoint')) score += 50;
    if (lowerPath.includes('playtest')) score += 20;
  }

  for (const token of tokens) {
    if (lowerPath.includes(token)) {
      score += 8;
    }
  }

  return score;
}

function discoverRepoFiles(repoRoot, prompt = '', maxFiles = DEFAULT_MAX_DISCOVERED_FILES) {
  const roots = inferDynamicRoots(prompt);
  if (roots.length === 0) {
    roots.push('src');
    roots.push('services/pearl-runtime/server');
    roots.push('docs');
    roots.push('adapters');
    roots.push('data');
    roots.push('scripts');
    roots.push('README.md');
  }
  const discovered = [];

  for (const root of roots) {
    if (discovered.length >= maxFiles) {
      break;
    }
    collectCandidateFiles(repoRoot, root, discovered, maxFiles);
  }

  return Array.from(new Set(discovered));
}

function buildPromptRegex(tokens) {
  if (!tokens.length) {
    return null;
  }

  const escaped = tokens
    .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);

  if (!escaped.length) {
    return null;
  }

  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
}

function scoreContentMatches(content, tokenSet) {
  if (!content || !tokenSet.size) {
    return 0;
  }

  const lowerContent = content.toLowerCase();
  let score = 0;
  for (const token of tokenSet) {
    if (lowerContent.includes(token)) {
      score += 6;
    }
  }
  return score;
}

function extractSnippet(content, promptRegex) {
  if (!content) {
    return '';
  }

  const lines = content.split(/\r?\n/);
  if (!promptRegex) {
    return lines.slice(0, 14).join('\n');
  }

  let matchLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (promptRegex.test(lines[i])) {
      matchLine = i;
      break;
    }
  }

  if (matchLine < 0) {
    return lines.slice(0, 14).join('\n');
  }

  const start = Math.max(0, matchLine - SEARCH_SNIPPET_RADIUS);
  const end = Math.min(lines.length, matchLine + SEARCH_SNIPPET_RADIUS + 1);
  return lines.slice(start, end).join('\n');
}

function buildSearchContext(repoRoot, prompt, fileCandidates, budget, maxResultFiles = DEFAULT_SEARCH_RESULT_FILES) {
  const tokens = promptTokens(prompt);
  const tokenSet = new Set(tokens);
  const promptRegex = buildPromptRegex(tokens);

  const ranked = [];
  for (const relativePath of fileCandidates) {
    const content = readRepoFile(repoRoot, relativePath);
    if (!content) {
      continue;
    }

    const pathScore = scoreFilePath(relativePath, prompt);
    const contentScore = scoreContentMatches(content, tokenSet);
    const totalScore = pathScore + contentScore;
    if (totalScore <= 0) {
      continue;
    }

    ranked.push({
      relativePath,
      score: totalScore,
      content
    });
  }

  ranked.sort((left, right) => right.score - left.score);
  const selected = ranked.slice(0, Math.max(1, maxResultFiles));

  const sections = [];
  const filesUsed = [];
  let usedChars = 0;

  for (const item of selected) {
    const remainingBudget = budget - usedChars;
    if (remainingBudget <= 0) {
      break;
    }

    const snippet = extractSnippet(item.content, promptRegex);
    const header = `### ${item.relativePath} (relevance: ${item.score})`;
    const combined = `${header}\n${snippet}`;
    if (!combined.trim()) {
      continue;
    }

    const truncated = combined.slice(0, remainingBudget);
    sections.push(truncated);
    filesUsed.push(item.relativePath);
    usedChars += truncated.length + 2;
  }

  return {
    filesUsed,
    text: sections.join('\n\n')
  };
}

function summarizeRepoFiles(repoRoot, prompt, fileCandidates, budget = DEFAULT_CONTEXT_BUDGET) {
  const rankedFiles = fileCandidates
    .map(relativePath => ({
      relativePath,
      score: scoreFilePath(relativePath, prompt)
    }))
    .sort((left, right) => right.score - left.score);

  const sections = [];
  const filesUsed = [];
  let usedChars = 0;

  for (const { relativePath } of rankedFiles) {
    const content = readRepoFile(repoRoot, relativePath);
    if (!content) {
      continue;
    }

    const remainingBudget = budget - usedChars;
    if (remainingBudget <= 0) {
      break;
    }

    const truncatedContent = content.slice(0, Math.max(0, remainingBudget - relativePath.length - 32));
    if (!truncatedContent) {
      break;
    }

    sections.push(`### ${relativePath}\n${truncatedContent}`);
    filesUsed.push(relativePath);
    usedChars += truncatedContent.length + relativePath.length + 32;
  }

  return {
    filesUsed,
    text: sections.join('\n\n')
  };
}

function buildRepoContext(options = {}) {
  const {
    repoHint,
    prompt = '',
    allowedRoots = resolveAllowedRepoRoots(),
    budget = DEFAULT_CONTEXT_BUDGET,
    fileCandidates = DEFAULT_REPO_FILES,
    mode = 'search',
    maxResultFiles = DEFAULT_SEARCH_RESULT_FILES
  } = options;

  const repoRoot = resolveRepoRoot(repoHint, allowedRoots);
  if (!repoRoot || !fs.existsSync(repoRoot)) {
    return null;
  }

  const discoveredFiles = discoverRepoFiles(repoRoot, prompt);
  const mergedCandidates = Array.from(new Set([...fileCandidates, ...discoveredFiles]));
  const normalizedMode = String(mode || 'summary').toLowerCase();
  const contextResult = normalizedMode === 'search'
    ? buildSearchContext(repoRoot, prompt, mergedCandidates, budget, maxResultFiles)
    : summarizeRepoFiles(repoRoot, prompt, mergedCandidates, budget);

  if (!contextResult.text) {
    return null;
  }

  return {
    repoRoot,
    repoName: path.basename(repoRoot),
    mode: normalizedMode === 'search' ? 'search' : 'summary',
    filesUsed: contextResult.filesUsed,
    contextText: [
      `Repository name: ${path.basename(repoRoot)}`,
      `Repository root: ${repoRoot}`,
      `Repository context mode: ${normalizedMode === 'search' ? 'search' : 'summary'}`,
      'Use the following repository excerpts as grounded source material for this reply.',
      contextResult.text
    ].join('\n\n')
  };
}

module.exports = {
  DEFAULT_REPO_FILES,
  buildRepoContext,
  discoverRepoFiles,
  defaultRepoRoot,
  resolveAllowedRepoRoots,
  resolveRepoRoot
};
