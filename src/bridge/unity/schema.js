const ALLOWED_KINDS = new Set(['general', 'code', 'canon']);
const ALLOWED_MODES = new Set(['ask', 'act']);

export const UNITY_BRIDGE_SCHEMA = Object.freeze({
  version: '1.0',
  endpoint: '/v1/unity/ask',
  required: ['text'],
  properties: {
    text: 'string',
    kind: "'general' | 'code' | 'canon'",
    persona: 'string',
    provider: "'auto' | 'gpt' | 'copilot' | 'claude' | 'gemini' | 'grok'",
    unityContext: {
      projectName: 'string',
      sceneName: 'string',
      selectedObjects: 'string[]',
      mode: "'ask' | 'act'",
      playMode: 'boolean'
    }
  }
});

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateUnityBridgeRequest(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  if (typeof payload.text !== 'string' || payload.text.trim().length === 0) {
    errors.push('`text` is required and must be a non-empty string.');
  }

  if (payload.kind && !ALLOWED_KINDS.has(payload.kind)) {
    errors.push("`kind` must be one of: 'general', 'code', 'canon'.");
  }

  if (payload.unityContext !== undefined) {
    if (typeof payload.unityContext !== 'object' || payload.unityContext === null) {
      errors.push('`unityContext` must be an object when provided.');
    } else {
      const { selectedObjects, mode, playMode } = payload.unityContext;

      if (selectedObjects !== undefined && !isStringArray(selectedObjects)) {
        errors.push('`unityContext.selectedObjects` must be a string array when provided.');
      }

      if (mode !== undefined && !ALLOWED_MODES.has(mode)) {
        errors.push("`unityContext.mode` must be 'ask' or 'act' when provided.");
      }

      if (playMode !== undefined && typeof playMode !== 'boolean') {
        errors.push('`unityContext.playMode` must be boolean when provided.');
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function buildUnityPrompt(payload) {
  const context = payload.unityContext ?? {};
  const lines = [payload.text.trim()];

  if (context.projectName) {
    lines.push(`Unity project: ${context.projectName}`);
  }

  if (context.sceneName) {
    lines.push(`Current scene: ${context.sceneName}`);
  }

  if (Array.isArray(context.selectedObjects) && context.selectedObjects.length > 0) {
    lines.push(`Selected objects: ${context.selectedObjects.join(', ')}`);
  }

  if (context.mode) {
    lines.push(`Unity request mode: ${context.mode}`);
  }

  if (typeof context.playMode === 'boolean') {
    lines.push(`Unity play mode: ${context.playMode ? 'on' : 'off'}`);
  }

  return lines.join('\n');
}
