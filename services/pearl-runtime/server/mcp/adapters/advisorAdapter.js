const { anthropicCompletion } = require('../../anthropicClient');
const { xaiChatCompletion } = require('../../xaiClient');
const { geminiCompletion } = require('../../geminiClient');
const { 
  getClaudeEthicsSystemPrompt, 
  getGrokSocialSystemPrompt, 
  getGeminiPresentationSystemPrompt 
} = require('../../services/rolePrompts');

/**
 * MCP adapter for multi-model advisory
 * Consults Claude (ethics), Grok (social), Gemini (presentation) in parallel
 */

function truncate(value, maxLen) {
  if (!value || typeof value !== 'string') return '';
  return value.length > maxLen ? value.substring(0, maxLen) + '...' : value;
}

async function getAdvisors({ 
  prompt, 
  advisors = ['claude', 'grok', 'gemini'], 
  context = {},
  assetType = 'npc',
  style = 'pragmatic',
  projectId = 'unknown'
}) {
  try {
    if (!prompt) {
      throw new Error('prompt is required');
    }

    const wantClaude = advisors.includes('claude');
    const wantGrok = advisors.includes('grok');
    const wantGemini = advisors.includes('gemini');

    if (!wantClaude && !wantGrok && !wantGemini) {
      throw new Error('At least one advisor must be specified: claude, grok, or gemini');
    }

    const sharedContext =
      `Type: ${assetType}\n` +
      `Style: ${style}\n` +
      `ProjectId: ${projectId}\n` +
      `Prompt: ${prompt}\n` +
      `Context:\n${JSON.stringify(context, null, 2)}`;

    const tasks = [];

    if (wantClaude) {
      tasks.push(
        anthropicCompletion({
          system: getClaudeEthicsSystemPrompt(),
          user: sharedContext,
          maxTokens: 900,
          temperature: 0.2
        })
          .then(text => ({ key: 'claude', ok: true, text }))
          .catch(err => ({ 
            key: 'claude', 
            ok: false, 
            error: String(err && err.message ? err.message : err) 
          }))
      );
    }

    if (wantGrok) {
      tasks.push(
        xaiChatCompletion(
          [
            { role: 'system', content: getGrokSocialSystemPrompt() },
            { role: 'user', content: sharedContext }
          ],
          { max_tokens: 900, temperature: 0.4 }
        )
          .then(text => ({ key: 'grok', ok: true, text }))
          .catch(err => ({ 
            key: 'grok', 
            ok: false, 
            error: String(err && err.message ? err.message : err) 
          }))
      );
    }

    if (wantGemini) {
      tasks.push(
        geminiCompletion({
          system: getGeminiPresentationSystemPrompt(),
          user: sharedContext,
          maxTokens: 900,
          temperature: 0.3
        })
          .then(text => ({ key: 'gemini', ok: true, text }))
          .catch(err => ({ 
            key: 'gemini', 
            ok: false, 
            error: String(err && err.message ? err.message : err) 
          }))
      );
    }

    const results = await Promise.all(tasks);
    
    const advisorOutputs = {};
    for (const r of results) {
      advisorOutputs[r.key] = r.ok
        ? { ok: true, text: truncate(r.text, 4000) }
        : { ok: false, error: truncate(r.error, 4000) };
    }

    return { 
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          advisors: advisorOutputs,
          requested: advisors,
          prompt,
          projectId
        }, null, 2)
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

module.exports = { getAdvisors };
