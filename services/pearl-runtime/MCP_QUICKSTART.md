# Crossroads MCP Server - Quick Start

## What is MCP?

**Model Context Protocol (MCP)** standardizes how AI applications communicate with AI services. The Crossroads MCP server exposes AI orchestration capabilities (Whisper transcription, GPT asset generation, multi-model advisory) as discoverable tools, resources, and prompts.

---

## Running the MCP Server

### Start the Server (stdio mode)

```bash
cd pipeline/middleware/nodejs
npm run mcp
```

The server runs on stdio (standard input/output) by default, which is the preferred transport for local tools.

### Test with MCP Inspector (GUI)

The MCP Inspector provides a web interface to test tools, resources, and prompts interactively:

```bash
cd pipeline/middleware/nodejs
npm run mcp:inspect
```

This opens a browser with:
- **Tools tab** - Call tools with test inputs
- **Resources tab** - Browse available projects, jobs, assets
- **Prompts tab** - Test prompt templates

---

## Available Tools

### `crossroads_transcribe_audio`
Transcribe audio to text using OpenAI Whisper.

**Input:**
```json
{
  "audioPath": "/absolute/path/to/audio.wav",
  "format": "wav"
}
```

**Output:**
```json
{
  "transcription": "text content",
  "filename": "audio.wav",
  "success": true
}
```

### `crossroads_generate_asset`
Generate game asset (NPC, scenario, etc.) using GPT-4. Returns jobId for async polling.

**Input:**
```json
{
  "projectId": "my-project",
  "prompt": "Create a cynical blacksmith NPC",
  "assetType": "npc",
  "style": "pragmatic"
}
```

**Output:**
```json
{
  "success": true,
  "jobId": "uuid-here",
  "status": "Job created",
  "pollUrl": "job://uuid-here"
}
```

### `crossroads_get_advisors`
Get multi-model advisory feedback (Claude ethics, Grok social, Gemini presentation).

**Input:**
```json
{
  "prompt": "Player hoards food while settlement starves",
  "advisors": ["claude", "grok", "gemini"],
  "context": {},
  "assetType": "scenario"
}
```

**Output:**
```json
{
  "success": true,
  "advisors": {
    "claude": { "ok": true, "text": "Ethics analysis..." },
    "grok": { "ok": true, "text": "Social sentiment..." },
    "gemini": { "ok": true, "text": "Presentation ideas..." }
  }
}
```

### `crossroads_poll_job`
Check status of async job.

**Input:**
```json
{
  "jobId": "uuid-here"
}
```

**Output:** Full job object with status and result.

### `crossroads_list_projects`
List all saved projects.

**Input:**
```json
{
  "limit": 10
}
```

### `crossroads_get_project`
Get specific project details.

**Input:**
```json
{
  "projectId": "my-project"
}
```

---

## Available Resources

Resources are URI-addressable data:

- **`project://{projectId}`** - Project JSON data
- **`job://{jobId}`** - Job status and results
- **`asset://{filename}`** - Generated asset file

**Example:** To read a job, use URI `job://abc-123` in the MCP Inspector or via MCP client.

---

## Available Prompts

Prompts are reusable templates:

- **`npc_generator`** - Create NPC with personality, dialogue
- **`scenario_generator`** - Create scenario with stakes, outcomes
- **`ethics_advisor`** - Get ethical analysis from Claude
- **`social_advisor`** - Get social sentiment from Grok
- **`presentation_advisor`** - Get presentation ideas from Gemini
- **`dialogue_generator`** - Generate contextual NPC dialogue

**Example:** Use `npc_generator` prompt with arguments:
```json
{
  "description": "a wise elder who remembers the old world",
  "archetype": "elder",
  "style": "grounded"
}
```

---

## Integration with Unity

### Option 1: stdio Client (Recommended for Editor Tools)

Unity editor tools can spawn the MCP server as a process and communicate via stdin/stdout:

```csharp
// Future Unity MCP client wrapper
var process = new Process {
    FileName = "node",
    Arguments = "mcp-server.js",
    WorkingDirectory = "/path/to/nodejs",
    RedirectStandardInput = true,
    RedirectStandardOutput = true
};
process.Start();

// Send MCP request via stdin
// Read MCP response from stdout
```

### Option 2: Continue Using REST API

The existing REST API (`/v1/whisper`, `/v1/projects/:id/generate/asset`) remains functional. MCP is an **addition**, not a replacement.

---

## Integration with Python Middleware

The Python middleware (when built) can:

1. **Act as MCP client** to the Node MCP server (reuses tools)
2. **Expose its own MCP server** for async/WebSocket operations
3. **Share the protocol** for cross-language orchestration

---

## Troubleshooting

### MCP server won't start

**Check:**
- `.env` file exists with `OPENAI_API_KEY`
- `node_modules` installed (`npm install`)
- Node.js version >= 18

### Tool execution fails

**Check:**
- API keys are valid (OpenAI, Anthropic, xAI, Google Gemini)
- File paths are absolute (for `crossroads_transcribe_audio`)
- Project/job IDs exist in `server/data/`

### Inspector shows no tools

**Check:**
- MCP server started correctly (see "Crossroads MCP server running" message)
- Inspector connected to correct process

---

## Next Steps

1. ✅ MCP server running
2. ⏳ Test tools with MCP Inspector
3. ⏳ Integrate with Unity editor (C# MCP client)
4. ⏳ Build Python middleware as MCP client
5. ⏳ Add more tools (location_generator, event_generator, etc.)

---

## References

- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **MCP SDK (Node.js):** https://github.com/modelcontextprotocol/sdk-typescript
- **MCP Inspector:** https://github.com/modelcontextprotocol/inspector
- **Crossroads MCP Architecture:** [MCP_INTEGRATION.md](MCP_INTEGRATION.md)
