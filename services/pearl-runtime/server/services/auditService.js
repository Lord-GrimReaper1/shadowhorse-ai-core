const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '..', 'data', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'assistant-audit.jsonl');

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

function writeAuditEvent(event) {
  ensureAuditDir();
  const payload = {
    timestamp: new Date().toISOString(),
    ...event
  };

  fs.appendFileSync(AUDIT_FILE, JSON.stringify(payload) + '\n', 'utf8');
}

module.exports = {
  writeAuditEvent
};
