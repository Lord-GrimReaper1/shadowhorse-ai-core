#!/usr/bin/env node
/**
 * Auto-detect valid model names for Claude, Grok, and Gemini APIs
 * Updates .env file with working model names
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function detectClaudeModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { found: false, error: 'No ANTHROPIC_API_KEY' };
  }

  const modelsToTry = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229'
  ];

  for (const model of modelsToTry) {
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      if (response) {
        return { found: true, model, error: null };
      }
    } catch (err) {
      const msg = err.message || String(err);
      console.log(`  Claude ${model}: ${msg}`);
      // If it's not a model error, the model might be valid but there's another issue
      if (!msg.includes('model') && !msg.includes('404')) {
        return { found: true, model, error: null };
      }
      continue;
    }
  }
  return { found: false, error: 'No valid Claude model found' };
}

async function detectGrokModel() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { found: false, error: 'No XAI_API_KEY' };
  }

  const modelsToTry = [
    'grok-2-1212',
    'grok-2-latest',
    'grok-beta',
    'grok-2'
  ];

  for (const model of modelsToTry) {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.x.ai/v1'
      });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
      if (response) {
        return { found: true, model, error: null };
      }
    } catch (err) {
      const msg = err.message || String(err);
      console.log(`  Grok ${model}: ${msg}`);
      if (!msg.includes('model') && !msg.includes('404') && !msg.includes('400')) {
        return { found: true, model, error: null };
      }
      continue;
    }
  }
  return { found: false, error: 'No valid Grok model found' };
}

async function detectGeminiModel() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { found: false, error: 'No GOOGLE_API_KEY' };
  }

  const modelsToTry = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  for (const model of modelsToTry) {
    try {
      const client = new GoogleGenerativeAI(apiKey);
      const m = client.getGenerativeModel({ model });
      const result = await m.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }]
      });
      if (result) {
        return { found: true, model, error: null };
      }
    } catch (err) {
      const msg = err.message || String(err);
      console.log(`  Gemini ${model}: ${msg}`);
      if (!msg.includes('model') && !msg.includes('404') && !msg.includes('not found')) {
        return { found: true, model, error: null };
      }
      continue;
    }
  }
  return { found: false, error: 'No valid Gemini model found' };
}

async function main() {
  console.log('🔍 Auto-detecting valid model names...\n');

  const [claude, grok, gemini] = await Promise.all([
    detectClaudeModel(),
    detectGrokModel(),
    detectGeminiModel()
  ]);

  console.log('Claude:', claude.found ? `✅ ${claude.model}` : `❌ ${claude.error}`);
  console.log('Grok:', grok.found ? `✅ ${grok.model}` : `❌ ${grok.error}`);
  console.log('Gemini:', gemini.found ? `✅ ${gemini.model}` : `❌ ${gemini.error}`);

  if (!claude.found && !grok.found && !gemini.found) {
    console.log('\n❌ No valid models found. Check API keys.');
    process.exit(1);
  }

  // Update .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  if (claude.found) {
    envContent = envContent.replace(/ANTHROPIC_MODEL=.*/g, `ANTHROPIC_MODEL=${claude.model}`);
  }
  if (grok.found) {
    envContent = envContent.replace(/XAI_MODEL=.*/g, `XAI_MODEL=${grok.model}`);
  }
  if (gemini.found) {
    envContent = envContent.replace(/GEMINI_MODEL=.*/g, `GEMINI_MODEL=${gemini.model}`);
  }

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Updated .env with working model names');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
