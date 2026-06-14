import fs from 'node:fs/promises';
import path from 'node:path';
import { CanonStore } from '../canon/index.js';
import { MemoryStore } from '../memory/index.js';
import { Orchestrator } from '../orchestrator/index.js';
import { createProviderRegistry, selectProviderForRoute } from '../providers/index.js';

async function readTelemetry(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function appendTelemetry(filePath, entry) {
  const rows = await readTelemetry(filePath);
  rows.push({
    id: rows.length + 1,
    ...entry
  });

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf8');
}

export async function runAssistant({
  text,
  kind = 'general',
  provider = 'auto',
  canonFile,
  memoryFile,
  telemetryFile
}) {
  const startedAt = Date.now();
  const canonStore = new CanonStore({ filePath: canonFile });
  const memoryStore = new MemoryStore({ filePath: memoryFile });
  await canonStore.load();
  await memoryStore.load();

  const orchestrator = new Orchestrator({ memory: memoryStore });
  const routeResult = orchestrator.route({ kind, text });
  const context = {
    canonCount: canonStore.list().length,
    memoryCount: memoryStore.list().length
  };

  const registry = createProviderRegistry();
  const selectedProvider = selectProviderForRoute({
    route: routeResult.route,
    override: provider === 'auto' ? null : provider,
    registry
  });

  let response = null;
  if (routeResult.route !== 'blocked') {
    response = await selectedProvider.generate({ text, context, route: routeResult.route });
  }

  const turnaroundMs = Date.now() - startedAt;
  const telemetryEntry = {
    createdAt: new Date().toISOString(),
    input: {
      text,
      kind,
      providerRequested: provider
    },
    provider: selectedProvider?.key ?? null,
    route: routeResult.route,
    evaluation: routeResult.evaluation,
    overridden: false,
    escalated: routeResult.evaluation?.requiresHumanApproval ?? false,
    shouldEscalate: routeResult.evaluation?.requiresHumanApproval ?? false,
    turnaroundMs
  };

  if (telemetryFile) {
    await appendTelemetry(telemetryFile, telemetryEntry);
  }

  return {
    ok: routeResult.route !== 'blocked',
    route: routeResult.route,
    provider: selectedProvider?.key ?? null,
    specialist: routeResult.specialist?.name ?? null,
    evaluation: routeResult.evaluation,
    response,
    context,
    turnaroundMs
  };
}
