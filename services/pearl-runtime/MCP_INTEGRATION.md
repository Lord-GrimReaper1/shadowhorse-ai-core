# MCP Integration Architecture

**Date:** 2026-02-14  
**Status:** Implementation Phase  
**Purpose:** Standardize multi-model AI orchestration using Model Context Protocol

---

## Overview

The Crossroads middleware now uses **MCP (Model Context Protocol)** to expose AI capabilities as discoverable, composable tools. This provides:

- **Unified interface** for Unity, Python middleware, and other clients
- **Discoverability** of available AI tools, resources, and prompts
- **Standardized error handling** across all AI providers
- **Future-proof architecture** as new AI models are added

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Unity Editor                       │
│              (MCP Client via HTTP/stdio)             │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              MCP Server (Node.js)                    │
│  ┌─────────────┬──────────────┬──────────────────┐ │
│  │   Tools     │  Resources   │     Prompts      │ │
│  │             │              │                  │ │
│  │ transcribe  │ project://   │ npc_generator    │ │
│  │ generate    │ job://       │ ethics_advisor   │ │
│  │ advise      │ asset://     │ social_advisor   │ │
│  └─────────────┴──────────────┴──────────────────┘ │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┬──────────┐
         ▼           ▼           ▼          ▼
    ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
    │ OpenAI │  │ Claude │  │  Grok  │  │ Gemini │
    │  API   │  │  API   │  │  API   │  │  API   │
    └────────┘  └────────┘  └────────┘  └────────┘
```

---

## MCP Server Components

### 1. Tools (Executable Actions)

Tools are functions clients can invoke with parameters:

#### `crossroads_transcribe_audio`
- **Purpose:** Transcribe audio to text via Whisper
- **Input:** `{ audioPath: string, format?: string }`
- **Output:** `{ transcription: string, filename: string }`
- **Adapter:** `whisperAdapter.js`

#### `crossroads_generate_asset`
- **Purpose:** Generate game asset (NPC, scenario, etc.) with GPT-4
- **Input:** `{ projectId: string, prompt: string, type: string, style?: string }`
- **Output:** `{ jobId: string }` (async operation)
- **Adapter:** `assetGeneratorAdapter.js`

#### `crossroads_get_advisors`
- **Purpose:** Get multi-model advisory feedback (Claude ethics, Grok social, Gemini presentation)
- **Input:** `{ prompt: string, advisors: string[], context: object }`
- **Output:** `{ claude?: {...}, grok?: {...}, gemini?: {...} }`
- **Adapter:** `advisorAdapter.js`

#### `crossroads_poll_job`
- **Purpose:** Check job status
- **Input:** `{ jobId: string }`
- **Output:** `{ status: string, result?: object, error?: string }`

#### `crossroads_list_projects`
- **Purpose:** List all saved projects
- **Input:** `{ limit?: number }`
- **Output:** `{ projects: [...] }`

#### `crossroads_get_project`
- **Purpose:** Get project details
- **Input:** `{ projectId: string }`
- **Output:** `{ project: {...} }`

### 2. Resources (Readable Data)

Resources are URIs clients can read:

- **`project://{projectId}`** - Project JSON data
- **`job://{jobId}`** - Job status and results
- **`asset://{filename}`** - Generated asset file content

### 3. Prompts (Reusable Templates)

Prompts are predefined templates for common tasks:

- **`npc_generator`** - Create NPC with personality, goals, dialogue
- **`scenario_generator`** - Create scenario with setup, stakes, outcomes
- **`ethics_advisor`** - Claude reviews for ethical implications
- **`social_advisor`** - Grok analyzes social sentiment
- **`presentation_advisor`** - Gemini suggests environmental cues

---

## Project Structure

```
pipeline/middleware/nodejs/
├── package.json                  # Add @modelcontextprotocol/sdk
├── mcp-server.js                 # MCP server entry point
├── server/
│   ├── index.js                  # Existing REST API (unchanged)
│   ├── mcp/                      # NEW: MCP server components
│   │   ├── index.js              # MCP server setup
│   │   ├── tools.js              # Tool definitions
│   │   ├── resources.js          # Resource definitions
│   │   ├── prompts.js            # Prompt definitions
│   │   └── adapters/             # Adapters wrapping existing services
│   │       ├── whisperAdapter.js
│   │       ├── assetGeneratorAdapter.js
│   │       └── advisorAdapter.js
│   ├── routes/                   # Existing REST routes (unchanged)
│   └── services/                 # Existing services (reused by MCP)
```

---

## Integration Points

### Existing REST API (Port 4000)
- **Status:** Maintained for backward compatibility
- **Use case:** Direct HTTP calls from Unity (existing tooling)
- **Endpoints:** `/v1/whisper`, `/v1/projects/:id/generate/asset`, etc.

### MCP Server (stdio or Port 4001)
- **Status:** New primary interface for AI orchestration
- **Use case:** Structured tool invocation, resource discovery
- **Transport:** stdio (for local Unity tools) or HTTP/SSE (for remote clients)

### Python Middleware (Future)
- Can act as **MCP client** to Node MCP server
- Or expose its own **MCP server** for async/WebSocket operations
- Shares protocol with Node, enabling cross-language orchestration

---

## Adapter Pattern

Adapters wrap existing services to conform to MCP tool signatures:

```javascript
// adapters/whisperAdapter.js
const { transcribeFile } = require('../services/whisperService');

async function transcribeAudio({ audioPath, format = 'wav' }) {
  try {
    const text = await transcribeFile(audioPath);
    return { 
      transcription: text, 
      filename: path.basename(audioPath),
      success: true 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

module.exports = { transcribeAudio };
```

**Benefits:**
- Existing services untouched (no breaking changes)
- Adapters handle MCP-specific error formatting
- Easy to add new AI providers as MCP tools

---

## Running the MCP Server

### As stdio Server (for local Unity tools)
```bash
cd pipeline/middleware/nodejs
node mcp-server.js
```

### As HTTP Server (for remote clients)
```bash
cd pipeline/middleware/nodejs
MCP_TRANSPORT=http MCP_PORT=4001 node mcp-server.js
```

### Alongside REST API (recommended during migration)
```bash
# Terminal 1: REST API
npm run dev

# Terminal 2: MCP Server
node mcp-server.js
```

---

## Migration Strategy

### Phase 1: Parallel Operation (Current)
- REST API continues on port 4000
- MCP server starts on stdio or port 4001
- Unity tools can use either interface

### Phase 2: MCP-First (Future)
- New Unity tools use MCP client
- Existing tools gradually migrated
- REST API maintained for simple endpoints (health checks, file serving)

### Phase 3: MCP-Only (Long-term)
- REST API deprecated or simplified to file serving only
- All AI orchestration via MCP
- Python middleware also uses MCP protocol

---

## Testing MCP Tools

### Using MCP Inspector (Recommended)
```bash
npx @modelcontextprotocol/inspector node mcp-server.js
```

Opens browser interface to test tools, resources, prompts interactively.

### Using MCP CLI
```bash
# List available tools
npx mcp-client stdio "node mcp-server.js" list-tools

# Call a tool
npx mcp-client stdio "node mcp-server.js" call-tool crossroads_transcribe_audio '{"audioPath": "test.wav"}'
```

### From Unity (C# MCP Client)
```csharp
// Future: Unity MCP client wrapper
var client = new MCPClient("node", "mcp-server.js");
var result = await client.CallTool("crossroads_transcribe_audio", new {
    audioPath = "/path/to/audio.wav"
});
```

---

## Benefits for Crossroads

### Immediate
- **Discoverability:** Unity tools can query available AI capabilities
- **Consistency:** Same error handling across GPT, Claude, Grok, Gemini
- **Testability:** MCP Inspector provides GUI for testing without Unity

### Medium-term
- **Python integration:** Python middleware becomes MCP client (reuses Node tools)
- **Chaining:** Tools can call other tools (e.g., transcribe → generate → advise)
- **Caching:** MCP supports resource caching for repeated queries

### Long-term
- **Multi-agent:** Different AI models coordinate via MCP protocol
- **Distributed:** MCP servers can run on different machines/cloud
- **Extensibility:** New AI providers added without Unity code changes

---

## Next Steps

1. ✅ Architecture design (this document)
2. ⏳ Install MCP SDK: `npm install @modelcontextprotocol/sdk`
3. ⏳ Implement core MCP server (`server/mcp/index.js`)
4. ⏳ Create tool adapters (transcribe, generate, advise)
5. ⏳ Create resources (project, job, asset URIs)
6. ⏳ Create prompts (npc_generator, etc.)
7. ⏳ Test with MCP Inspector
8. ⏳ Document Unity integration guide

---

## References

- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **MCP SDK (Node.js):** https://github.com/modelcontextprotocol/sdk-typescript
- **MCP Inspector:** https://github.com/modelcontextprotocol/inspector
