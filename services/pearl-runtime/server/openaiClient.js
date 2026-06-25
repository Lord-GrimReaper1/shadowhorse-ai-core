const { OpenAI } = require("openai");

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing or empty. Set it in services/pearl-runtime/.env."
    );
  }
  return new OpenAI({ apiKey });
}

async function chatCompletion(messages = [], options = {}) {
  const model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = getClient();
  const resp = await client.chat.completions.create({
    model,
    messages,
    max_tokens: options.max_tokens || 1200
  });
  return resp.choices?.[0]?.message?.content ?? null;
}

module.exports = { chatCompletion };
