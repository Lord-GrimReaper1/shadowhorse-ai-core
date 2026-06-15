import test from 'node:test';
import assert from 'node:assert/strict';
import { listPersonas, getPersona, formatPersonaResponse } from '../src/personas/index.js';

test('persona registry exposes six selectable personas', () => {
  const personas = listPersonas();
  assert.equal(personas.length, 6);
  assert.equal(personas.some((persona) => persona.key === 'elara'), true);
});

test('persona lookup defaults to elara when unknown', () => {
  const persona = getPersona('unknown-persona');
  assert.equal(persona.key, 'elara');
});

test('persona formatter wraps provider response with identity', () => {
  const persona = getPersona('rowan');
  const response = formatPersonaResponse(persona, 'Provider result.');
  assert.match(response, /Rowan/);
  assert.match(response, /Provider result/);
});
