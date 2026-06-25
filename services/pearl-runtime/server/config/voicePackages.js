'use strict';

/**
 * Voice package definitions for Pearl.
 *
 * provider: 'openai' | 'elevenlabs'
 *
 * OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
 * ElevenLabs: supply voice_id from https://elevenlabs.io/voice-library
 *             Requires ELEVENLABS_API_KEY in .env.
 *             Falls back to `fallback` package when key or voice_id is absent.
 *
 * To activate Russian Blue: add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID_RUSSIAN_BLUE
 * to your .env, then set PEARL_VOICE_PACKAGE=pearl-russian-blue.
 */
const OPENAI_TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

function buildOpenAIPackage(voice, name, description) {
  return {
    name,
    description,
    provider: 'openai',
    voice,
    model: 'tts-1-hd',
    speed: 1.0,
  };
}

const OPENAI_VOICE_PACKAGES = Object.fromEntries(
  OPENAI_TTS_VOICES.filter((voice) => voice !== 'nova').map((voice) => [
    `pearl-openai-${voice}`,
    buildOpenAIPackage(
      voice,
      `Pearl – OpenAI ${voice[0].toUpperCase()}${voice.slice(1)}`,
      `OpenAI TTS voice '${voice}' for Pearl.`
    ),
  ])
);

const VOICE_PACKAGES = {
  'pearl-default': buildOpenAIPackage(
    'nova',
    'Pearl – Default (OpenAI Nova)',
    'Clear, warm assistant voice via OpenAI TTS (nova).'
  ),
  ...OPENAI_VOICE_PACKAGES,

  'pearl-russian-blue': {
    name: 'Pearl – Russian Blue',
    description:
      'Warm, subtly Russian-accented personality — easily understandable but distinctly her own.',
    provider: 'elevenlabs',
    // Set ELEVENLABS_VOICE_ID_RUSSIAN_BLUE in .env to the ElevenLabs voice ID you select.
    // Browse accent voices at: https://elevenlabs.io/voice-library
    // Recommended search terms: "Russian female", "Slavic", "accented English"
    voice_id: process.env.ELEVENLABS_VOICE_ID_RUSSIAN_BLUE || '',
    model_id: 'eleven_turbo_v2_5',
    stability: 0.55,
    similarity_boost: 0.80,
    style: 0.40,
    use_speaker_boost: true,
    // Fallback to this package when ElevenLabs is not yet configured.
    fallback: 'pearl-default',
  },
};

/** Active voice package — override via PEARL_VOICE_PACKAGE env var. */
const DEFAULT_PACKAGE = process.env.PEARL_VOICE_PACKAGE || 'pearl-default';

/**
 * Resolve the effective voice package, following the fallback chain when
 * the requested provider's API key or voice_id is not present.
 *
 * @param {string} [packageId]
 * @returns {object} Resolved voice package definition.
 */
function resolvePackage(packageId) {
  const pkg = VOICE_PACKAGES[packageId] || VOICE_PACKAGES[DEFAULT_PACKAGE];

  if (pkg.provider === 'elevenlabs') {
    const hasKey = !!process.env.ELEVENLABS_API_KEY;
    const hasVoice = !!pkg.voice_id;
    if (!hasKey || !hasVoice) {
      const fallbackId = pkg.fallback || 'pearl-default';
      return VOICE_PACKAGES[fallbackId] || VOICE_PACKAGES['pearl-default'];
    }
  }

  return pkg;
}

module.exports = { VOICE_PACKAGES, DEFAULT_PACKAGE, resolvePackage };
