'use strict';

const PEARL_NAME_PATTERNS = [
  /\bperot\b/gi,
  /\bpero\b/gi,
  /\bperal\b/gi,
  /\bperl\b/gi,
  /\bpurl\b/gi,
  /\bpearl's\b/gi,
];

const PHRASE_REPLACEMENTS = [
  [/\bprime directives?\b/gi, 'Prime Directive'],
  [/\btext to speech\b/gi, 'text-to-speech'],
  [/\bspeech to text\b/gi, 'speech-to-text'],
  [/\bpackage manager\b/gi, 'Package Manager'],
  [/\bcrossroads game\b/gi, 'Crossroads game'],
  [/\bshadow forest ai core\b/gi, 'Shadowhorse AI core'],
  [/\bshadow force ai core\b/gi, 'Shadowhorse AI core'],
  [/\bshadowhorse ai core\b/gi, 'Shadowhorse AI core'],
];

function collapseWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function removeLeadingFillers(text) {
  return text.replace(/^(?:um+|uh+|er+|ah+|okay|ok|so|well|like|you know)[,\s]+/i, '').trim();
}

function normalizePearlName(text, corrections) {
  let output = text;
  for (const pattern of PEARL_NAME_PATTERNS) {
    output = output.replace(pattern, (match) => {
      if (match.toLowerCase() !== 'pearl') corrections.push({ from: match, to: 'Pearl', reason: 'assistant_name' });
      return 'Pearl';
    });
  }
  return output;
}

function applyPhraseReplacements(text, corrections) {
  let output = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    output = output.replace(pattern, (match) => {
      if (match !== replacement) corrections.push({ from: match, to: replacement, reason: 'studio_vocabulary' });
      return replacement;
    });
  }
  return output;
}

function normalizeTranscription(rawText) {
  const raw = String(rawText || '');
  const corrections = [];
  let text = collapseWhitespace(raw);
  text = removeLeadingFillers(text);
  text = normalizePearlName(text, corrections);
  text = applyPhraseReplacements(text, corrections);
  text = collapseWhitespace(text);

  return {
    text,
    raw_text: raw,
    changed: text !== collapseWhitespace(raw),
    corrections,
  };
}

function buildWhisperPrompt(extraPrompt) {
  const basePrompt = [
    'Pearl is the Shadowhorse Games studio AI assistant.',
    'Common words and names: Pearl, Shadowhorse AI core, Crossroads game, Unity, Package Manager, Prime Directive, speech-to-text, text-to-speech, ElevenLabs.',
    'The speaker may use casual language, slang, fragments, and conversational phrasing. Preserve intent clearly.'
  ].join(' ');

  const extra = collapseWhitespace(extraPrompt || process.env.PEARL_WHISPER_PROMPT || '');
  return extra ? `${basePrompt} ${extra}` : basePrompt;
}

module.exports = { normalizeTranscription, buildWhisperPrompt };
