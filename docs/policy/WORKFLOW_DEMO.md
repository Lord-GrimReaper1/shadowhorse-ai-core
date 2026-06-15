# Persistence-Aware Workflow Demo

This demo proves four core flows in order:

1. Canon persistence
2. Memory persistence
3. Crossroads route command
4. Evaluation report generation

## Assistant Trigger

Use the assistant front door command for pilot runs:

```powershell
npm run assistant -- "check faction canon integrity for village event"
```

Switch persona style while keeping the same policy and routing engine:

```powershell
npm run assistant -- "draft co-op narrative hooks" --persona seren
node ./src/cli.js personas list
```

## Run All At Once

```powershell
npm run demo:workflow
```

Run from a clean demo state:

```powershell
npm run demo:workflow:reset
```

## Run Manually

```powershell
node ./src/cli.js canon add "{\"type\":\"directive\",\"value\":\"Human leads. AI partners. Both grow.\"}" --file ./data/demo/canon.demo.json
node ./src/cli.js memory add "{\"type\":\"note\",\"value\":\"Crossroads is the proving ground.\"}" --file ./data/demo/memory.demo.json
node ./src/cli.js crossroads route canon "validate village canon response"
node ./src/cli.js report eval ./data/demo/evals.sample.json
```

## Expected Outcomes

- Canon file grows with one or more entries.
- Memory file grows with one or more entries.
- Crossroads route returns `validate-canon` for `canon` tasks.
- Report returns counts for `total`, `allowed`, `blocked`, and `approvals`.

## Weekly Pilot Metrics

Record a telemetry entry:

```powershell
node ./src/cli.js metrics log ./data/metrics/telemetry.entry.sample.json --file ./data/metrics/telemetry.log.json
```

Generate the weekly report:

```powershell
node ./src/cli.js report weekly --file ./data/metrics/telemetry.log.json
```

Tracked fields:

- `safetyPassRate`
- `canonConsistencyRate`
- `humanOverrideRate`
- `medianTurnaroundMs`
- `approvalFrictionRate`
