# Pearl Runtime

This directory is the canonical local service runtime for Pearl.

It hosts the API currently used by the Unity Agent Workspace:

- conversational assistant and repository grounding
- durable implementation jobs and checkpoints
- protected code-change proposals and approval gates
- Unity Package Manager coordination
- speech-to-text and voice synthesis
- conversation memory
- provider clients
- MCP tools and resources

## Setup

From the repository root:

```powershell
npm run pearl:runtime:install
Copy-Item services/pearl-runtime/.env.example services/pearl-runtime/.env
npm run pearl:runtime
```

Put real credentials only in `services/pearl-runtime/.env`. The file is ignored by Git.

The service listens on port `4000` by default so existing Crossroads Unity adapters continue to work during migration.

## Ownership

Pearl-wide capabilities belong here. Game-specific prompts, schemas, assets, and Unity behavior remain in their project repositories and are reached through adapters or configured repository roots.

The CommonJS package boundary is intentional during the first migration stage. It preserves the proven runtime while the surrounding Shadowhorse AI Core remains ES modules. Individual services can be converted incrementally after parity tests are in place.
