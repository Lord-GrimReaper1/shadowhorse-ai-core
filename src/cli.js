#!/usr/bin/env node

import { evaluateRequest } from './policy/index.js';
import { Orchestrator } from './orchestrator/index.js';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.log('Shadowhorse AI Core CLI');
  console.log('Commands: policy <text>, route <kind> <text>');
  process.exit(0);
}

if (command === 'policy') {
  const result = evaluateRequest(args.join(' '));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.allowed ? 0 : 1);
}

if (command === 'route') {
  const [kind, ...textParts] = args;
  const orchestrator = new Orchestrator();
  const result = orchestrator.route({ kind, text: textParts.join(' ') });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.route === 'blocked' ? 1 : 0);
}

console.error(`Unknown command: ${command}`);
process.exit(1);
