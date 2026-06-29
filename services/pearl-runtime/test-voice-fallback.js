const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { VOICE_PACKAGES, resolvePackage } = require('./server/config/voicePackages');

test('ElevenLabs voice package declares OpenAI fallback', () => {
  assert.equal(VOICE_PACKAGES['pearl-russian-blue'].provider, 'elevenlabs');
  assert.equal(VOICE_PACKAGES['pearl-russian-blue'].fallback, 'pearl-default');
});

test('ElevenLabs voice resolves to fallback when not configured', () => {
  const previousKey = process.env.ELEVENLABS_API_KEY;
  const previousVoice = process.env.ELEVENLABS_VOICE_ID_RUSSIAN_BLUE;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID_RUSSIAN_BLUE;
  try {
    const resolved = resolvePackage('pearl-russian-blue');
    assert.equal(resolved.provider, 'openai');
    assert.equal(resolved.voice, 'nova');
  } finally {
    if (previousKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = previousKey;
    if (previousVoice === undefined) delete process.env.ELEVENLABS_VOICE_ID_RUSSIAN_BLUE;
    else process.env.ELEVENLABS_VOICE_ID_RUSSIAN_BLUE = previousVoice;
  }
});

test('TTS service falls back when ElevenLabs synthesis fails', () => {
  const source = fs.readFileSync(require.resolve('./server/services/ttsService'), 'utf8');
  assert.match(source, /falling back to/);
  assert.match(source, /resolvePackage\(pkg\.fallback\)/);
  assert.match(source, /synthesizeOpenAI\(text, fallbackPkg\)/);
});
