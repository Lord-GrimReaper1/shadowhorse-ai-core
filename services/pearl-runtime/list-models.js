#!/usr/bin/env node
/**
 * List available models from Claude, Grok, and Gemini APIs
 */

require('dotenv').config();
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listClaudeModels() {
  // Anthropic doesn't have a list models endpoint, but these are the known active models
  console.log('\n📋 Claude Models (known as of Feb 2026):');
  console.log('  - claude-3-5-sonnet-20241022');
  console.log('  - claude-3-opus-20240229');
  console.log('  - claude-3-sonnet-20240229');
  console.log('  - claude-3-haiku-20240307');
}

async function listGrokModels() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.log('\n❌ No XAI_API_KEY');
    return;
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1'
    });
    const models = await client.models.list();
    console.log('\n📋 Grok Models:');
    for (const model of models.data) {
      console.log(`  - ${model.id}`);
    }
  } catch (err) {
    console.log('\n❌ Grok models list failed:', err.message);
  }
}

async function listGeminiModels() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('\n❌ No GOOGLE_API_KEY');
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    
    console.log('\n📋 Gemini Models:');
    if (data.models) {
      for (const model of data.models) {
        if (model.supportedGenerationMethods?.includes('generateContent')) {
          const modelId = model.name.replace('models/', '');
          console.log(`  - ${modelId}`);
        }
      }
    } else {
      console.log('  Error:', data.error || 'No models found');
    }
  } catch (err) {
    console.log('\n❌ Gemini models list failed:', err.message);
  }
}

async function main() {
  console.log('🔍 Listing available models from all APIs...');
  await Promise.all([
    listClaudeModels(),
    listGrokModels(),
    listGeminiModels()
  ]);
  console.log('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
