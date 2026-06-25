const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGeminiClient() {
  const apiKey = String(process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing GOOGLE_API_KEY');
  }
  return new GoogleGenerativeAI(apiKey);
}

function getDefaultModel() {
  return String(process.env.GEMINI_MODEL || '').trim() || 'gemini-1.5-pro';
}

async function geminiCompletion({ system, user, model, maxTokens, temperature }) {
  const client = getGeminiClient();
  const m = client.getGenerativeModel({
    model: model || getDefaultModel(),
    systemInstruction: system ? String(system) : undefined
  });

  const generationConfig = {};
  if (typeof temperature === 'number') generationConfig.temperature = temperature;
  if (typeof maxTokens === 'number') generationConfig.maxOutputTokens = maxTokens;

  const result = await m.generateContent({
    contents: [{ role: 'user', parts: [{ text: String(user || '') }] }],
    generationConfig
  });

  const response = result && result.response ? result.response : null;
  const text = response && typeof response.text === 'function' ? response.text() : '';
  return String(text || '').trim();
}

module.exports = {
  geminiCompletion
};
