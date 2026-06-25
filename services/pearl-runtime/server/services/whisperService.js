const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

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
    model: options.model || 'whisper-1'
  });
  // The SDK returns a text field for transcription
  return resp.text || resp;
}

module.exports = { transcribeFile };
