#!/usr/bin/env node
require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('No ANTHROPIC_API_KEY found in .env');
  process.exit(1);
}

const models = [
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

(async () => {
  for (const model of models) {
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      if (response) {
        console.log('✅', model);
        process.exit(0);
      }
    } catch (e) {
      console.log('❌', model, e.message);
    }
  }
  process.exit(1);
})();
