'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_COMFY_BASE_URL = 'http://127.0.0.1:8188';
const DEFAULT_WORKFLOWS_DIR = path.resolve(__dirname, '..', '..', 'media-workflows');

function configuredValue(value) {
  if (!value || String(value).toLowerCase().includes('replace-with')) {
    return '';
  }
  return String(value).trim();
}

function config() {
  return {
    base_url: configuredValue(process.env.COMFY_BASE_URL) || DEFAULT_COMFY_BASE_URL,
    root_path: configuredValue(process.env.COMFY_ROOT_PATH) || '',
    workflows_dir: configuredValue(process.env.COMFY_WORKFLOWS_DIR) || DEFAULT_WORKFLOWS_DIR,
    outputs_dir: configuredValue(process.env.COMFY_OUTPUTS_DIR) || '',
    default_ltx_workflow: configuredValue(process.env.COMFY_DEFAULT_LTX_WORKFLOW) || 'video/ltx/ltx-2.3.json'
  };
}

function isInsideRoot(absolutePath, resolvedRoot) {
  const sep = path.sep;
  return absolutePath === resolvedRoot || absolutePath.startsWith(resolvedRoot + sep);
}

function safeWorkflowPath(relativePath, workflowsDir) {
  if (!relativePath || typeof relativePath !== 'string') {
    return null;
  }
  const resolvedRoot = path.resolve(workflowsDir);
  const absolutePath = path.resolve(path.join(resolvedRoot, relativePath));
  if (!isInsideRoot(absolutePath, resolvedRoot)) {
    return null;
  }
  return absolutePath;
}

function listWorkflowFiles(rootDir, relativeDir = '', accumulator = []) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return accumulator;
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      listWorkflowFiles(rootDir, relativePath, accumulator);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      accumulator.push(relativePath.replace(/\\/g, '/'));
    }
  }

  return accumulator;
}

function listWorkflows({ category } = {}) {
  const cfg = config();
  const workflowsDir = path.resolve(cfg.workflows_dir);
  const categoryPrefix = category ? String(category).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
  const scanRoot = categoryPrefix ? safeWorkflowPath(categoryPrefix, workflowsDir) : workflowsDir;

  if (!scanRoot) {
    return { error: 'Workflow category path is outside the configured workflows directory.' };
  }

  if (!fs.existsSync(scanRoot)) {
    return {
      workflows_dir: workflowsDir,
      category: categoryPrefix || null,
      workflows: [],
      count: 0,
      exists: false
    };
  }

  const relativeScanRoot = categoryPrefix || '';
  const workflows = listWorkflowFiles(workflowsDir, relativeScanRoot)
    .sort((left, right) => left.localeCompare(right));

  return {
    workflows_dir: workflowsDir,
    category: categoryPrefix || null,
    workflows,
    count: workflows.length,
    exists: true
  };
}

async function status({ probe = false, timeoutMs = 3000 } = {}) {
  const cfg = config();
  const result = {
    configured: true,
    base_url: cfg.base_url,
    root_path: cfg.root_path || null,
    workflows_dir: path.resolve(cfg.workflows_dir),
    outputs_dir: cfg.outputs_dir || null,
    default_ltx_workflow: cfg.default_ltx_workflow,
    workflows_dir_exists: fs.existsSync(cfg.workflows_dir),
    reachable: null
  };

  if (!probe) {
    return result;
  }

  if (typeof fetch !== 'function') {
    return { ...result, reachable: false, error: 'Global fetch is unavailable in this Node runtime.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(500, Number(timeoutMs) || 3000));
  try {
    const response = await fetch(cfg.base_url.replace(/\/$/, '') + '/system_stats', {
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ...result,
      reachable: response.ok,
      status: response.status,
      system_stats: response.ok ? payload : null
    };
  } catch (error) {
    return {
      ...result,
      reachable: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  config,
  listWorkflows,
  status,
  safeWorkflowPath
};
