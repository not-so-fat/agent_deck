import { AgentDeckMCPServer } from './mcp-server';

process.on('uncaughtException', (error) => {
  console.error('❌ MCP server uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ MCP server unhandled rejection:', reason);
});

async function startMCPServer() {
  try {
    console.log('🚀 Starting Agent Deck MCP Server...');
    
    // Create and start the MCP server (simplified version without database)
    const mcpServer = new AgentDeckMCPServer();
    await mcpServer.start();
    
    console.log('✅ Agent Deck MCP Server is ready to accept connections');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down MCP server...');
      await mcpServer.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down MCP server...');
      await mcpServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

startMCPServer();
