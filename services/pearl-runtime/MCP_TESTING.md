# MCP Server Test Guide

This guide shows how to manually test the Crossroads MCP server.

---

## Method 1: MCP Inspector (Recommended)

The easiest way to test:

```bash
cd pipeline/middleware/nodejs
npm run mcp:inspect
```

This opens a browser with a GUI where you can:
1. Click **Tools** tab → see all 6 tools
2. Click **Resources** tab → see available projects/jobs/assets
3. Click **Prompts** tab → see all 6 prompt templates

### Testing a Tool

1. Go to **Tools** tab
2. Select `crossroads_list_projects`
3. Click **Execute**
4. View JSON response

---

## Method 2: Command Line (Advanced)

### Prerequisites

Install MCP CLI (optional):
```bash
npm install -g @modelcontextprotocol/cli
```

### List Available Tools

```bash
cd pipeline/middleware/nodejs
echo '{"method":"tools/list","id":1}' | node mcp-server.js
```

Expected output: JSON-RPC response with all tools.

### Call a Tool

```bash
# List projects
echo '{"method":"tools/call","params":{"name":"crossroads_list_projects","arguments":{"limit":5}},"id":2}' | node mcp-server.js
```

### Read a Resource

```bash
# Read a job (replace with actual jobId)
echo '{"method":"resources/read","params":{"uri":"job://abc-123"},"id":3}' | node mcp-server.js
```

---

## Method 3: Automated Test Script

Create a test script `test-mcp.js`:

```javascript
const { spawn } = require('child_process');

const server = spawn('node', ['mcp-server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'inherit']
});

// Test: List tools
const listToolsRequest = {
  jsonrpc: '2.0',
  method: 'tools/list',
  id: 1
};

server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
  server.kill();
});

setTimeout(() => {
  console.error('Test timeout');
  server.kill();
}, 5000);
```

Run:
```bash
node test-mcp.js
```

---

## Common Test Scenarios

### Scenario 1: Generate NPC Asset

**Tool:** `crossroads_generate_asset`

**Input:**
```json
{
  "projectId": "test-project",
  "prompt": "Create a cynical blacksmith who lost family in the collapse",
  "assetType": "npc",
  "style": "grounded"
}
```

**Expected:** JobId returned. Use `crossroads_poll_job` to check status.

### Scenario 2: Get Multi-Model Advisory

**Tool:** `crossroads_get_advisors`

**Input:**
```json
{
  "prompt": "Player hoards food while NPCs starve",
  "advisors": ["claude", "grok"],
  "assetType": "scenario",
  "projectId": "ethics-test"
}
```

**Expected:** JSON with Claude ethics analysis and Grok social sentiment.

### Scenario 3: List Available Prompts

**Method:** `prompts/list`

**Expected:** All 6 prompts with descriptions and argument schemas.

### Scenario 4: Use NPC Generator Prompt

**Method:** `prompts/get`

**Input:**
```json
{
  "name": "npc_generator",
  "arguments": {
    "description": "a wise elder who remembers the old world",
    "archetype": "elder",
    "style": "pragmatic"
  }
}
```

**Expected:** Pre-filled prompt messages ready to send to GPT.

---

## Verification Checklist

- [ ] MCP server starts without errors (`npm run mcp`)
- [ ] MCP Inspector opens and shows 6 tools
- [ ] `crossroads_list_projects` returns empty array or existing projects
- [ ] `crossroads_generate_asset` creates a job (check `server/data/job_*.json`)
- [ ] `crossroads_poll_job` returns job status
- [ ] `crossroads_get_advisors` calls Claude/Grok/Gemini (if API keys set)
- [ ] Resources list shows existing projects/jobs/assets
- [ ] Prompts list shows all 6 templates
- [ ] `npc_generator` prompt returns formatted messages

---

## Troubleshooting

### "Cannot find module '@modelcontextprotocol/sdk'"

Run: `npm install`

### "OPENAI_API_KEY is missing"

Check `.env` file exists in `pipeline/middleware/nodejs/` with:
```
OPENAI_API_KEY=sk-...
```

### Tool execution fails

Check `server/data/` directory exists and is writable:
```bash
mkdir -p server/data
```

### MCP Inspector shows blank page

Try:
1. Close browser and restart
2. Use different browser (Chrome/Edge recommended)
3. Check console for JavaScript errors

---

## Next Steps

Once basic tests pass:

1. Test with actual audio file (`crossroads_transcribe_audio`)
2. Poll a completed job and verify asset JSON
3. Test resource URIs (`project://`, `job://`, `asset://`)
4. Integrate with Unity C# MCP client
5. Add more tools as needed (location_generator, dialogue_generator, etc.)
