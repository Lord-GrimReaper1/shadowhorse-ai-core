'use strict';

const DEFAULT_TARGETS = [
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'Brave Search API', url: 'https://api.search.brave.com' },
  { name: 'Tavily API', url: 'https://api.tavily.com' }
];

function hasConfiguredValue(value) {
  return Boolean(value && !String(value).toLowerCase().includes('replace-with'));
}

function configuredProviders() {
  return {
    brave_search: hasConfiguredValue(process.env.BRAVE_SEARCH_API_KEY),
    tavily: hasConfiguredValue(process.env.TAVILY_API_KEY),
    web_fetch_enabled: String(process.env.PEARL_WEB_FETCH_ENABLED || '').toLowerCase() === 'true'
  };
}

async function probeTarget(target, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual'
    });
    return {
      name: target.name,
      url: target.url,
      reachable: response.status < 500,
      status: response.status
    };
  } catch (error) {
    return {
      name: target.name,
      url: target.url,
      reachable: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function diagnose({ checkTargets = false, timeoutMs = 3000 } = {}) {
  const result = {
    node_fetch_available: typeof fetch === 'function',
    configured_providers: configuredProviders(),
    checked_targets: []
  };

  if (!checkTargets) {
    return result;
  }

  if (typeof fetch !== 'function') {
    result.error = 'Global fetch is unavailable in this Node runtime.';
    return result;
  }

  result.checked_targets = await Promise.all(
    DEFAULT_TARGETS.map(target => probeTarget(target, timeoutMs))
  );
  return result;
}

module.exports = {
  diagnose,
  configuredProviders
};
