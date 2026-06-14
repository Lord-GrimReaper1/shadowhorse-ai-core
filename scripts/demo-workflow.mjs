import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const cliPath = path.join(root, 'src', 'cli.js');

const canonFile = path.join(root, 'data', 'demo', 'canon.demo.json');
const memoryFile = path.join(root, 'data', 'demo', 'memory.demo.json');
const evalsFile = path.join(root, 'data', 'demo', 'evals.sample.json');

function runCli(args) {
  const output = execFileSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8'
  });

  return output.trim();
}

async function main() {
  await fs.mkdir(path.dirname(canonFile), { recursive: true });

  console.log('1) Canon persistence');
  const canonResult = runCli([
    'canon',
    'add',
    JSON.stringify({ type: 'directive', value: 'Human leads. AI partners. Both grow.' }),
    '--file',
    canonFile
  ]);
  console.log(canonResult);

  console.log('2) Memory persistence');
  const memoryResult = runCli([
    'memory',
    'add',
    JSON.stringify({ type: 'note', value: 'Crossroads is the proving ground.' }),
    '--file',
    memoryFile
  ]);
  console.log(memoryResult);

  console.log('3) Crossroads route command');
  const routeResult = runCli(['crossroads', 'route', 'canon', 'validate', 'village', 'canon']);
  console.log(routeResult);

  console.log('4) Evaluation report');
  const reportResult = runCli(['report', 'eval', evalsFile]);
  console.log(reportResult);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
