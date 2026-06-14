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

