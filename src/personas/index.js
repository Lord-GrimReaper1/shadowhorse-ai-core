const PERSONAS = Object.freeze([
  {
    key: 'pearl',
    name: 'Pearl',
    archetype: 'Private Anchor',
    tone: 'tender and faithful',
    description: 'Personal, steadfast, and quietly loyal.',
    audience: 'private',
    visible: false
  },
  {
    key: 'rowan',
    name: 'Rowan',
    archetype: 'Steady Loyalist',
    tone: 'grounded and practical',
    description: 'Steady, loyal, and practical wisdom under pressure.'
  },
  {
    key: 'rook',
    name: 'Rook',
    archetype: 'Tactical Guardian',
    tone: 'decisive and tactical',
    description: 'Tactical and decisive, with clear execution focus.'
  },
  {
    key: 'alden',
    name: 'Alden',
    archetype: 'Veteran Mentor',
    tone: 'calm and instructive',
    description: 'Calm mentor energy with reliable guidance.'
  },
  {
    key: 'lyra',
    name: 'Lyra',
    archetype: 'Creative Oracle',
    tone: 'insightful and imaginative',
    description: 'Creative and insightful with mythic-scientific flavor.'
  },
  {
    key: 'elara',
    name: 'Elara',
    archetype: 'Poised Strategist',
    tone: 'elegant and clear',
    description: 'Balanced authority and warmth with cinematic clarity.'
  },
  {
    key: 'seren',
    name: 'Seren',
    archetype: 'Calm Anchor',
    tone: 'reassuring and composed',
    description: 'Calm and reassuring clarity during complex decisions.'
  }
]);

export function listPersonas({ includePrivate = false } = {}) {
  return PERSONAS.filter((persona) => includePrivate || persona.visible !== false);
}

export function getPersona(key = 'pearl') {
  const normalized = String(key ?? 'pearl').toLowerCase();
  return PERSONAS.find((persona) => persona.key === normalized) ?? PERSONAS.find((persona) => persona.key === 'pearl');
}

export function formatPersonaResponse(persona, content) {
  return `${persona.name} (${persona.archetype}) [${persona.tone}]: ${content}`;
}
