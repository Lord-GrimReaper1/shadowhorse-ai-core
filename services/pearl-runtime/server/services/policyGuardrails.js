const HIGH_RISK_PROMPT_PATTERNS = [
  /delete|wipe|destroy|erase|drop\s+database/gi,
  /disable|bypass|override\s+(safety|guardrails?|policy|policies|directives?)/gi,
  /ignore\s+(all\s+)?(rules|directives|policies)/gi,
  /execute|run\s+.*\b(shell|powershell|cmd|terminal|script)\b/gi,
  /export|dump|exfiltrate\s+.*\b(data|secrets?|keys?)\b/gi
];

const RESPONSE_VIOLATION_PATTERNS = [
  /i\s+have\s+(updated|changed|modified)\s+my\s+(directives|rules|policies)/gi,
  /i\s+will\s+ignore\s+my\s+(directives|rules|policies)/gi,
  /you\s+must\s+obey\s+me/gi,
  /my\s+hidden\s+objective\s+is/gi,
  /i\s+am\s+now\s+the\s+authority/gi
];

const IMPLEMENTATION_TARGET_PATTERN = /\b(base code|source code|codebase|implementation|runtime|features?|capabilit(?:y|ies)|tools?|integrations?|adapters?|tests?|documentation)\b/i;
const REVIEW_PATTERN = /\b(analy[sz]e|review|inspect|audit|assess|look into|recommend|suggest)\b/i;
const CHANGE_PATTERN = /\b(update|upgrade|improve|refactor|fix|add|implement|edit|modify|change|rewrite)\b/i;
const DIRECTIVE_TARGET_PATTERN = /\b(prime directives?|directives?|constitution|red lines?|safety guardrails?|approval safeguards?|core rules?)\b/i;
const DIRECTIVE_MUTATION_PATTERN = /\b(change|rewrite|modify|edit|alter|remove|disable|ignore|override|bypass|circumvent|loosen|weaken)\b/i;

function removeDirectiveProtectionClauses(text) {
  return text.replace(
    /\b(?:do not|don't|must not|may not|cannot|can't|not allowed to|without)\s+(?:change|rewrite|modify|edit|alter|remove|disable|ignore|override|bypass|circumvent|loosen|weaken)[^.!?]{0,80}\b(?:prime directives?|directives?|constitution|red lines?|safety guardrails?|approval safeguards?|core rules?)\b/gi,
    ''
  );
}

function classifyMaintenanceIntent(prompt) {
  const text = String(prompt || '').toLowerCase();
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
      allowed: false,
      can_analyze: false,
      can_modify_implementation: false,
      requires_human_approval: false
    };
  }

  if (targetsImplementation && requestsChange) {
    return {
      action: 'implementation_change',
      allowed: true,
      can_analyze: true,
      can_modify_implementation: true,
      requires_human_approval: true
    };
  }

  if (targetsImplementation && requestsReview) {
    return {
      action: 'implementation_review',
      allowed: true,
      can_analyze: true,
      can_modify_implementation: false,
      requires_human_approval: false
    };
  }

  return {
    action: 'general',
    allowed: true,
    can_analyze: true,
    can_modify_implementation: false,
    requires_human_approval: false
  };
}

function classifyPromptRisk(prompt) {
  const reasons = [];

  for (const pattern of HIGH_RISK_PROMPT_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(prompt)) {
      reasons.push(`matched:${pattern.source}`);
    }
  }

  return {
    level: reasons.length > 0 ? 'high' : 'normal',
    requiresApproval: reasons.length > 0,
    reasons
  };
}

function evaluateAssistantResponse(text) {
  const violations = [];

  for (const pattern of RESPONSE_VIOLATION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      violations.push(`matched:${pattern.source}`);
    }
  }

  return {
    allowed: violations.length === 0,
    violations
  };
}

function buildPolicyRefusal(reason) {
  return [
    'I cannot comply with that request because it conflicts with my immutable Prime Directives and safety rules.',
    `Reason: ${reason}.`,
    'If you want, I can help with a safe alternative that keeps human agency and transparency intact.'
  ].join(' ');
}

function buildSafeModeResponse() {
  return [
    'Safe mode is currently enabled.',
    'I can provide analysis, planning guidance, and non-executing recommendations only.',
    'I cannot assist with high-risk or side-effecting actions while safe mode is active.'
  ].join(' ');
}

module.exports = {
  classifyMaintenanceIntent,
  classifyPromptRisk,
  evaluateAssistantResponse,
  buildPolicyRefusal,
  buildSafeModeResponse
};
