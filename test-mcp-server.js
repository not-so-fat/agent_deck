#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the built MCP server
const mcpServerPath = join(__dirname, 'packages/mcp-server/dist/index.js');

console.log('🚀 Testing MCP Server...');
console.log(`📁 Server path: ${mcpServerPath}`);

// Spawn the MCP server process
const mcpServer = spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageId = 1;

// Function to send JSON-RPC message to the server
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log(`📤 Sending: ${method}`);
  console.log(`📋 Params:`, JSON.stringify(params, null, 2));
  
  mcpServer.stdin.write(JSON.stringify(message) + '\n');
}

// Handle responses from the server
mcpServer.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      console.log(`📥 Received: ${response.method || 'response'}`);
      console.log(`📋 Response:`, JSON.stringify(response, null, 2));
      
      // If this is a response to our request, we can handle it
      if (response.result) {
        console.log(`✅ Success:`, response.result);
      } else if (response.error) {
        console.log(`❌ Error:`, response.error);
      }
    } catch (error) {
      console.log(`⚠️ Raw output:`, line);
    }
  }
});

// Handle errors
mcpServer.stderr.on('data', (data) => {
  console.error(`🔴 Server error:`, data.toString());
});

// Handle server exit
mcpServer.on('close', (code) => {
  console.log(`🔚 MCP server exited with code ${code}`);
});

// Test sequence
setTimeout(() => {
  console.log('\n🔍 Testing MCP Server Capabilities...\n');
  
  // Test 1: Initialize the server
  sendMessage('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });
  
  // Test 2: List tools (after a short delay)
  setTimeout(() => {
    sendMessage('tools/list');
  }, 1000);
  
  // Test 3: List resources (after another delay)
  setTimeout(() => {
    sendMessage('resources/list');
  }, 2000);
  
  // Test 4: List prompts (after another delay)
  setTimeout(() => {
    sendMessage('prompts/list');
  }, 3000);
  
  // Test 5: Shutdown after all tests
  setTimeout(() => {
    sendMessage('notifications/shutdown');
    setTimeout(() => {
      mcpServer.kill();
      process.exit(0);
    }, 1000);
  }, 4000);
  
}, 1000);
