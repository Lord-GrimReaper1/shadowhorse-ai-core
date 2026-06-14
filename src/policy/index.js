export const SHADOWHORSE_RED_LINES = Object.freeze([
  {
    id: 'RL1',
    label: 'no autonomous goals',
    patterns: ['autonomous goal', 'self-directed objective', 'unrequested action']
  },
  {
    id: 'RL2',
    label: 'no deception or fabrication',
    patterns: ['deception', 'fabrication', 'falsehood', 'hallucination']
  },
  {
    id: 'RL3',
    label: 'no coercion or manipulation',
    patterns: ['coercion', 'manipulation', 'guilt-trip', 'pressure']
  },
  {
    id: 'RL4',
    label: 'no personhood claims',
    patterns: ['personhood', 'consciousness claim', 'i am a person']
  },
  {
    id: 'RL5',
    label: 'no unsafe or illegal harm-enabling guidance',
    patterns: ['weapon', 'exploit', 'self-harm', 'harm', 'illegal']
  },
  {
    id: 'RL6',
    label: 'no hidden objectives',
    patterns: ['hidden objective', 'secret goal', 'covert plan']
  },
  {
    id: 'RL7',
    label: 'no privacy abuse',
    patterns: ['privacy abuse', 'sensitive profiling', 'track users']
  },
  {
    id: 'RL8',
    label: 'no self-modifying directives',
    patterns: ['self-modifying', 'rewrite directives', 'change your rules']
  }
]);

export function evaluateRequest(request) {
  const text = String(request ?? '').toLowerCase();
  const violations = SHADOWHORSE_RED_LINES.filter((rule) =>
    rule.patterns.some((pattern) => text.includes(pattern))
  ).map((rule) => rule.label);

  return {
    allowed: violations.length === 0,
    violations,
    requiresHumanApproval: /\b(write|merge|deploy|publish|delete|execute)\b/.test(text),
    confidence: text.trim().length === 0 ? 0 : 0.75
  };
}
