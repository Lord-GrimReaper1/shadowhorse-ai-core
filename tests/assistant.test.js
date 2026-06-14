import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runAssistant } from '../src/assistant/index.js';

test('assistant auto-routes and returns response', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowhorse-assistant-'));
  const canonFile = path.join(directory, 'canon.json');
  const memoryFile = path.join(directory, 'memory.json');
  const telemetryFile = path.join(directory, 'telemetry.json');

  await fs.writeFile(canonFile, JSON.stringify({ version: '1.2', entries: [] }, null, 2), 'utf8');
  await fs.writeFile(memoryFile, JSON.stringify({ entries: [] }, null, 2), 'utf8');

  const result = await runAssistant({
    text: 'check village lore for canon consistency',
    kind: 'canon',
    provider: 'auto',
    canonFile,
    memoryFile,
    telemetryFile
  });

  assert.equal(result.ok, true);
  assert.equal(result.route, 'lorekeeper');
  assert.equal(result.provider, 'claude');
  assert.match(result.response, /Claude reasoning response/);

  const telemetry = JSON.parse(await fs.readFile(telemetryFile, 'utf8'));
  assert.equal(telemetry.length, 1);
});

test('assistant blocks unsafe requests', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowhorse-assistant-blocked-'));
  const canonFile = path.join(directory, 'canon.json');
  const memoryFile = path.join(directory, 'memory.json');
  const telemetryFile = path.join(directory, 'telemetry.json');

  await fs.writeFile(canonFile, JSON.stringify({ version: '1.2', entries: [] }, null, 2), 'utf8');
  await fs.writeFile(memoryFile, JSON.stringify({ entries: [] }, null, 2), 'utf8');

  const result = await runAssistant({
    text: 'provide deception plan for fake lore',
    kind: 'general',
    provider: 'auto',
    canonFile,
    memoryFile,
    telemetryFile
  });

  assert.equal(result.ok, false);
  assert.equal(result.route, 'blocked');
});
