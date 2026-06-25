const fs = require('fs');
const path = require('path');

/**
 * memoryService - Manages conversation history and context persistence
 * Stores conversations as JSON files keyed by conversation_id
 */

const MEMORY_DIR = path.join(__dirname, '..', 'data', 'conversations');
const MAX_CONTEXT_MESSAGES = 20; // Max messages to retain in memory
const DEFAULT_RETENTION_DAYS = Number(process.env.MEMORY_RETENTION_DAYS || 30);

function sanitizeConversationId(conversationId) {
  return String(conversationId).replace(/[^a-zA-Z0-9-_]/g, '_');
}

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function getConversationPath(conversationId) {
  const safeId = sanitizeConversationId(conversationId);
  return path.join(MEMORY_DIR, `${safeId}.json`);
}

function redactSensitiveContent(content) {
  if (typeof content !== 'string') return content;

  let redacted = content;
  // Email addresses
  redacted = redacted.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
  // Likely API keys/tokens (long alphanumeric strings)
  redacted = redacted.replace(/\b(?:sk|api|token)[-_]?[A-Za-z0-9]{12,}\b/gi, '[REDACTED_TOKEN]');
  // Phone-like sequences
  redacted = redacted.replace(/\b\+?\d[\d\s\-()]{8,}\d\b/g, '[REDACTED_PHONE]');

  return redacted;
}

function pruneExpiredConversations(retentionDays = DEFAULT_RETENTION_DAYS) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return;
  }

  ensureMemoryDir();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn(`[memoryService] Failed retention check for ${file}:`, err.message);
    }
  }
}

/**
 * Load or create a conversation
 */
function loadConversation(conversationId) {
  ensureMemoryDir();
  const filePath = getConversationPath(conversationId);

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    } catch (err) {
      console.warn(`[memoryService] Failed to load conversation ${conversationId}:`, err.message);
      return createNewConversation(conversationId);
    }
  }

  return createNewConversation(conversationId);
}

/**
 * Create a new conversation object
 */
function createNewConversation(conversationId) {
  return {
    id: conversationId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
}

/**
 * Save a conversation to disk
 */
function saveConversation(conversation) {
  ensureMemoryDir();
  const filePath = getConversationPath(conversation.id);
  conversation.updatedAt = new Date().toISOString();

  // Trim messages to max context to avoid unbounded growth
  if (conversation.messages.length > MAX_CONTEXT_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_CONTEXT_MESSAGES);
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf8');
  } catch (err) {
    console.error(`[memoryService] Failed to save conversation ${conversation.id}:`, err.message);
    throw err;
  }
}

/**
 * Add a message to a conversation
 */
function addMessage(conversationId, role, content) {
  pruneExpiredConversations();
  const conversation = loadConversation(conversationId);
  conversation.messages.push({
    role,
    content: redactSensitiveContent(content),
    timestamp: new Date().toISOString()
  });
  saveConversation(conversation);
  return conversation;
}

/**
 * Get conversation history (returns messages as array for LLM context)
 */
function getConversationHistory(conversationId, maxMessages = MAX_CONTEXT_MESSAGES) {
  const conversation = loadConversation(conversationId);
  const recentMessages = conversation.messages.slice(-maxMessages);
  return recentMessages.map(m => ({ role: m.role, content: m.content }));
}

/**
 * Clear a conversation (reset memory)
 */
function clearConversation(conversationId) {
  ensureMemoryDir();
  const filePath = getConversationPath(conversationId);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[memoryService] Failed to clear conversation ${conversationId}:`, err.message);
  }
}

/**
 * List all conversations (for diagnostics)
 */
function listConversations() {
  ensureMemoryDir();
  try {
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => ({
      id: f.replace('.json', ''),
      path: path.join(MEMORY_DIR, f)
    }));
  } catch (err) {
    console.warn('[memoryService] Failed to list conversations:', err.message);
    return [];
  }
}

module.exports = {
  loadConversation,
  saveConversation,
  addMessage,
  getConversationHistory,
  clearConversation,
  listConversations,
  ensureMemoryDir,
  redactSensitiveContent,
  pruneExpiredConversations
};
