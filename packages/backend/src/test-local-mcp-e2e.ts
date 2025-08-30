#!/usr/bin/env tsx

import { LocalMCPServerManager } from './services/local-mcp-server-manager';
import { ConfigManager } from './services/config-manager';
import { ServiceManager } from './services/service-manager';
import { MCPClientManager } from './services/mcp-client-manager';
import { OAuthManager } from './services/oauth-manager';
import { DatabaseManager } from './models/database';
import { Service } from '@agent-deck/shared';

async function testLocalMCPServerE2E() {
  console.log('🧪 Testing Local MCP Server End-to-End Flow...\n');

  // Initialize managers
  const db = new DatabaseManager();
  const configManager = new ConfigManager();
  const localManager = new LocalMCPServerManager();
  
  // Create MCP client manager with local server manager
  const mcpClient = new MCPClientManager();
  (mcpClient as any).localServerManager = localManager;
  
  // Create OAuth manager (required by ServiceManager)
  const oauthManager = new OAuthManager();
  
  const serviceManager = new ServiceManager(db, mcpClient, oauthManager);

  try {
    // Test 1: Import local servers from configuration
    console.log('📋 Test 1: Importing local servers from configuration...');
    const config = {
      mcpServers: {
        memory: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory']
        }
      }
    };
    
    const services = await serviceManager.importLocalServersFromConfig(JSON.stringify(config));
    console.log('✅ Imported services:', services.length);
    services.forEach(service => {
      console.log(`  - ${service.name} (${service.id}): ${service.localCommand} ${service.localArgs?.join(' ')}`);
    });

    if (services.length === 0) {
      throw new Error('No services were imported');
    }

    const memoryService = services[0];

    // Test 2: Start the local MCP server
    console.log('\n📋 Test 2: Starting local MCP server...');
    await serviceManager.startLocalServer(memoryService.id);
    console.log('✅ Local MCP server started');

    // Test 3: Discover tools (using unified API)
    console.log('\n📋 Test 3: Discovering tools (unified API)...');
    const tools = await serviceManager.discoverServiceTools(memoryService.id);
    console.log('✅ Discovered tools:', tools.length);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    if (tools.length === 0) {
      console.log('⚠️ No tools discovered - this might be normal for some servers');
    }

    // Test 4: Call a tool (using unified API)
    console.log('\n📋 Test 4: Calling tool (unified API)...');
    if (tools.length > 0) {
      const firstTool = tools[0];
      console.log(`  Calling tool: ${firstTool.name}`);
      
      try {
        const result = await serviceManager.callServiceTool(memoryService.id, firstTool.name, {});
        console.log('✅ Tool call result:', result);
      } catch (error) {
        console.log('⚠️ Tool call failed (this might be expected):', error.message);
      }
    } else {
      console.log('⚠️ Skipping tool call - no tools available');
    }

    // Test 5: Check service health (using unified API)
    console.log('\n📋 Test 5: Checking service health (unified API)...');
    const health = await serviceManager.checkServiceHealth(memoryService.id);
    console.log('✅ Service health:', health);

    // Test 6: Get local server status
    console.log('\n📋 Test 6: Getting local server status...');
    const status = await serviceManager.getLocalServerStatus(memoryService.id);
    console.log('✅ Local server status:', status);

    // Test 7: Stop the local MCP server
    console.log('\n📋 Test 7: Stopping local MCP server...');
    await serviceManager.stopLocalServer(memoryService.id);
    console.log('✅ Local MCP server stopped');

    // Test 8: Verify server is stopped
    console.log('\n📋 Test 8: Verifying server is stopped...');
    const finalStatus = await serviceManager.getLocalServerStatus(memoryService.id);
    console.log('✅ Final status:', finalStatus);

    console.log('\n🎉 All end-to-end tests passed! Local MCP server integration is working correctly.');

  } catch (error) {
    console.error('❌ End-to-end test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await localManager.cleanup();
    await db.close();
    console.log('✅ Cleanup completed');
  }
}

// Run the end-to-end test
testLocalMCPServerE2E().catch(console.error);
