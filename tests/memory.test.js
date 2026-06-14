import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/memory/index.js';

test('memory store adds and returns entries', () => {
  const store = new MemoryStore();
  store.add({ type: 'canon', value: 'Human leads. AI partners. Both grow.' });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].id, 1);
});
