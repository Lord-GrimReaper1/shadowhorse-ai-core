const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeTranscription, buildWhisperPrompt } = require('./server/services/speechNormalizationService');

test('normalizes common Pearl dictation mistakes', () => {
  const result = normalizeTranscription('Um, Perot, how many humans approve a prime directive change?');

  assert.equal(result.text, 'Pearl, how many humans approve a Prime Directive change?');
  assert.equal(result.changed, true);
  assert.equal(result.corrections.some(item => item.reason === 'assistant_name' && item.to === 'Pearl'), true);
  assert.equal(result.corrections.some(item => item.reason === 'studio_vocabulary' && item.to === 'Prime Directive'), true);
});

test('normalizes studio voice vocabulary without changing intent', () => {
  const result = normalizeTranscription('pearl reconnect speech to text and text to speech for the shadow forest ai core');

  assert.equal(result.text, 'Pearl reconnect speech-to-text and text-to-speech for the Shadowhorse AI core');
  assert.equal(result.changed, true);
});

test('whisper prompt includes Pearl studio vocabulary', () => {
  const prompt = buildWhisperPrompt('Prefer Crossroads project terms.');

  assert.match(prompt, /Pearl/);
  assert.match(prompt, /Shadowhorse AI core/);
  assert.match(prompt, /Prime Directive/);
  assert.match(prompt, /Crossroads project terms/);
});
