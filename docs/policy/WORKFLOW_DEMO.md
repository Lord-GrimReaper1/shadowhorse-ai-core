# Persistence-Aware Workflow Demo

This demo proves four core flows in order:

1. Canon persistence
2. Memory persistence
3. Crossroads route command
4. Evaluation report generation

## Run All At Once

```powershell
npm run demo:workflow
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
