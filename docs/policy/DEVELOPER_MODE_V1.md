# Pearl Developer Mode V1

Developer Mode gives Pearl a controlled way to help build studio software without granting unrestricted machine access.

## Workflow

1. Pearl inspects the project and creates a structured change proposal.
2. The proposal receives an immutable SHA-256 fingerprint.
3. A human reviews the paths, rationale, and expected file hashes.
4. Human approval confirms the exact fingerprint and issues a one-time execution token.
5. The host applies only the approved write operations.
6. Existing files are backed up before replacement.
7. Tests run through a host-controlled executor.
8. An applied proposal can be rolled back with human approval.

## Security Boundary

Developer Mode V1 supports `write_file` operations only. It does not expose a general shell.

The following targets are protected even when a proposal is approved:

- `src/policy/**`
- Shadowhorse canon and enforcement-matrix documents
- Pearl Prime Directive documents
- environment, secret, and credential files

File operations must remain inside the configured workspace root. Optional expected SHA-256 hashes prevent stale proposals from overwriting newer work.

## Integration Rule

Model-facing tools may create and inspect proposals. They must not expose `approveChange`. Human-facing application code owns approval and receives the one-time execution token.

Environment adapters, such as Unity Package Manager, should use this same pattern: inspect, propose, approve, apply, verify, and roll back.
