import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUnityBridgeRequest, buildUnityPrompt } from '../src/bridge/unity/schema.js';

test('unity bridge validates minimal request payload', () => {
  const result = validateUnityBridgeRequest({ text: 'Check this scene for canon issues.' });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('unity bridge rejects invalid payloads', () => {
  const result = validateUnityBridgeRequest({
    text: '',
    kind: 'unknown',
    unityContext: {
      selectedObjects: [1, 2],
      mode: 'oops'
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.length >= 2, true);
});

test('unity bridge prompt includes unity context lines', () => {
  const prompt = buildUnityPrompt({
    text: 'Assess this setup',
    unityContext: {
      projectName: 'Crossroads',
      sceneName: 'Runtime Smoke Test',
      selectedObjects: ['NPC_Patrol_01', 'Campfire_A'],
      mode: 'ask',
      playMode: false
    }
  });

  assert.match(prompt, /Crossroads/);
  assert.match(prompt, /Runtime Smoke Test/);
  assert.match(prompt, /NPC_Patrol_01/);
});
