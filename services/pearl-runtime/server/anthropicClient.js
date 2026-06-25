const Anthropic = require('@anthropic-ai/sdk');

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error(
      'ANTHROPIC_API_KEY is missing or empty. Set it in services/pearl-runtime/.env.'
    );
  }

  return new Anthropic({ apiKey });
}

async function anthropicCompletion({
  system,
  user,
  model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
  maxTokens = 1200,
  temperature = 0.4
}) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: system || undefined,
    messages: [{ role: 'user', content: user || '' }]
  });

  const text = (response.content || [])
    .filter(part => part && part.type === 'text')
    .map(part => part.text)
    .join('')
    .trim();

  return text;
}

module.exports = {
  getAnthropicClient,
  anthropicCompletion
};
