import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/memory/index.js';

test('memory store adds and returns entries', () => {
  const store = new MemoryStore();
  store.add({ type: 'canon', value: 'Human leads. AI partners. Both grow.' });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].id, 1);
});

test('memory store persists to disk', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowhorse-memory-'));
  const filePath = path.join(directory, 'memory.json');
  const store = new MemoryStore({ filePath });

  store.add({ type: 'note', value: 'Crossroads is the proving ground.' });
  await store.save();

  const reloaded = new MemoryStore({ filePath });
  await reloaded.load();

  assert.equal(reloaded.list().length, 1);
  assert.equal(reloaded.list()[0].value, 'Crossroads is the proving ground.');
});
