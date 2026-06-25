# Pearl Runtime Ownership

## Canonical ownership

Shadowhorse AI Core owns capabilities that follow Pearl between projects:

- identity, policy, personas, and approval safeguards
- provider selection and model clients
- speech-to-text, text-to-speech, and voice packages
- durable agent execution, checkpoints, retries, and audit records
- repository grounding and protected implementation proposals
- conversation memory
- studio tool registration and package-manager coordination
- the local service API and MCP surface

## Project ownership

Project repositories such as Crossroads own:

- Unity editor windows and project-side API clients
- game assets, scenes, packages, and gameplay code
- project-specific schemas, prompts, and generation recipes
- project-specific documentation and repository configuration

## Compatibility stage

The initial migration preserves the existing port `4000` API so Crossroads can
continue using the Agent Workspace without a simultaneous Unity rewrite.

The imported runtime remains a nested CommonJS package while the core uses ES
modules. This is a deliberate compatibility boundary, not the final internal
architecture.

## Follow-up extraction

After the core runtime is installed and verified locally:

1. Point Unity startup documentation at `npm run pearl:runtime`.
2. Replace Crossroads-owned runtime files with a compatibility notice or proxy.
3. Move Crossroads-only MCP prompts and schemas into the Crossroads adapter.
4. Convert runtime modules to the core's ES-module APIs in tested slices.
