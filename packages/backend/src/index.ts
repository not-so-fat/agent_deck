import { createServer } from './server';

async function start() {
  try {
    const server = await createServer();
    
    const port = process.env.PORT ? parseInt(process.env.PORT) : 8000;
    const host = process.env.HOST || '127.0.0.1';
    
    await server.listen({ port, host });
    
    console.log(`🚀 Agent Deck Backend server running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
