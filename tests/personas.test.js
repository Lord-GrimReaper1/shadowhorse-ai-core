import test from 'node:test';
import assert from 'node:assert/strict';
import { listPersonas, getPersona, formatPersonaResponse } from '../src/personas/index.js';

test('persona registry exposes six selectable personas', () => {
  const personas = listPersonas();
  assert.equal(personas.length, 6);
  assert.equal(personas.some((persona) => persona.key === 'elara'), true);
});

test('persona registry keeps pearl private by default', () => {
  const personas = listPersonas();
  assert.equal(personas.some((persona) => persona.key === 'pearl'), false);
  assert.equal(listPersonas({ includePrivate: true }).some((persona) => persona.key === 'pearl'), true);
});

test('persona lookup defaults to pearl when unknown', () => {
  const persona = getPersona('unknown-persona');
  assert.equal(persona.key, 'pearl');
});

test('persona formatter wraps provider response with identity', () => {
  const persona = getPersona('rowan');
  const response = formatPersonaResponse(persona, 'Provider result.');
  assert.match(response, /Rowan/);
  assert.match(response, /Provider result/);
});
