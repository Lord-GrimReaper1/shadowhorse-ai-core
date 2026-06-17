import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runAssistant } from '../../assistant/index.js';
import { UNITY_BRIDGE_SCHEMA, validateUnityBridgeRequest, buildUnityPrompt } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../..');

const defaultCanonFile = path.resolve(root, 'data/canon/canon.snapshot.json');
const defaultMemoryFile = path.resolve(root, 'data/memory/memory.snapshot.json');
const defaultTelemetryFile = path.resolve(root, 'data/metrics/telemetry.log.json');

const host = process.env.PEARL_UNITY_HOST ?? '127.0.0.1';
const port = Number(process.env.PEARL_UNITY_PORT ?? '47831');

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(body, null, 2));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';

    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Request body too large.'));
      }
    });

    request.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    request.on('error', reject);
  });
}

async function handleUnityAsk(request, response) {
  const payload = await parseBody(request);
  const validation = validateUnityBridgeRequest(payload);

  if (!validation.ok) {
    sendJson(response, 400, {
      ok: false,
      errors: validation.errors
    });
    return;
  }

  const prompt = buildUnityPrompt(payload);
  const result = await runAssistant({
    text: prompt,
    kind: payload.kind ?? 'general',
    provider: payload.provider ?? 'auto',
    persona: payload.persona ?? 'pearl',
    canonFile: payload.canonFile ?? defaultCanonFile,
    memoryFile: payload.memoryFile ?? defaultMemoryFile,
    telemetryFile: payload.metricsFile ?? defaultTelemetryFile
  });

  sendJson(response, result.ok ? 200 : 422, {
    ok: result.ok,
    requestId: randomUUID(),
    bridge: {
      version: UNITY_BRIDGE_SCHEMA.version,
      endpoint: UNITY_BRIDGE_SCHEMA.endpoint
    },
    result
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'pearl-unity-bridge',
        status: 'healthy'
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/v1/unity/schema') {
      sendJson(response, 200, UNITY_BRIDGE_SCHEMA);
      return;
    }

    if (request.method === 'POST' && request.url === '/v1/unity/ask') {
      await handleUnityAsk(request, response);
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: 'Not found.'
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message
    });
  }
});

server.listen(port, host, () => {
  console.log(`Pearl Unity bridge listening on http://${host}:${port}`);
  console.log('Endpoints: GET /health, GET /v1/unity/schema, POST /v1/unity/ask');
});
