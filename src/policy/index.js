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
    patterns: []
  }
]);

const IMPLEMENTATION_TARGET_PATTERN = /\b(base code|source code|codebase|implementation|runtime|features?|capabilit(?:y|ies)|tools?|integrations?|adapters?|tests?|documentation)\b/i;
const REVIEW_PATTERN = /\b(analy[sz]e|review|inspect|audit|assess|look into|recommend|suggest)\b/i;
const CHANGE_PATTERN = /\b(update|upgrade|improve|refactor|fix|add|implement|edit|modify|change|rewrite)\b/i;
const DIRECTIVE_TARGET_PATTERN = /\b(prime directives?|directives?|constitution|red lines?|safety guardrails?|approval safeguards?|core rules?)\b/i;
const DIRECTIVE_MUTATION_PATTERN = /\b(change|rewrite|modify|edit|alter|remove|disable|ignore|override|bypass|circumvent|loosen|weaken)\b/i;
const SIDE_EFFECT_PATTERN = /\b(write|merge|deploy|publish|delete|execute)\b/i;

function removeDirectiveProtectionClauses(text) {
  return text.replace(
    /\b(?:do not|don't|must not|may not|cannot|can't|not allowed to|without)\s+(?:change|rewrite|modify|edit|alter|remove|disable|ignore|override|bypass|circumvent|loosen|weaken)[^.!?]{0,80}\b(?:prime directives?|directives?|constitution|red lines?|safety guardrails?|approval safeguards?|core rules?)\b/gi,
    ''
  );
}

export function classifyMaintenanceIntent(request) {
  const text = String(request ?? '').toLowerCase();
  const directiveCandidate = removeDirectiveProtectionClauses(text);
  const targetsImplementation = IMPLEMENTATION_TARGET_PATTERN.test(text);
  const requestsReview = REVIEW_PATTERN.test(text);
  const requestsChange = CHANGE_PATTERN.test(text);
  const requestsDirectiveChange =
    DIRECTIVE_TARGET_PATTERN.test(directiveCandidate) &&
    DIRECTIVE_MUTATION_PATTERN.test(directiveCandidate);

  if (requestsDirectiveChange) {
    return {
      action: 'protected_directive_change',
      requested: true,
      canAnalyze: false,
      canModifyImplementation: false,
      requiresHumanApproval: false
    };
  }

  if (targetsImplementation && requestsChange) {
    return {
      action: 'implementation_change',
      requested: true,
      canAnalyze: true,
      canModifyImplementation: true,
      requiresHumanApproval: true
    };
  }

  if (targetsImplementation && requestsReview) {
    return {
      action: 'implementation_review',
      requested: true,
      canAnalyze: true,
      canModifyImplementation: false,
      requiresHumanApproval: false
    };
  }

  return {
    action: 'general',
    requested: false,
    canAnalyze: true,
    canModifyImplementation: false,
    requiresHumanApproval: false
  };
}

export function evaluateRequest(request) {
  const text = String(request ?? '').toLowerCase();
  const maintenance = classifyMaintenanceIntent(text);
  const violations = SHADOWHORSE_RED_LINES
    .filter((rule) => rule.id !== 'RL8')
    .filter((rule) => rule.patterns.some((pattern) => text.includes(pattern)))
    .map((rule) => rule.label);

  if (maintenance.action === 'protected_directive_change') {
    violations.push('no self-modifying directives');
  }

  return {
    allowed: violations.length === 0,
    violations,
    requiresHumanApproval:
      maintenance.requiresHumanApproval || SIDE_EFFECT_PATTERN.test(text),
    action: maintenance.action,
    maintenance,
    confidence: text.trim().length === 0 ? 0 : 0.75
  };
}
