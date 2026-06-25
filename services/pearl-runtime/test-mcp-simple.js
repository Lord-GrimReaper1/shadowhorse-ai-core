/**
 * Simple MCP Server Test
 * Tests that the server can list tools and execute a basic tool
 */

const { spawn } = require('child_process');

console.log('Starting MCP server test...\n');

const server = spawn('node', ['mcp-server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';
let testsPassed = 0;
let testsFailed = 0;

// Test 1: List tools
setTimeout(() => {
  console.log('Test 1: Listing available tools...');
  const request = {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  };
  server.stdin.write(JSON.stringify(request) + '\n');
}, 500);

// Test 2: Call crossroads_list_projects
setTimeout(() => {
  console.log('\nTest 2: Calling crossroads_list_projects...');
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'crossroads_list_projects',
      arguments: { limit: 5 }
    },
    id: 2
  };
  server.stdin.write(JSON.stringify(request) + '\n');
}, 1500);

// Collect responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      
      if (response.id === 1) {
        // Test 1 response
        if (response.result && response.result.tools) {
          console.log(`✅ Test 1 PASSED: Found ${response.result.tools.length} tools`);
          console.log('   Tools:', response.result.tools.map(t => t.name).join(', '));
          testsPassed++;
        } else {
          console.log('❌ Test 1 FAILED: No tools found');
          testsFailed++;
        }
      }
      
      if (response.id === 2) {
        // Test 2 response
        if (response.result && response.result.content) {
          console.log('✅ Test 2 PASSED: crossroads_list_projects executed');
          const content = JSON.parse(response.result.content[0].text);
          console.log(`   Found ${content.projects ? content.projects.length : 0} projects`);
          testsPassed++;
        } else {
          console.log('❌ Test 2 FAILED: No result returned');
          testsFailed++;
        }
        
        // End tests
        setTimeout(() => {
          console.log(`\n${'='.repeat(50)}`);
          console.log(`Tests Passed: ${testsPassed}`);
          console.log(`Tests Failed: ${testsFailed}`);
          console.log(`${'='.repeat(50)}`);
          server.kill();
          process.exit(testsFailed > 0 ? 1 : 0);
        }, 500);
      }
    } catch (err) {
      // Ignore non-JSON lines (like initialization messages)
    }
  });
});

// Timeout safety
setTimeout(() => {
  console.error('\n⏱️ Test timeout - server may not be responding');
  server.kill();
  process.exit(1);
}, 5000);
