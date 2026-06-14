#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanonStore } from './canon/index.js';
import { MemoryStore } from './memory/index.js';
import { evaluateRequest } from './policy/index.js';
import { Orchestrator } from './orchestrator/index.js';
import { generateEvaluationReport } from './report/index.js';
import { listCrossroadsCapabilities, routeCrossroadsTask } from './adapters/crossroads/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultCanonFile = path.resolve(__dirname, '../data/canon/canon.snapshot.json');
const defaultMemoryFile = path.resolve(__dirname, '../data/memory/memory.snapshot.json');

function parseArgs(values) {
  const options = {};
  const positional = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value.startsWith('--')) {
      const key = value.slice(2);
      const next = values[index + 1];

      if (next && !next.startsWith('--')) {
        options[key] = next;
        index += 1;
      } else {
        options[key] = true;
      }

      continue;
    }

    positional.push(value);
  }

  return { options, positional };
}

async function readJsonInput(value) {
  try {
    const text = await fs.readFile(value, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return JSON.parse(value);
    }

    throw error;
  }
}

async function handleCanon(args) {
  const { options, positional } = parseArgs(args);
  const filePath = options.file ?? defaultCanonFile;
  const command = positional[0];
  const store = new CanonStore({ filePath });
  await store.load();

  if (command === 'list' || command === 'load') {
    console.log(JSON.stringify(store.snapshot(), null, 2));
    return 0;
  }

  if (command === 'add') {
    const payload = await readJsonInput(positional.slice(1).join(' '));
    store.add(payload);
    await store.save();
    console.log(JSON.stringify(store.snapshot(), null, 2));
    return 0;
  }

  if (command === 'save') {
    await store.save();
    console.log(JSON.stringify(store.snapshot(), null, 2));
    return 0;
  }

  throw new Error(`Unknown canon command: ${command}`);
}

async function handleMemory(args) {
  const { options, positional } = parseArgs(args);
  const filePath = options.file ?? defaultMemoryFile;
  const command = positional[0];
  const store = new MemoryStore({ filePath });
  await store.load();

  if (command === 'list' || command === 'load') {
    console.log(JSON.stringify(store.snapshot(), null, 2));
    return 0;
  }

  if (command === 'add') {
    const payload = await readJsonInput(positional.slice(1).join(' '));
    store.add(payload);
    await store.save();
    console.log(JSON.stringify(store.snapshot(), null, 2));
    return 0;
  }

  if (command === 'save') {
    await store.save();
    console.log(JSON.stringify(store.snapshot(), null, 2));
    return 0;
  }

  throw new Error(`Unknown memory command: ${command}`);
}

async function handleCrossroads(args) {
  const { positional } = parseArgs(args);
  const command = positional[0];

  if (command === 'capabilities') {
    console.log(JSON.stringify(listCrossroadsCapabilities(), null, 2));
    return 0;
  }

  if (command === 'route') {
    const [kind, ...textParts] = positional.slice(1);
    console.log(JSON.stringify(routeCrossroadsTask(kind, textParts.join(' ')), null, 2));
    return 0;
  }

  throw new Error(`Unknown crossroads command: ${command}`);
}

async function handleReport(args) {
  const { positional } = parseArgs(args);
  const command = positional[0];

  if (command === 'eval') {
    const input = positional.slice(1).join(' ');
    const entries = await readJsonInput(input);
    console.log(JSON.stringify(generateEvaluationReport(entries), null, 2));
    return 0;
  }

  throw new Error(`Unknown report command: ${command}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log('Shadowhorse AI Core CLI');
    console.log('Commands: policy <text>, route <kind> <text>, canon <list|add|load|save>, memory <list|add|load|save>, crossroads <capabilities|route>, report <eval>');
    return 0;
  }

  if (command === 'policy') {
    const result = evaluateRequest(args.join(' '));
    console.log(JSON.stringify(result, null, 2));
    return result.allowed ? 0 : 1;
  }

  if (command === 'route') {
    const [kind, ...textParts] = args;
    const orchestrator = new Orchestrator();
    const result = orchestrator.route({ kind, text: textParts.join(' ') });
    console.log(JSON.stringify(result, null, 2));
    return result.route === 'blocked' ? 1 : 0;
  }

  if (command === 'canon') {
    return handleCanon(args);
  }

  if (command === 'memory') {
    return handleMemory(args);
  }

  if (command === 'crossroads') {
    return handleCrossroads(args);
  }

  if (command === 'report') {
    return handleReport(args);
  }

  throw new Error(`Unknown command: ${command}`);
}

main().then((code) => process.exit(code)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
