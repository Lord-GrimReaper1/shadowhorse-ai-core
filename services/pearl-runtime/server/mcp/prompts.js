/**
 * MCP Prompt Definitions for Crossroads
 * Prompts are reusable templates for common AI assistant tasks
 */

const prompts = [
  {
    name: 'npc_generator',
    description: 'Generate a detailed NPC character with personality, motivations, and dialogue for Crossroads',
    arguments: [
      {
        name: 'description',
        description: 'Natural language description of the NPC (e.g., "a cynical blacksmith who distrusts newcomers")',
        required: true
      },
      {
        name: 'archetype',
        description: 'NPC archetype (elder, merchant, survivor, soldier, etc.)',
        required: false
      },
      {
        name: 'style',
        description: 'Generation style: pragmatic, dramatic, grounded, cynical',
        required: false
      }
    ]
  },
  {
    name: 'scenario_generator',
    description: 'Generate a game scenario with setup, stakes, and potential outcomes',
    arguments: [
      {
        name: 'description',
        description: 'Natural language description of the scenario (e.g., "food shortage leading to rationing debate")',
        required: true
      },
      {
        name: 'scale',
        description: 'Scenario scale: personal, settlement, regional',
        required: false
      },
      {
        name: 'pressure',
        description: 'Initial pressure level: low, medium, high',
        required: false
      }
    ]
  },
  {
    name: 'ethics_advisor',
    description: 'Get ethical analysis and consequence flagging from Claude for game design decisions',
    arguments: [
      {
        name: 'content',
        description: 'Content to analyze (NPC, scenario, player choice, etc.)',
        required: true
      },
      {
        name: 'focus',
        description: 'Ethical focus: power_dynamics, vulnerable_populations, systemic_harm, unintended_consequences',
        required: false
      }
    ]
  },
  {
    name: 'social_advisor',
    description: 'Get social sentiment analysis from Grok for NPC reactions and rumor dynamics',
    arguments: [
      {
        name: 'situation',
        description: 'Situation to analyze (e.g., "player hoards food while others starve")',
        required: true
      },
      {
        name: 'population',
        description: 'Population context (settlement size, factions, existing tensions)',
        required: false
      }
    ]
  },
  {
    name: 'presentation_advisor',
    description: 'Get environmental and presentation ideas from Gemini for systemic feedback',
    arguments: [
      {
        name: 'system_state',
        description: 'Current game state to present (e.g., "food scarcity increasing, trust in leadership declining")',
        required: true
      },
      {
        name: 'medium',
        description: 'Presentation medium: environmental, dialogue, UI, audio',
        required: false
      }
    ]
  },
  {
    name: 'dialogue_generator',
    description: 'Generate contextual dialogue for NPCs based on current game state and relationships',
    arguments: [
      {
        name: 'npc_name',
        description: 'NPC name',
        required: true
      },
      {
        name: 'context',
        description: 'Dialogue context (player action, situation, relationship state)',
        required: true
      },
      {
        name: 'reputation',
        description: 'Player reputation with this NPC (-5 to +5)',
        required: false
      }
    ]
  }
];

/**
 * Get prompt by name and fill in arguments
 */
function getPrompt(name, args = {}) {
  const prompt = prompts.find(p => p.name === name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${name}`);
  }

  // Build the actual prompt text based on the template
  const messages = buildPromptMessages(name, args);
  
  return {
    description: prompt.description,
    messages
  };
}

/**
 * Build prompt messages for each prompt type
 */
function buildPromptMessages(name, args) {
  switch (name) {
    case 'npc_generator':
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate an NPC character for Crossroads survival simulation.

Description: ${args.description || 'No description provided'}
Archetype: ${args.archetype || 'Not specified'}
Style: ${args.style || 'pragmatic'}

Return ONLY valid JSON with this structure:
{
  "name": "string",
  "archetype": "string",
  "personality_traits": ["string"],
  "initial_resources": { "food": number, "materials": number },
  "dialogue_tree": { "greeting": "string", "conditional_responses": {} },
  "fears": ["string"],
  "goals": ["string"],
  "reputation": 0
}`
          }
        }
      ];

    case 'scenario_generator':
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate a scenario for Crossroads survival simulation.

Description: ${args.description || 'No description provided'}
Scale: ${args.scale || 'settlement'}
Initial Pressure: ${args.pressure || 'medium'}

Return ONLY valid JSON with this structure:
{
  "title": "string",
  "setup": "string",
  "stakes": ["string"],
  "potential_outcomes": [{ "choice": "string", "consequence": "string" }],
  "pressure_modifier": number,
  "affected_npcs": ["string"]
}`
          }
        }
      ];

    case 'ethics_advisor':
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `As Claude (ethics advisor), analyze this content for Crossroads:

Content: ${args.content || 'No content provided'}
Focus: ${args.focus || 'general ethical implications'}

Provide:
1. Ethical concerns (power dynamics, vulnerable populations, systemic harm)
2. Unintended consequences
3. Mitigation suggestions
4. Overall risk level (low/medium/high)`
          }
        }
      ];

    case 'social_advisor':
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `As Grok (social sentiment advisor), analyze this situation for Crossroads:

Situation: ${args.situation || 'No situation provided'}
Population Context: ${args.population || 'General settlement'}

Provide:
1. Immediate NPC reactions
2. Rumor spread potential
3. Trust impact (increase/decrease)
4. Faction tensions
5. Collective mood shift`
          }
        }
      ];

    case 'presentation_advisor':
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `As Gemini (presentation advisor), suggest ways to present this system state in Crossroads:

System State: ${args.system_state || 'No state provided'}
Medium: ${args.medium || 'environmental, dialogue, UI'}

Provide:
1. Environmental cues (visual changes in game world)
2. Dialogue changes (NPC conversation topics)
3. UI indicators (subtle, no meters)
4. Audio atmosphere changes
5. Systemic feedback loops`
          }
        }
      ];

    case 'dialogue_generator':
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate contextual dialogue for an NPC in Crossroads.

NPC: ${args.npc_name || 'Unknown NPC'}
Context: ${args.context || 'General conversation'}
Reputation: ${args.reputation !== undefined ? args.reputation : 0} (-5 to +5 scale)

Return ONLY valid JSON with this structure:
{
  "greeting": "string",
  "main_dialogue": "string",
  "conditional_responses": {
    "positive_reputation": "string",
    "negative_reputation": "string",
    "neutral": "string"
  },
  "farewell": "string"
}`
          }
        }
      ];

    default:
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Unknown prompt type: ${name}`
          }
        }
      ];
  }
}

module.exports = { prompts, getPrompt };
