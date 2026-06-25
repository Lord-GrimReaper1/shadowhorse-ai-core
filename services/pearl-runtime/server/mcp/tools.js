const { transcribeAudio } = require('./adapters/whisperAdapter');
const { generateAsset } = require('./adapters/assetGeneratorAdapter');
const { getAdvisors } = require('./adapters/advisorAdapter');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../..', 'server', 'data');

/**
 * MCP Tool Definitions for Crossroads
 * These tools are exposed via the MCP protocol
 */

const tools = [
  {
    name: 'crossroads_transcribe_audio',
    description: 'Transcribe audio file to text using OpenAI Whisper. Returns transcribed text and filename.',
    inputSchema: {
      type: 'object',
      properties: {
        audioPath: {
          type: 'string',
          description: 'Absolute path to audio file (wav, mp3, m4a, etc.)'
        },
        format: {
          type: 'string',
          description: 'Audio format (default: wav)',
          enum: ['wav', 'mp3', 'm4a', 'webm', 'ogg']
        }
      },
      required: ['audioPath']
    }
  },
  {
    name: 'crossroads_generate_asset',
    description: 'Generate game asset (NPC, scenario, location, etc.) using GPT-4. Returns jobId for async polling.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project identifier'
        },
        prompt: {
          type: 'string',
          description: 'Natural language description of asset to generate'
        },
        assetType: {
          type: 'string',
          description: 'Type of asset to generate',
          enum: ['npc', 'scenario', 'location', 'dialogue', 'event']
        },
        style: {
          type: 'string',
          description: 'Generation style',
          enum: ['pragmatic', 'dramatic', 'grounded', 'cynical']
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata to include with asset'
        }
      },
      required: ['projectId', 'prompt']
    }
  },
  {
    name: 'crossroads_get_advisors',
    description: 'Get multi-model advisory feedback. Claude (ethics), Grok (social sentiment), Gemini (presentation ideas).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'What to get advisory feedback on'
        },
        advisors: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['claude', 'grok', 'gemini']
          },
          description: 'Which advisors to consult (default: all)'
        },
        context: {
          type: 'object',
          description: 'Additional context for advisors'
        },
        assetType: {
          type: 'string',
          description: 'Asset type being advised on'
        },
        style: {
          type: 'string',
          description: 'Generation style'
        },
        projectId: {
          type: 'string',
          description: 'Project identifier'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'crossroads_poll_job',
    description: 'Check status of async job (from asset generation). Returns status and result if completed.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'Job identifier returned from crossroads_generate_asset'
        }
      },
      required: ['jobId']
    }
  },
  {
    name: 'crossroads_list_projects',
    description: 'List all saved projects.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return (default: 10)'
        }
      }
    }
  },
  {
    name: 'crossroads_get_project',
    description: 'Get details of a specific project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project identifier'
        }
      },
      required: ['projectId']
    }
  }
];

/**
 * Tool handlers - maps tool names to handler functions
 */
const toolHandlers = {
  crossroads_transcribe_audio: transcribeAudio,
  crossroads_generate_asset: generateAsset,
  crossroads_get_advisors: getAdvisors,
  
  crossroads_poll_job: async ({ jobId }) => {
    try {
      const jobFile = path.join(DATA_DIR, `job_${jobId}.json`);
      if (!fs.existsSync(jobFile)) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(job, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  },
  
  crossroads_list_projects: async ({ limit = 10 }) => {
    try {
      const files = fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('project_') && f.endsWith('.json'))
        .slice(0, limit);
      
      const projects = files.map(f => {
        const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
        return {
          id: f.replace('project_', '').replace('.json', ''),
          ...content
        };
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ projects }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  },
  
  crossroads_get_project: async ({ projectId }) => {
    try {
      const projectFile = path.join(DATA_DIR, `project_${projectId}.json`);
      if (!fs.existsSync(projectFile)) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(project, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }
};

module.exports = { tools, toolHandlers };
