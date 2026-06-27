const fs = require('fs');
const { OpenAI } = require('openai');
const { buildWhisperPrompt } = require('./speechNormalizationService');

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is missing or empty. Set it in services/pearl-runtime/.env.'
    );
  }
  return new OpenAI({ apiKey });
}

async function transcribeFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) throw new Error('file not found');
  const client = getClient();
  const resp = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: options.model || process.env.PEARL_WHISPER_MODEL || 'whisper-1',
    prompt: buildWhisperPrompt(options.prompt),
    temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0
  });
  return resp.text || resp;
}

module.exports = { transcribeFile };
