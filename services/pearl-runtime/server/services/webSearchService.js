'use strict';

const MAX_RESULTS = 8;
const MAX_PAGE_CHARS = 12000;
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/i
];

function cleanApiKey(value) {
  if (!value || String(value).toLowerCase().includes('replace-with')) {
    return '';
  }
  return String(value).trim();
}

function providerName(requestedProvider) {
  const requested = String(requestedProvider || process.env.PEARL_WEB_SEARCH_PROVIDER || 'brave').toLowerCase();
  if (requested === 'tavily') {
    return 'tavily';
  }
  return 'brave';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertSafePublicUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    return { ok: false, error: 'Invalid URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Only http and https URLs are supported.' };
  }

  const host = parsed.hostname;
  if (BLOCKED_HOST_PATTERNS.some(pattern => pattern.test(host))) {
    return { ok: false, error: 'Private or local network URLs are blocked.' };
  }

  return { ok: true, parsed };
}

function normalizeBraveResults(payload, maxResults) {
  const items = payload?.web?.results || [];
  return items.slice(0, maxResults).map(item => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.description || '',
    source: 'brave'
  }));
}

function normalizeTavilyResults(payload, maxResults) {
  const items = payload?.results || [];
  return items.slice(0, maxResults).map(item => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.content || '',
    score: item.score,
    source: 'tavily'
  }));
}

async function searchBrave(query, maxResults) {
  const apiKey = cleanApiKey(process.env.BRAVE_SEARCH_API_KEY);
  if (!apiKey) {
    return { configured: false, provider: 'brave', error: 'BRAVE_SEARCH_API_KEY is not configured.' };
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'x-subscription-token': apiKey
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { configured: true, provider: 'brave', error: payload?.error || `Brave search failed with HTTP ${response.status}` };
  }
  return {
    configured: true,
    provider: 'brave',
    query,
    results: normalizeBraveResults(payload, maxResults)
  };
}

async function searchTavily(query, maxResults) {
  const apiKey = cleanApiKey(process.env.TAVILY_API_KEY);
  if (!apiKey) {
    return { configured: false, provider: 'tavily', error: 'TAVILY_API_KEY is not configured.' };
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { configured: true, provider: 'tavily', error: payload?.error || `Tavily search failed with HTTP ${response.status}` };
  }
  return {
    configured: true,
    provider: 'tavily',
    query,
    results: normalizeTavilyResults(payload, maxResults)
  };
}

async function search({ query, provider, maxResults = 5 } = {}) {
  if (!query || typeof query !== 'string') {
    return { error: 'query is required.' };
  }
  if (typeof fetch !== 'function') {
    return { error: 'Global fetch is unavailable in this Node runtime.' };
  }

  const safeMax = Math.min(Math.max(1, Number(maxResults) || 5), MAX_RESULTS);
  const selectedProvider = providerName(provider);
  if (selectedProvider === 'tavily') {
    return searchTavily(query, safeMax);
  }
  return searchBrave(query, safeMax);
}

async function readPage({ url, maxChars = MAX_PAGE_CHARS } = {}) {
  if (String(process.env.PEARL_WEB_FETCH_ENABLED || '').toLowerCase() !== 'true') {
    return { configured: false, error: 'PEARL_WEB_FETCH_ENABLED is not true.' };
  }
  if (typeof fetch !== 'function') {
    return { error: 'Global fetch is unavailable in this Node runtime.' };
  }

  const safeUrl = assertSafePublicUrl(url);
  if (!safeUrl.ok) {
    return { error: safeUrl.error };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(safeUrl.parsed.toString(), {
      signal: controller.signal,
      headers: { accept: 'text/html, text/plain;q=0.9, */*;q=0.5' }
    });
    const raw = await response.text();
    const text = stripHtml(raw);
    const safeMax = Math.min(Math.max(500, Number(maxChars) || MAX_PAGE_CHARS), MAX_PAGE_CHARS);
    return {
      configured: true,
      url: safeUrl.parsed.toString(),
      status: response.status,
      ok: response.ok,
      content: text.slice(0, safeMax),
      truncated: text.length > safeMax,
      total_chars: text.length
    };
  } catch (error) {
    return { configured: true, url, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  search,
  readPage,
  stripHtml,
  assertSafePublicUrl
};
