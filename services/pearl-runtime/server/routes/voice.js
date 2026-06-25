'use strict';

const express = require('express');
const { synthesizeSpeech } = require('../services/ttsService');
const { VOICE_PACKAGES, DEFAULT_PACKAGE } = require('../config/voicePackages');

const router = express.Router();

const MAX_TTS_LENGTH = 4096;

/**
 * POST /v1/voice/speak
 * Body: { text: string, voice_package?: string }
 * Returns: audio/mpeg binary
 *
 * Synthesizes Pearl's response as speech using the configured voice package.
 */
router.post('/speak', async (req, res) => {
  try {
    const { text, voice_package } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > MAX_TTS_LENGTH) {
      return res.status(400).json({
        error: `text too long — max ${MAX_TTS_LENGTH} characters (received ${text.length})`,
      });
    }

    const packageId = voice_package || DEFAULT_PACKAGE;
    const audioBuffer = await synthesizeSpeech(text.trim(), packageId);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-store',
    });
    return res.send(audioBuffer);
  } catch (err) {
    console.error('[voice/speak]', err.message);
    return res.status(500).json({ error: String(err.message) });
  }
});

/**
 * GET /v1/voice/packages
 * Returns available voice packages, their availability status, and the active default.
 */
router.get('/packages', (_req, res) => {
  const packages = Object.entries(VOICE_PACKAGES).map(([id, pkg]) => {
    const available =
      pkg.provider === 'openai'
        ? !!process.env.OPENAI_API_KEY
        : !!(process.env.ELEVENLABS_API_KEY && pkg.voice_id);

    return {
      id,
      name: pkg.name,
      description: pkg.description,
      provider: pkg.provider,
      available,
    };
  });

  return res.json({ packages, default: DEFAULT_PACKAGE });
});

module.exports = router;
