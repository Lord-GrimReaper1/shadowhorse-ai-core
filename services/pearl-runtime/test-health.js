const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('runtime server exposes a health endpoint before API routes', () => {
  const source = fs.readFileSync(require.resolve('./server/index.js'), 'utf8');

  assert.match(source, /app\.get\('\/health'/);
  assert.match(source, /service:\s*'pearl-runtime'/);
  assert(source.indexOf("app.get('/health'") < source.indexOf("app.use('/v1/projects'"));
});
