import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonStore } from '../src/canon/index.js';

test('canon store adds entries in memory', () => {
  const store = new CanonStore();
  store.add({ type: 'directive', value: 'Human leads. AI partners. Both grow.' });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].id, 1);
});
