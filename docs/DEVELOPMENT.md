# Agent Deck - Development Guide

## Overview

This guide provides comprehensive information for developers contributing to Agent Deck, including development workflow, code organization, testing strategies, and best practices.

## Development Environment Setup

### **Prerequisites**
- **Node.js 20.x LTS** (required)
- **npm** or **yarn**
- **Git**
- **VS Code** (recommended) with TypeScript extensions

### **Initial Setup**
```bash
# Clone the repository
git clone <repository-url>
cd agent_deck

# Install dependencies
npm install

# Build all packages
npm run build

# Start development environment
npm run dev:all
```

### **IDE Configuration**
Recommended VS Code extensions:
- **TypeScript and JavaScript Language Features**
- **ESLint**
- **Prettier**
- **Tailwind CSS IntelliSense**
- **Auto Rename Tag**
- **Bracket Pair Colorizer**

## Project Structure

### **Monorepo Architecture**
```
agent_deck/
├── packages/
│   ├── shared/                 # Shared types, schemas, utilities
│   └── backend/                # Fastify API server + MCP server
├── apps/
│   └── agent-deck/             # React frontend
├── scripts/
│   └── dev-all.sh              # Development launcher
├── docs/                       # Documentation
├── logs/                       # Application logs
└── misc/                       # Assets and misc files
```

### **Package Responsibilities**

#### **Shared Package** (`packages/shared/`)
- **Types**: TypeScript interfaces for all data models
- **Schemas**: Zod validation schemas
- **Utilities**: Common utility functions
- **Database**: Shared database utilities

#### **Backend Package** (`packages/backend/`)
- **API Server**: Fastify REST API
- **MCP Server**: MCP protocol server
- **Database**: SQLite database management
- **Services**: Business logic layer
- **Routes**: API route handlers

#### **Frontend Package** (`apps/agent-deck/`)
- **Components**: React components
- **Pages**: Application pages
- **Hooks**: Custom React hooks
- **Services**: API integration
- **Utils**: Frontend utilities

## Development Workflow

### **Daily Development**
```bash
# Start development environment
npm run dev:all

# In separate terminals for individual services:
npm run backend:dev    # Backend API
npm run frontend:dev   # Frontend
npm run mcp           # MCP server
```

### **Making Changes**
1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Make Changes**: Edit files in appropriate packages
3. **Test Changes**: Run tests and verify functionality
4. **Commit Changes**: Use conventional commit messages
5. **Push Changes**: `git push origin feature/your-feature`
6. **Create Pull Request**: Submit for review

### **Code Organization**

#### **Backend Code Structure**
```
packages/backend/src/
├── server/              # Fastify server setup
├── routes/              # API route handlers
│   ├── local-mcp.ts     # Local MCP server routes
│   └── ...              # Other route files
├── services/            # Business logic
│   ├── local-mcp-server-manager.ts  # Local MCP server management
│   ├── config-manager.ts            # Configuration parsing and validation
│   └── ...              # Other service files
├── models/              # Database models
├── utils/               # Utilities
├── types/               # TypeScript types
├── mcp-server.ts        # MCP server implementation
├── mcp-index.ts         # MCP server entry point
└── test-local-mcp.ts    # Local MCP server test script
```

#### **Frontend Code Structure**
```
apps/agent-deck/src/
├── components/          # React components
│   ├── ui/             # Shadcn/ui components
│   └── ...             # Custom components
├── pages/              # Application pages
├── hooks/              # Custom React hooks
├── services/           # API services
├── lib/                # Utilities and configuration
├── types/              # Frontend types
└── index.css           # Global styles
```

### **Conventional Commits**
Use conventional commit messages:
```bash
# Format: type(scope): description
git commit -m "feat(backend): add OAuth token refresh"
git commit -m "fix(frontend): resolve service card rendering issue"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(shared): add validation schema tests"
```

## Testing Strategy

### **Testing Framework**
- **Vitest**: Fast unit testing framework
- **Testing Library**: React component testing
- **Coverage**: Built-in coverage reporting

### **Running Tests**
```bash
# Run all tests
npm test

# Run tests in specific package
cd packages/backend && npm test
cd apps/agent-deck && npm test
cd packages/shared && npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Current Test Status**: ✅ All tests passing
- Backend: All tests passing (including local MCP server tests)
- Frontend: All tests passing (WebSocket, Drag & Drop, Simple tests)
- Shared: All tests passing
- Local MCP Server: Comprehensive functionality tests passing

### **Test Organization**

#### **Unit Tests**
- **Location**: `__tests__/` directories or `.test.ts` files
- **Coverage**: Individual functions and components
- **Mocking**: Mock external dependencies

#### **Integration Tests**
- **Location**: `__tests__/integration/` directories
- **Coverage**: API endpoints and service interactions
- **Database**: Use test database instances

#### **Component Tests**
- **Location**: `__tests__/components/` directories
- **Coverage**: React component behavior
- **User Interactions**: Test user interactions and state changes

#### **Local MCP Server Tests**
- **Location**: `src/test-local-mcp.ts` and integration tests
- **Coverage**: Configuration parsing, process management, security validation
- **Mocking**: Mock subprocess spawning for testing

### **Test Examples**

#### **Backend API Test**
```typescript
// packages/backend/src/routes/__tests__/services.test.ts
import { describe, it, expect } from 'vitest';
import { createServiceHandler } from '../services';

describe('Service API', () => {
  it('should create a new service', async () => {
    const mockRequest = {
      body: {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com/mcp'
      }
    };
    
    const result = await createServiceHandler(mockRequest, {} as any);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Test Service');
  });
});
```

#### **Frontend Component Test**
```typescript
// apps/agent-deck/src/components/__tests__/ServiceCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ServiceCard } from '../ServiceCard';

describe('ServiceCard', () => {
  it('should render service information', () => {
    const service = {
      id: '1',
      name: 'Test Service',
      type: 'mcp',
      url: 'https://example.com/mcp',
      health: 'healthy'
    };
    
    render(<ServiceCard service={service} />);
    expect(screen.getByText('Test Service')).toBeInTheDocument();
  });
});
```

#### **Local MCP Server Test**
```typescript
// packages/backend/src/test-local-mcp.ts
import { LocalMCPServerManager } from './services/local-mcp-server-manager';
import { ConfigManager } from './services/config-manager';

describe('Local MCP Server', () => {
  it('should parse and validate configuration', () => {
    const configManager = new ConfigManager();
    const sampleConfig = configManager.generateSampleManifest();
    const services = configManager.manifestToServices(sampleConfig);
    
    expect(services.length).toBeGreaterThan(0);
    expect(services[0].type).toBe('local-mcp');
  });
  
  it('should validate command safety', () => {
    const configManager = new ConfigManager();
    expect(configManager.isCommandSafe('npx')).toBe(true);
    expect(configManager.isCommandSafe('rm -rf /')).toBe(false);
  });
});
```

## Code Quality

### **Linting and Formatting**
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### **ESLint Configuration**
- **TypeScript**: Strict TypeScript rules
- **React**: React-specific rules
- **Import/Export**: Import/export organization
- **Prettier**: Code formatting integration

### **Prettier Configuration**
- **Semi**: Always use semicolons
- **Single Quote**: Use single quotes
- **Trailing Comma**: Use trailing commas
- **Tab Width**: 2 spaces

### **TypeScript Configuration**
- **Strict Mode**: Enabled for all packages
- **No Implicit Any**: Require explicit types
- **Strict Null Checks**: Strict null checking
- **No Unused Variables**: Error on unused variables

## Database Development

### **Database Schema**
```sql
-- Services table
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mcp', 'a2a')),
    url TEXT NOT NULL,
    health TEXT NOT NULL DEFAULT 'unknown',
    -- ... other fields
);

-- Decks table
CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 0,
    -- ... other fields
);
```

### **Database Operations**
```typescript
// Example: Database operation
export class ServiceManager {
  async createService(data: CreateServiceInput): Promise<Service> {
    const validatedData = CreateServiceSchema.parse(data);
    
    const service: Service = {
      id: generateId(),
      ...validatedData,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await this.db.insertService(service);
    return service;
  }
}
```

### **Database Migrations**
- **Schema Changes**: Update database schema
- **Data Migration**: Migrate existing data
- **Versioning**: Track schema versions
- **Rollback**: Support for rollback operations

## API Development

### **API Design Principles**
- **RESTful**: Follow REST conventions
- **Consistent**: Use consistent response formats
- **Validated**: Validate all inputs with Zod
- **Documented**: Document all endpoints

### **API Response Format**
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### **Route Handler Pattern**
```typescript
// Example: API route handler
export async function createServiceHandler(
  request: FastifyRequest<{ Body: CreateServiceInput }>,
  reply: FastifyReply
): Promise<ApiResponse<Service>> {
  try {
    const service = await serviceManager.createService(request.body);
    return {
      success: true,
      data: service,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

## Frontend Development

### **Component Development**
```typescript
// Example: React component
interface ServiceCardProps {
  service: Service;
  onEdit?: (service: Service) => void;
  onDelete?: (serviceId: string) => void;
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  return (
    <div className="service-card">
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="actions">
        {onEdit && <button onClick={() => onEdit(service)}>Edit</button>}
        {onDelete && <button onClick={() => onDelete(service.id)}>Delete</button>}
      </div>
    </div>
  );
}
```

### **State Management**
```typescript
// Example: TanStack Query usage
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest('GET', '/api/services').then(r => r.json()),
    staleTime: 30000, // 30 seconds
  });
}
```

### **Custom Hooks**
```typescript
// Example: Custom hook
export function useWebSocket(url: string) {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => setData(JSON.parse(event.data));
    ws.onclose = () => setIsConnected(false);
    
    return () => ws.close();
  }, [url]);
  
  return { data, isConnected };
}
```

## Local MCP Server Development

### **Local MCP Server Manager**
```typescript
// Example: Local MCP server manager usage
const localManager = new LocalMCPServerManager();

// Start a local server
const service: Service = {
  id: 'local-memory',
  name: 'Memory Server',
  type: 'local-mcp',
  url: 'local://memory',
  localCommand: 'npx',
  localArgs: ['-y', '@modelcontextprotocol/server-memory'],
  // ... other fields
};

const processRecord = await localManager.startLocalServer(service);

// Call a tool on the local server
const result = await localManager.callTool(service.id, 'get_memory', { key: 'test' });

// Stop the server
await localManager.stopLocalServer(service.id);
```

### **Configuration Management**
```typescript
// Example: Parse and validate configuration
const configManager = new ConfigManager();

const manifest = configManager.parseManifest(jsonContent);
const services = configManager.manifestToServices(manifest);

// Validate command safety
const isSafe = configManager.isCommandSafe('npx');
const sanitizedEnv = configManager.sanitizeEnvironment({ 'UNSAFE_VAR': 'value' });
```

### **API Route Implementation**
```typescript
// Example: Local MCP server route
fastify.post('/api/local-mcp/import', async (request, reply) => {
  const { config } = request.body;
  const services = await serviceManager.importLocalServersFromConfig(config);
  
  return {
    success: true,
    data: { imported: services.length, services },
  };
});
```

## MCP Server Development

### **MCP Tool Implementation**
```typescript
// Example: MCP tool
server.tool(
  "get_active_deck",
  "Get the currently active deck with all its services",
  {
    input: z.object({}),
  },
  async () => {
    try {
      const activeDeck = await deckService.getActiveDeck();
      return {
        success: true,
        data: activeDeck,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
);
```

### **MCP Resource Implementation**
```typescript
// Example: MCP resource
server.resource(
  "agent-deck://services",
  "List of all services",
  async () => {
    const services = await serviceManager.getAllServices();
    return services.map(service => ({
      uri: `agent-deck://services/${service.id}`,
      name: service.name,
      description: service.description,
      mimeType: "application/json",
    }));
  }
);
```

## Performance Optimization

### **Backend Optimization**
- **Database Queries**: Optimize with proper indexing
- **Caching**: Implement caching for frequently accessed data
- **Connection Pooling**: Use connection pooling for database
- **Compression**: Enable response compression

### **Frontend Optimization**
- **Code Splitting**: Split code into smaller chunks
- **Lazy Loading**: Lazy load components and routes
- **Memoization**: Use React.memo and useMemo
- **Bundle Analysis**: Analyze bundle size regularly

### **Monitoring and Profiling**
```bash
# Bundle analysis
npm run build:analyze

# Performance profiling
npm run profile

# Memory usage monitoring
npm run monitor
```

## Security Best Practices

### **Input Validation**
```typescript
// Example: Input validation with Zod
const CreateServiceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['mcp', 'a2a', 'local-mcp']),
  url: z.string().url('Valid URL is required'),
  description: z.string().optional(),
  localCommand: z.string().optional(),
  localArgs: z.array(z.string()).optional(),
  localWorkingDir: z.string().optional(),
  localEnv: z.record(z.string()).optional(),
});
```

### **Authentication and Authorization**
- **OAuth**: Secure OAuth implementation
- **Token Management**: Secure token storage and refresh
- **Access Control**: Service-level access control
- **Input Sanitization**: Sanitize all user inputs

### **Error Handling**
```typescript
// Example: Secure error handling
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  // Don't expose sensitive information
  console.error('Operation failed:', error);
  return { 
    success: false, 
    error: 'Operation failed' 
  };
}
```

## Deployment

### **Build Process**
```bash
# Build all packages
npm run build

# Build for production
npm run build:prod

# Build individual packages
cd packages/backend && npm run build
cd apps/agent-deck && npm run build
```

### **Environment Configuration**
```bash
# Development
NODE_ENV=development
PORT=8000
MCP_PORT=3001

# Production
NODE_ENV=production
PORT=8000
MCP_PORT=3001
DATABASE_URL=file:./agent_deck.db
```

### **Docker Deployment**
```dockerfile
# Example: Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8000 3001
CMD ["npm", "start"]
```

## Contributing Guidelines

### **Code Review Process**
1. **Create Pull Request**: Submit PR with clear description
2. **Code Review**: At least one approval required
3. **Tests**: All tests must pass
4. **Documentation**: Update documentation if needed
5. **Merge**: Merge after approval

### **Pull Request Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

### **Issue Reporting**
When reporting issues:
1. **Clear Description**: Describe the problem clearly
2. **Reproduction Steps**: Provide steps to reproduce
3. **Expected vs Actual**: Describe expected vs actual behavior
4. **Environment**: Include environment details
5. **Logs**: Include relevant logs and error messages

## Resources

### **Documentation**
- [Architecture Guide](ARCHITECTURE.md)
- [Setup Guide](SETUP.md)
- [User Guide](USER_GUIDE.md)
- [Integration Guide](INTEGRATION.md)

### **External Resources**
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [MCP Documentation](https://modelcontextprotocol.io/)

### **Development Tools**
- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)

This development guide provides comprehensive information for contributing to Agent Deck. Follow these guidelines to ensure code quality, maintainability, and consistency across the project.
