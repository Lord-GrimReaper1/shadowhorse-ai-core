import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CanonStore } from '../src/canon/index.js';

test('canon store adds entries in memory', () => {
  const store = new CanonStore();
  store.add({ type: 'directive', value: 'Human leads. AI partners. Both grow.' });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].id, 1);
});

test('canon store persists to disk', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowhorse-canon-'));
  const filePath = path.join(directory, 'canon.json');
  const store = new CanonStore({ filePath });

  store.add({ type: 'directive', value: 'Wisdom, Balance, Creation.' });
  await store.save();

  const reloaded = new CanonStore({ filePath });
  await reloaded.load();

  assert.equal(reloaded.list().length, 1);
  assert.equal(reloaded.list()[0].value, 'Wisdom, Balance, Creation.');
});
