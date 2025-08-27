# Agent Deck Setup Guide

## Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

## Fresh Clone Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd agent-deck
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 3. Build All Packages
```bash
npm run build
```

### 4. Start the Services

#### Backend API Server
```bash
cd packages/backend
npm run dev
# Server runs on http://localhost:8000
```

#### Frontend Development Server
```bash
cd apps/agent-deck
npm run dev
# Frontend runs on http://localhost:3000
```

#### MCP Server (Optional - for testing)
```bash
cd packages/mcp-server
npm run build
node dist/index.js
```

## Essential Files Checklist

### Root Level Files ✅
- [x] `package.json` - Root package configuration
- [x] `turbo.json` - Turborepo configuration
- [x] `tsconfig.json` - Root TypeScript configuration
- [x] `.gitignore` - Git ignore rules (fixed to include frontend lib files)
- [x] `README.md` - Project documentation

### Shared Package ✅
- [x] `packages/shared/package.json`
- [x] `packages/shared/src/index.ts`
- [x] `packages/shared/src/schemas/` - All schema files
- [x] `packages/shared/src/types/` - Type definitions
- [x] `packages/shared/src/utils/` - Utility functions

### Backend Package ✅
- [x] `packages/backend/package.json`
- [x] `packages/backend/src/index.ts`
- [x] `packages/backend/src/server/` - Server setup
- [x] `packages/backend/src/routes/` - API routes
- [x] `packages/backend/src/services/` - Business logic
- [x] `packages/backend/src/models/` - Database models

### MCP Server Package ✅
- [x] `packages/mcp-server/package.json`
- [x] `packages/mcp-server/src/index.ts`
- [x] `packages/mcp-server/src/server.ts`
- [x] `packages/mcp-server/agent-deck.db` - **IMPORTANT: Database file**

### Frontend Package ✅
- [x] `apps/agent-deck/package.json`
- [x] `apps/agent-deck/index.html`
- [x] `apps/agent-deck/vite.config.ts`
- [x] `apps/agent-deck/tailwind.config.ts`
- [x] `apps/agent-deck/tsconfig.json`
- [x] `apps/agent-deck/src/` - All source files
- [x] `apps/agent-deck/src/lib/queryClient.ts` - **IMPORTANT: API client**
- [x] `apps/agent-deck/src/lib/utils.ts` - Utility functions

## Common Issues and Solutions

### 1. Missing Dependencies
**Error**: `Cannot find module '@agent-deck/shared'`
**Solution**: Run `npm install` in the root directory

### 2. TypeScript Errors
**Error**: Multiple TypeScript compilation errors
**Solution**: 
```bash
# Install missing testing dependencies
cd apps/agent-deck
npm install @testing-library/react @testing-library/jest-dom

# Fix unused imports (already done in the codebase)
npm run check
```

### 3. Database Issues
**Error**: `Cannot find database file`
**Solution**: Ensure `packages/mcp-server/agent-deck.db` exists (it's included in the repository)

### 4. Port Conflicts
**Error**: `Port 8000 already in use`
**Solution**: 
```bash
# Kill existing processes
lsof -ti:8000 | xargs kill -9

# Or use different ports via environment variables
PORT=8001 npm run dev
```

### 5. Build Failures
**Error**: Build fails with module resolution errors
**Solution**:
```bash
# Clean and rebuild
npm run clean
npm run build
```

### 6. Missing Frontend Files (FIXED ✅)
**Error**: `Cannot find module '@/lib/queryClient'` or missing `src/lib/` files
**Solution**: This issue has been fixed! The `.gitignore` file was incorrectly ignoring the `apps/agent-deck/src/lib/` directory. The fix is now committed to the repository.

**What was fixed:**
- Updated `.gitignore` to not ignore `apps/agent-deck/src/lib/` directory
- Added essential files `queryClient.ts` and `utils.ts` to git tracking
- Added missing testing dependencies to `package.json`

**Users should NOT manually edit these files** - the installation process will handle everything automatically.

## Environment Variables (Optional)

The application works with default values, but you can customize:

```bash
# Backend
export PORT=8000
export HOST=0.0.0.0

# MCP Server
export MCP_PORT=3002
export MCP_HOST=localhost
```

## Verification Steps

### 1. Backend Health Check
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Frontend Access
- Open http://localhost:3000 in browser
- Should see the Agent Deck interface

### 3. API Endpoints
```bash
# List services
curl http://localhost:8000/api/services

# List decks
curl http://localhost:8000/api/decks
```

## Development Workflow

### 1. Start Development Servers
```bash
# Terminal 1: Backend
cd packages/backend && npm run dev

# Terminal 2: Frontend
cd apps/agent-deck && npm run dev
```

### 2. Make Changes
- Edit files in `apps/agent-deck/src/` for frontend changes
- Edit files in `packages/backend/src/` for backend changes
- Edit files in `packages/shared/src/` for shared types

### 3. Test Changes
```bash
# Run tests
npm test

# Type check
npm run type-check
```

## Troubleshooting

### If Frontend Won't Start
1. Check if backend is running on port 8000
2. Verify all dependencies are installed
3. Check for TypeScript errors: `npm run check`

### If Backend Won't Start
1. Check if port 8000 is available
2. Verify database file exists
3. Check for missing dependencies

### If MCP Server Won't Start
1. Ensure backend is running (MCP server reads from backend database)
2. Check if database file exists
3. Verify TypeScript compilation

## File Structure Summary

```
agent-deck/
├── package.json                 # Root package
├── turbo.json                   # Turborepo config
├── tsconfig.json               # Root TS config
├── packages/
│   ├── shared/                 # Shared types & schemas
│   ├── backend/                # Fastify API server
│   └── mcp-server/             # MCP server + database
└── apps/
    └── agent-deck/             # React frontend
```

## Important Notes

### ✅ All Essential Files Are Now Included
The repository now includes all necessary files:
- **Frontend lib files**: `apps/agent-deck/src/lib/queryClient.ts` and `utils.ts` are now properly tracked
- **Database file**: `packages/mcp-server/agent-deck.db` is included
- **All dependencies**: Missing testing dependencies have been added
- **Configuration files**: All necessary config files are present

### 🚫 No Manual File Editing Required
Users should **NOT** need to manually edit any files in `src/lib/` or create missing files. The installation process should handle everything automatically.

### 🔧 What Was Fixed
1. **`.gitignore` issue**: Fixed to not ignore frontend `src/lib/` directory
2. **Missing dependencies**: Added `@testing-library/react` and `@testing-library/jest-dom`
3. **TypeScript errors**: Fixed unused imports and type issues
4. **Build process**: Added `install:all` script for easier setup

All essential files are present in the repository. The main requirements are:
1. **Node.js 18+**
2. **npm install** (installs all dependencies)
3. **npm run build** (builds all packages)
4. **Start backend first** (frontend depends on it)
5. **Start frontend** (connects to backend)

The repository is complete and should work after a fresh clone with these steps.
