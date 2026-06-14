import { evaluateRequest } from '../policy/index.js';

export class Orchestrator {
  constructor({ memory } = {}) {
    this.memory = memory ?? null;
  }

  route(task) {
    const evaluation = evaluateRequest(task?.text ?? '');
    const kind = String(task?.kind ?? 'general');

    if (!evaluation.allowed) {
      return {
        route: 'blocked',
        evaluation,
        reason: 'Policy violation'
      };
    }

    if (kind === 'code') {
      return { route: 'builder', evaluation };
    }

    if (kind === 'canon') {
      return { route: 'lorekeeper', evaluation };
    }

    return { route: 'generalist', evaluation };
  }
}
