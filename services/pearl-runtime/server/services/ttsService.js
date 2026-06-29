'use strict';

const { OpenAI } = require('openai');
const { resolvePackage } = require('../config/voicePackages');

/**
 * Synthesize text to an MP3 audio Buffer using the resolved voice package.
 *
 * @param {string} text         - Text to speak (max ~4000 chars recommended).
 * @param {string} [packageId]  - Voice package ID. Falls back to env default.
 * @returns {Promise<Buffer>}   - MP3 audio buffer ready to stream.
 */
async function synthesizeSpeech(text, packageId) {
  const pkg = resolvePackage(packageId);

  if (pkg.provider === 'elevenlabs') {
    try {
      return await synthesizeElevenLabs(text, pkg);
    } catch (error) {
      if (!pkg.fallback) {
        throw error;
      }

      console.warn(`[voice/speak] ${pkg.name || packageId} failed; falling back to ${pkg.fallback}: ${error.message}`);
      const fallbackPkg = resolvePackage(pkg.fallback);
      return synthesizeOpenAI(text, fallbackPkg);
    }
  }
  return synthesizeOpenAI(text, pkg);
}

// ---------------------------------------------------------------------------
// OpenAI TTS
// ---------------------------------------------------------------------------

async function synthesizeOpenAI(text, pkg) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: pkg.model || 'tts-1-hd',
    voice: pkg.voice || 'nova',
    input: text,
    speed: pkg.speed || 1.0,
    response_format: 'mp3',
  });

  // OpenAI SDK v4 returns a Response-like object; extract the buffer.
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// ElevenLabs TTS (native fetch — requires Node >= 18)
// ---------------------------------------------------------------------------

async function synthesizeElevenLabs(text, pkg) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');

  const voiceId = pkg.voice_id;
  if (!voiceId) throw new Error('ElevenLabs voice_id is not configured in the voice package');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`;
  const body = JSON.stringify({
    text,
    model_id: pkg.model_id || 'eleven_turbo_v2_5',
    voice_settings: {
      stability: pkg.stability ?? 0.55,
      similarity_boost: pkg.similarity_boost ?? 0.80,
      style: pkg.style ?? 0.40,
      use_speaker_boost: pkg.use_speaker_boost ?? true,
    },
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs TTS error ${resp.status}: ${errText}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { synthesizeSpeech };
