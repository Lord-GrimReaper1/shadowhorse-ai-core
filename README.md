# Pearl

Pearl is the personal production identity for the Shadowhorse AI Core runtime and the assistant identity presented to users.

Shadowhorse AI Core remains the studio-wide policy, orchestration, and architecture layer for Shadowhorse Games.

## Scope

- AI partner constitution
- Game design constitution
- Safety and red lines
- Multi-agent orchestration concepts
- Embodiment roadmap

## Source of truth

This repository is intended to be the canonical home for Shadowhorse AI policy and architecture. Crossroads-specific adapters and gameplay hooks should live in the Crossroads repo.

## Implementation Maintenance

Pearl may review and improve her ordinary implementation code when directed by a human. Code changes require the normal approval and audit gates. This authority covers runtime features, integrations, tools, adapters, tests, documentation, and studio workflows, but never permits Pearl to modify her constitution, Prime Directives, red lines, or approval safeguards.

A session without repository write tools should explain that local limitation and still offer analysis or a patch plan. It should not claim that implementation maintenance is categorically forbidden.

## Developer Mode V1

Developer Mode gives Pearl a controlled implementation workflow without exposing unrestricted shell access.

- Pearl creates fingerprinted file-change proposals.
- A human approves the exact proposal fingerprint.
- Approval produces a one-time execution token.
- Existing files are backed up before approved writes.
- Optional expected hashes prevent stale overwrites.
- Tests run through a host-controlled executor.
- Applied changes can be rolled back with human approval.
- Policy, canon, Prime Directive, environment, secret, and credential paths remain protected.

See [docs/policy/DEVELOPER_MODE_V1.md](docs/policy/DEVELOPER_MODE_V1.md) for the host integration contract.

## Quickstart Pearl

Run the one-command Pearl entrypoint:

```powershell
npm run pearl -- "check faction canon integrity for village event"
```

Compatibility alias (still supported):

```powershell
npm run assistant -- "check faction canon integrity for village event"
```

The assistant identifies itself as Pearl in the CLI and response layer.

Optional controls:

```powershell
npm run pearl -- "draft implementation plan for npc trust cache" --kind code --provider copilot
npm run pearl -- "validate settlement lore continuity" --kind canon --provider auto
npm run pearl -- "outline co-op event flow" --kind general --persona lyra
```

`Pearl` is the private production default persona, and the public persona roster stays consumer-facing.

List and inspect available personas:

```powershell
node ./src/cli.js personas list
node ./src/cli.js personas list --all
node ./src/cli.js personas show elara
node ./src/cli.js personas show pearl
```

## Quickstart Workflow

Run the persistence-aware demo workflow:

```powershell
npm run demo:workflow
```

Run it from a clean demo state:

```powershell
npm run demo:workflow:reset
```

Or run commands manually:

```powershell
node ./src/cli.js canon add "{\"type\":\"directive\",\"value\":\"Human leads. AI partners. Both grow.\"}" --file ./data/demo/canon.demo.json
node ./src/cli.js memory add "{\"type\":\"note\",\"value\":\"Crossroads is the proving ground.\"}" --file ./data/demo/memory.demo.json
node ./src/cli.js crossroads route canon "validate village canon response"
node ./src/cli.js report eval ./data/demo/evals.sample.json
```

Detailed steps are in [docs/policy/WORKFLOW_DEMO.md](docs/policy/WORKFLOW_DEMO.md).

## Unity Bridge

Start Pearl's local Unity bridge service:

```powershell
npm run pearl:unity-bridge
```

Bridge endpoints:

- `GET /health`
- `GET /v1/unity/schema`
- `POST /v1/unity/ask`

Example request body:

```json
{
	"text": "Check this scene for lore and system consistency.",
	"kind": "canon",
	"persona": "pearl",
	"provider": "auto",
	"unityContext": {
		"projectName": "Crossroads",
		"sceneName": "Runtime Smoke Test",
		"selectedObjects": ["NPC_Patrol_01", "Campfire_A"],
		"mode": "ask",
		"playMode": false
	}
}
```

Use [adapters/unity/PearlBridgeClient.cs](adapters/unity/PearlBridgeClient.cs) as the starter Unity-side connector.

## Pearl Service Runtime

Pearl's canonical local service runtime lives in
[`services/pearl-runtime`](services/pearl-runtime). It owns voice, transcription,
durable agent jobs, repository grounding, protected implementation proposals,
conversation memory, provider clients, and Unity Package Manager coordination.

Install and start it from the repository root:

```powershell
npm run pearl:runtime:install
Copy-Item services/pearl-runtime/.env.example services/pearl-runtime/.env
npm run pearl:runtime
```

The default port is `4000`, preserving compatibility with the existing Unity
Agent Workspace while Crossroads transitions to a thin project adapter.

## Weekly Metrics

Log a pilot run record:

```powershell
node ./src/cli.js metrics log ./data/metrics/telemetry.entry.sample.json --file ./data/metrics/telemetry.log.json
```

Generate the weekly metrics report:

```powershell
node ./src/cli.js report weekly --file ./data/metrics/telemetry.log.json
```
