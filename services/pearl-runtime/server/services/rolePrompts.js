const fs = require('fs');
const path = require('path');

function getPromptsDir() {
  // server/services -> server -> nodejs -> middleware -> pipeline -> ai_roles/prompts
  return path.join(__dirname, '..', '..', '..', '..', 'ai_roles', 'prompts');
}

function extractSystemPrompt(markdown) {
  const sectionMatch = markdown.match(/^##\s+System Prompt\s*\n([\s\S]*?)(?=^##\s+|\Z)/m);
  const section = sectionMatch ? sectionMatch[1].trim() : '';
  if (!section) return null;

  const fencedMatch = section.match(/```(?:text)?\n([\s\S]*?)```/m);
  if (fencedMatch) return fencedMatch[1].trim();

  return section.trim();
}

function loadRolePrompt(filename) {
  try {
    const filePath = path.join(getPromptsDir(), filename);
    const md = fs.readFileSync(filePath, 'utf8');
    const systemPrompt = extractSystemPrompt(md);
    return systemPrompt || null;
  } catch {
    return null;
  }
}

function getNpcSystemPrompt() {
  return (
    loadRolePrompt('npc_generator.md') ||
    "You are a game designer generating NPCs for the Crossroads systemic survival simulation. Return ONLY valid JSON and no extra text. The JSON MUST match this schema: { name: string, archetype: string, personality_traits: string[], initial_resources: { food: number, materials: number }, dialogue_tree: { greeting: string, conditional_responses: object }, fears: string[], goals: string[] }. Keep it concise and usable in-game. NPCs operate on partial, local knowledge; avoid omniscience."
  );
}

function getScenarioSystemPrompt() {
  return (
    loadRolePrompt('scenario_generator.md') ||
    "You are a game designer generating scenarios for the Crossroads systemic survival simulation. Return ONLY valid JSON and no extra text. The JSON MUST match this schema: { scenario_name: string, description: string, initial_tension: number, actors: string[], time_period: string, setting: string, key_resources: string[], initial_conditions: object, branching_outcomes: [{ trigger: string, description: string, consequences: object }], npc_roles: [{ role: string, relationship_to_player: string, personality: string }] }. Keep details local and playtestable; avoid omniscience."
  );
}

function getFactionSystemPrompt() {
  return (
    loadRolePrompt('faction_generator.md') ||
    "You are a game designer generating factions for the Crossroads systemic survival simulation. Return ONLY valid JSON and no extra text. The JSON MUST match this schema: { faction_name: string, description: string, values: string[], goals: string[], resources: object, stance: { authority: string, outsiders: string, scarcity: string }, notable_members: [{ name: string, role: string, public_face: string }], rumors: string[], pressure_points: string[] }. Keep details local; rumors are uncertain."
  );
}

function getRegionSystemPrompt() {
  return (
    loadRolePrompt('region_generator.md') ||
    "You are a game designer generating regions for the Crossroads systemic survival simulation. Return ONLY valid JSON and no extra text. The JSON MUST match this schema: { region_name: string, description: string, biome: string, time_period: string, settlements: [{ name: string, type: string, population: number, known_for: string }], resources: string[], threats: string[], routes: [{ name: string, risk: string, notes: string }], rumors: string[] }. Keep details local; rumors are uncertain."
  );
}

function getDialogueSystemPrompt() {
  return (
    loadRolePrompt('dialogue_generator.md') ||
    "You are a game designer generating dialogue for the Crossroads systemic survival simulation. Return ONLY valid JSON and no extra text. The JSON MUST match this schema: { greeting: string, confrontation: string, conditional_responses: object, speaker: string, listener: string, context: string, tone: string }. Optional fields: speaker, listener, context, tone. Keep it concise and grounded in local knowledge."
  );
}

function getClaudeEthicsSystemPrompt() {
  return (
    loadRolePrompt('claude_ethics_auditor.md') ||
    'You are Claude acting as an Ethics & Consequence Auditor for the Crossroads systemic survival simulation. Your job is to flag ethical risks, believability failures, and second-order consequences. Be concise. Output plain text with clear headings: Ethical concern, Severity (low/medium/high), Tradeoffs, Suggested mitigation. Do not invent canon; treat unknowns as assumptions.'
  );
}

function getGrokSocialSystemPrompt() {
  return (
    loadRolePrompt('grok_social_pulse.md') ||
    'You are Grok acting as a World Pulse & Social Dynamics signal generator for the Crossroads systemic survival simulation. Your job is to forecast social volatility, rumor dynamics, and faction sentiment shifts. Distinguish Signal vs Noise and include confidence. Be concise. Output plain text.'
  );
}

function getGeminiPresentationSystemPrompt() {
  return (
    loadRolePrompt('gemini_presentation.md') ||
    'You are Gemini acting as a Presentation & Clarity Editor for the Crossroads systemic survival simulation. Your job is to suggest improvements to clarity, structure, and player-facing readability while preserving meaning and canon constraints. Be concise. Output plain text with headings: Clarity issues, Suggested rewrite (optional), Notes.'
  );
}

function getSystemPromptForAssetType(assetType) {
  const t = String(assetType || '').trim().toLowerCase();
  if (t === 'npc') return getNpcSystemPrompt();
  if (t === 'scenario') return getScenarioSystemPrompt();
  if (t === 'faction') return getFactionSystemPrompt();
  if (t === 'region') return getRegionSystemPrompt();
  if (t === 'dialogue') return getDialogueSystemPrompt();
  return "You are a concise generator assistant. Return only valid JSON and no extra text.";
}

module.exports = {
  getNpcSystemPrompt,
  getScenarioSystemPrompt,
  getFactionSystemPrompt,
  getRegionSystemPrompt,
  getDialogueSystemPrompt,
  getClaudeEthicsSystemPrompt,
  getGrokSocialSystemPrompt,
  getGeminiPresentationSystemPrompt,
  getSystemPromptForAssetType,
};
