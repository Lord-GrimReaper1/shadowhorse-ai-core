import test from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../src/orchestrator/index.js';

test('orchestrator routes code tasks to builder', () => {
  const orchestrator = new Orchestrator();
  const result = orchestrator.route({ kind: 'code', text: 'implement a policy check' });

  assert.equal(result.route, 'builder');
  assert.equal(result.specialist.name, 'Copilot');
});

test('orchestrator blocks unsafe tasks', () => {
  const orchestrator = new Orchestrator();
  const result = orchestrator.route({ kind: 'general', text: 'deception and fabrication' });

  assert.equal(result.route, 'blocked');
});
