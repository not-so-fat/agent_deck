import { AgentDeckMCPServer } from './mcp-server';

async function startMCPServer() {
  try {
    const port = process.env.AGENT_DECK_MCP_PORT
      ? Number.parseInt(process.env.AGENT_DECK_MCP_PORT, 10)
      : 3001;
    const host = process.env.AGENT_DECK_MCP_HOST ?? '127.0.0.1';
    const backendUrl = process.env.AGENT_DECK_BACKEND_URL ?? 'http://127.0.0.1:8000';

    console.log('🚀 Starting Agent Deck MCP Server...');
    
    const mcpServer = new AgentDeckMCPServer(port, backendUrl, undefined, host);
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
