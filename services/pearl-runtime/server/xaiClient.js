const { OpenAI } = require('openai');

function getXaiClient() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error(
      'XAI_API_KEY is missing or empty. Set it in services/pearl-runtime/.env.'
    );
  }

  // xAI provides an OpenAI-compatible API surface.
  // Keep this in one place so callers don't need to care about baseURL.
  return new OpenAI({
    apiKey,
    baseURL: process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
  });
}

async function xaiChatCompletion(messages = [], options = {}) {
  const model = options.model || process.env.XAI_MODEL || 'grok-2-latest';
  const client = getXaiClient();
  const resp = await client.chat.completions.create({
    model,
    messages,
    max_tokens: options.max_tokens || 1200
  });
  return resp.choices?.[0]?.message?.content ?? null;
}

module.exports = {
  getXaiClient,
  xaiChatCompletion
};
