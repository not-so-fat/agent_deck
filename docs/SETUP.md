# Agent Deck - Setup Guide

## Prerequisites

### **Required Software**
- **Node.js 20.x LTS** (required)
- **npm** or **yarn**
- **Git**

### **Node.js Version Setup**

**Option 1: Using nvm (Recommended)**
```bash
# Install nvm if you haven't already
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 20
nvm install 20
nvm use 20
```

**Option 2: Using Homebrew (macOS)**
```bash
# Install Node 20
brew install node@20

# Add to PATH (add to your ~/.zshrc or ~/.bashrc)
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
```

**Option 3: Direct Download**
Download Node.js 20.x LTS from [nodejs.org](https://nodejs.org/)

### **Why Node 20?**
- Native modules like `better-sqlite3` are built against the active Node version
- Using Node 20 avoids NODE_MODULE_VERSION mismatches
- Ensures compatibility with all dependencies

## Quick Start

### **1. Clone the Repository**
```bash
git clone <repository-url>
cd agent_deck
```

### **2. Install Dependencies**
```bash
# Install all dependencies (root and workspaces)
npm install
```

### **3. Build All Packages**
```bash
# Build all packages in the monorepo
npm run build
```

### **4. Start All Services (Recommended)**
```bash
# Start backend (8000), frontend (3000), and MCP server (3001)
npm run dev:all
```

### **5. Verify Installation**
```bash
# Check backend health
curl http://localhost:8000/health

# Check MCP server status
curl http://localhost:3001/backend-status

# Open frontend in browser
open http://localhost:3000
```

## Individual Service Setup

### **Backend API Server**
```bash
cd packages/backend
npm run dev
# Server runs on http://localhost:8000
```

### **Frontend Development Server**
```bash
cd apps/agent-deck
npm run dev -- --port 3000 --strictPort
# Frontend runs on http://localhost:3000
```

### **MCP Server**
```bash
cd packages/backend
npm run mcp
# MCP server runs on http://localhost:3001
```

## Development Commands

### **Root Level Commands**
```bash
# Build all packages
npm run build

# Start all services
npm run dev:all

# Start individual services
npm run backend:dev    # Backend on port 8000
npm run frontend:dev   # Frontend on port 3000
npm run mcp           # MCP server on port 3001

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Clean build artifacts
npm run clean
```

### **Package Level Commands**
```bash
# Backend package
cd packages/backend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run mcp          # Start MCP server

# Frontend package
cd apps/agent-deck
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run preview      # Preview production build

# Shared package
cd packages/shared
npm run build        # Build shared types
npm run test         # Run tests
```

## Port Configuration

### **Default Ports**
- **Frontend**: 3000
- **Backend API**: 8000
- **MCP Server**: 3001

### **Custom Ports**
```bash
# Set custom ports via environment variables
PORT=8001 npm run backend:dev
MCP_PORT=3002 npm run mcp
```

### **Port Conflicts**
If ports are already in use:
```bash
# Find processes using ports
lsof -i :3000
lsof -i :8000
lsof -i :3001

# Kill processes
kill -9 $(lsof -t -i:3000)
kill -9 $(lsof -t -i:8000)
kill -9 $(lsof -t -i:3001)
```

## Environment Variables

### **Backend Configuration**
```bash
# Server configuration
PORT=8000                    # API server port
HOST=0.0.0.0                # Server host
NODE_ENV=development        # Environment

# Database configuration
DB_PATH=./agent_deck.db     # SQLite database path
```

### **MCP Server Configuration**
```bash
# MCP server configuration
MCP_PORT=3001               # MCP server port
MCP_HOST=localhost          # MCP server host
BACKEND_URL=http://localhost:8000  # Backend API URL
```

### **Frontend Configuration**
```bash
# Vite configuration
VITE_API_URL=http://localhost:8000  # Backend API URL
VITE_MCP_URL=http://localhost:3001  # MCP server URL
```

## Common Issues and Solutions

### **1. Node Version Issues**
**Error**: `NODE_MODULE_VERSION mismatch`
```bash
# Solution: Use Node 20
nvm use 20
# or
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Reinstall dependencies
rm -rf node_modules packages/*/node_modules apps/*/node_modules
npm install
```

### **2. Port Already in Use**
**Error**: `EADDRINUSE: address already in use`
```bash
# Solution: Free the port
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### **3. Database Issues**
**Error**: `Cannot find database file`
```bash
# Solution: Database is created automatically
# If issues persist, check file permissions
ls -la packages/backend/agent_deck.db
```

### **4. Build Failures**
**Error**: Build fails with module resolution errors
```bash
# Solution: Clean and rebuild
npm run clean
npm run build
```

### **5. TypeScript Errors**
**Error**: Multiple TypeScript compilation errors
```bash
# Solution: Check for missing dependencies
npm install
npm run type-check
```

### **6. Missing Frontend Files**
**Error**: `Cannot find module '@/lib/queryClient'`
```bash
# Solution: This should be resolved automatically
# If issues persist, check that all files are tracked in git
git status
```

## Verification Steps

### **1. Backend Health Check**
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### **2. API Endpoints Test**
```bash
# List services
curl http://localhost:8000/api/services

# List decks
curl http://localhost:8000/api/decks

# Get active deck
curl http://localhost:8000/api/decks/active
```

### **3. MCP Server Test**
```bash
# Check MCP server status
curl http://localhost:3001/backend-status
# Expected: {"mcpServer":"ok","backend":{"status":"ok"},"connected":true}

# Check MCP health
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

### **4. Frontend Test**
```bash
# Open in browser
open http://localhost:3000

# Check for console errors
# Verify all components load correctly
```

## Development Workflow

### **1. Start Development Environment**
```bash
# Option 1: Start all services
npm run dev:all

# Option 2: Start individually
npm run backend:dev    # Terminal 1
npm run frontend:dev   # Terminal 2
npm run mcp           # Terminal 3
```

### **2. Make Changes**
- **Frontend**: Edit files in `apps/agent-deck/src/`
- **Backend**: Edit files in `packages/backend/src/`
- **Shared**: Edit files in `packages/shared/src/`

### **3. Test Changes**
```bash
# Run tests
npm test

# Type check
npm run type-check

# Lint code
npm run lint
```

### **4. Build for Production**
```bash
# Build all packages
npm run build

# Preview frontend
cd apps/agent-deck
npm run preview
```

## File Structure Summary

```
agent_deck/
├── package.json                 # Root package
├── turbo.json                   # Turborepo config
├── tsconfig.json               # Root TS config
├── .nvmrc                      # Node version (20)
├── scripts/
│   └── dev-all.sh              # One-command launcher
├── packages/
│   ├── shared/                 # Shared types & schemas
│   └── backend/                # Fastify API server
└── apps/
    └── agent-deck/             # React frontend
```

## Troubleshooting Checklist

### **Installation Issues**
- [ ] Node.js version is 20.x
- [ ] All dependencies installed (`npm install`)
- [ ] All packages built (`npm run build`)
- [ ] No port conflicts

### **Runtime Issues**
- [ ] Backend API is running on port 8000
- [ ] Frontend is running on port 3000
- [ ] MCP server is running on port 3001
- [ ] Database file exists and is accessible
- [ ] All services can communicate

### **Development Issues**
- [ ] TypeScript compilation clean
- [ ] All tests passing
- [ ] No linting errors
- [ ] Hot reload working
- [ ] WebSocket connections established

## Support

If you encounter issues not covered in this guide:

1. **Check the logs**: All services log to `logs/` directory
2. **Verify Node version**: Ensure you're using Node 20
3. **Clean reinstall**: Remove `node_modules` and reinstall
4. **Check GitHub issues**: Look for similar problems
5. **Create an issue**: Provide detailed error information

## Next Steps

After successful setup:

1. **Read the [User Guide](USER_GUIDE.md)** to learn how to use Agent Deck
2. **Read the [Architecture Guide](ARCHITECTURE.md)** to understand the system
3. **Read the [Development Guide](DEVELOPMENT.md)** to contribute to the project
4. **Read the [Integration Guide](INTEGRATION.md)** for advanced usage

The system should now be ready for development and use!
