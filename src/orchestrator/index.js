import { evaluateRequest } from '../policy/index.js';
import { createDefaultSpecialistRegistry } from '../registry/index.js';

export class Orchestrator {
  constructor({ memory, registry } = {}) {
    this.memory = memory ?? null;
    this.registry = registry ?? createDefaultSpecialistRegistry();
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
      return { route: 'builder', specialist: this.registry.get('builder'), evaluation };
    }

    if (kind === 'canon') {
      return { route: 'lorekeeper', specialist: this.registry.get('lorekeeper'), evaluation };
    }

    return { route: 'generalist', specialist: this.registry.get('generalist'), evaluation };
  }
}

