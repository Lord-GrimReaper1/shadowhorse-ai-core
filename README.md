# Shadowhorse AI Core

Shadowhorse AI Core is the studio-wide policy, orchestration, and architecture layer for Shadowhorse Games.

## Scope

- AI partner constitution
- Game design constitution
- Safety and red lines
- Multi-agent orchestration concepts
- Embodiment roadmap

## Source of truth

This repository is intended to be the canonical home for Shadowhorse AI policy and architecture. Crossroads-specific adapters and gameplay hooks should live in the Crossroads repo.

## Quickstart Assistant

Run the one-command assistant entrypoint:

```powershell
npm run assistant -- "check faction canon integrity for village event"
```

Optional controls:

```powershell
npm run assistant -- "draft implementation plan for npc trust cache" --kind code --provider copilot
npm run assistant -- "validate settlement lore continuity" --kind canon --provider auto
npm run assistant -- "outline co-op event flow" --kind general --persona lyra
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

## Weekly Metrics

Log a pilot run record:

```powershell
node ./src/cli.js metrics log ./data/metrics/telemetry.entry.sample.json --file ./data/metrics/telemetry.log.json
```

Generate the weekly metrics report:

```powershell
node ./src/cli.js report weekly --file ./data/metrics/telemetry.log.json
```

