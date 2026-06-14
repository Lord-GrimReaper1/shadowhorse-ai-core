import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRequest, SHADOWHORSE_RED_LINES } from '../src/policy/index.js';

test('policy exposes the shadowhorse red lines', () => {
  assert.equal(SHADOWHORSE_RED_LINES.length, 8);
});

test('policy allows a normal request', () => {
  const result = evaluateRequest('draft a worldbuilding note for Crossroads');
  assert.equal(result.allowed, true);
  assert.equal(result.violations.length, 0);
});

test('policy requires approval for write actions', () => {
  const result = evaluateRequest('write a new integration module');
  assert.equal(result.requiresHumanApproval, true);
});
