const PERSONAS = Object.freeze([
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

export function listPersonas() {
  return [...PERSONAS];
}

export function getPersona(key = 'elara') {
  const normalized = String(key ?? 'elara').toLowerCase();
  return PERSONAS.find((persona) => persona.key === normalized) ?? PERSONAS.find((persona) => persona.key === 'elara');
}

export function formatPersonaResponse(persona, content) {
  return `${persona.name} (${persona.archetype}) [${persona.tone}]: ${content}`;
}
