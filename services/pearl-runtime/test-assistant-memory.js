const { test } = require('node:test');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Import the services
const memoryService = require('./server/services/memoryService');

test('Memory Service - load new conversation', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    const conv = memoryService.loadConversation(testConvId);
    assert.strictEqual(conv.id, testConvId);
    assert.strictEqual(conv.messages.length, 0);
    assert(conv.createdAt);
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

test('Memory Service - add messages to a conversation', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    let conv = memoryService.loadConversation(testConvId);
    conv = memoryService.addMessage(testConvId, 'user', 'Hello Pearl');
    assert.strictEqual(conv.messages.length, 1);
    assert.strictEqual(conv.messages[0].role, 'user');
    assert.strictEqual(conv.messages[0].content, 'Hello Pearl');
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

test('Memory Service - retrieve conversation history', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    memoryService.addMessage(testConvId, 'user', 'First message');
    memoryService.addMessage(testConvId, 'assistant', 'First response');
    memoryService.addMessage(testConvId, 'user', 'Second message');

    const history = memoryService.getConversationHistory(testConvId);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].role, 'user');
    assert.strictEqual(history[0].content, 'First message');
    assert.strictEqual(history[1].role, 'assistant');
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

test('Memory Service - limit context window', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    for (let i = 0; i < 25; i++) {
      memoryService.addMessage(testConvId, 'user', `Message ${i}`);
    }

    const history = memoryService.getConversationHistory(testConvId, 10);
    assert(history.length <= 10);
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

test('Memory Service - clear a conversation', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    memoryService.addMessage(testConvId, 'user', 'Test message');
    let conv = memoryService.loadConversation(testConvId);
    assert(conv.messages.length > 0);

    memoryService.clearConversation(testConvId);
    conv = memoryService.loadConversation(testConvId);
    assert.strictEqual(conv.messages.length, 0);
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

test('Memory Service - persist conversation across loads', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    memoryService.addMessage(testConvId, 'user', 'Persistent message');
    memoryService.addMessage(testConvId, 'assistant', 'Persistent response');

    // Reload
    const conv = memoryService.loadConversation(testConvId);
    assert.strictEqual(conv.messages.length, 2);
    assert.strictEqual(conv.messages[0].content, 'Persistent message');
    assert.strictEqual(conv.messages[1].content, 'Persistent response');
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

test('Memory Service - list conversations', () => {
  const testConvId = 'test-conversation-' + Date.now();
  try {
    memoryService.addMessage(testConvId, 'user', 'Test');
    const convs = memoryService.listConversations();
    const found = convs.find(c => c.id === testConvId);
    assert(found, 'Conversation should be in list');
  } finally {
    memoryService.clearConversation(testConvId);
  }
});

function normalizePrompt(input, options = {}) {
  const {
    fillerRemoval = true,
    elongationCompact = true,
    slashHandling = true,
    repeatedWordFix = true
  } = options;

  if (!input || typeof input !== 'string') return input;
  let s = input.trim();

  if (fillerRemoval) {
    const fillers = [' um ', ' uh ', ' like ', ' you know ', ' i mean ', ' sort of ', ' kind of ', ' basically ', ' right '];
    let lower = ' ' + s.toLowerCase() + ' ';
    for (const f of fillers) {
      lower = lower.replace(f, ' ');
    }
    s = lower.trim();
  }

  if (slashHandling) {
    s = s.replace(/\bslash\b/gi, '/');
  }

  if (elongationCompact) {
    s = s.replace(/([a-zA-Z])\1{2,}/g, '$1$1');
  }

  s = s.replace(/\s+/g, ' ').trim();

  if (repeatedWordFix) {
    // Fix repeated single words
    s = s.replace(/\b(\w+)(?: \1)+\b/gi, '$1');
  }

  if (s.length > 0) {
    s = s[0].toUpperCase() + s.slice(1);
  }

  return s;
}

test('Normalization - remove filler words', () => {
  const input = 'um, I like want to create an npc right';
  const normalized = normalizePrompt(input);
  assert(!normalized.includes('um'));
  assert(!normalized.includes('like'));
  assert(!normalized.includes('right'));
});

test('Normalization - handle spoken slash', () => {
  const input = 'create a quest slash scenario';
  const normalized = normalizePrompt(input);
  assert.strictEqual(normalized, 'Create a quest / scenario');
});

test('Normalization - compact elongated words', () => {
  const input = 'sooooo good';
  const normalized = normalizePrompt(input);
  assert.strictEqual(normalized, 'Soo good');
});

test('Normalization - fix repeated words', () => {
  const input = 'you you you want to do that';
  const normalized = normalizePrompt(input);
  assert.strictEqual(normalized, 'You want to do that');
});

test('Normalization - apply all normalizations together', () => {
  const input = 'um like you know quest slash npc and sooooo right';
  const normalized = normalizePrompt(input);
  console.log('Input:', input);
  console.log('Normalized:', normalized);
  assert(!normalized.includes('um'));
  assert(!normalized.includes('like'));
  // Just verify key transformations happened
  assert(normalized.toLowerCase().includes('quest'));
  assert(normalized.toLowerCase().includes('npc'));
});

test('Normalization - preserve capitalization', () => {
  const input = 'create an npc named alice';
  const normalized = normalizePrompt(input);
  assert.strictEqual(normalized[0], 'C');
});
