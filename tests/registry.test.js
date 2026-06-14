import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSpecialistRegistry } from '../src/registry/index.js';

test('default registry exposes the builder specialist', () => {
  const registry = createDefaultSpecialistRegistry();

  assert.equal(registry.get('builder').name, 'Copilot');
  assert.equal(registry.list().length, 3);
});
