# Frontend Integration Plan: Local MCP Servers

## Overview

This document outlines the plan for integrating local MCP server support into the Agent Deck frontend, maintaining the unified service architecture while providing an intuitive user experience.

## Current State

### Backend Support ✅
- **Local MCP Server Management**: Full backend support implemented
- **Environment Variables**: Supported and validated
- **API Endpoints**: All required endpoints available
- **Database Schema**: Extended with local MCP fields
- **Security Features**: Command validation and environment sanitization

### Frontend State
- **Service Registration**: Separate modals for MCP and A2A
- **Service Display**: Generic "MCP" badge for all MCP services
- **No Local MCP UI**: No frontend support for local MCP servers

## Integration Plan

### 1. Service Registration Modal Enhancement

#### **Current Structure**
```
"Register MCP" button → MCP Registration Modal
"Register A2A" button → A2A Registration Modal
```

#### **New Structure**
```
"Register MCP" button → Tabbed Modal
├── "Remote MCP Server" tab (default)
└── "Local MCP Server" tab
```

#### **Tabbed Modal Design**
- **Single Modal**: One modal for both remote and local MCP servers
- **Default Tab**: "Remote MCP Server" selected by default
- **Tab Switching**: Smooth transition between tabs
- **Form Persistence**: Maintain form state when switching tabs

### 2. Local MCP Form Fields

#### **Required Fields**
- **Name**: Text input, must be unique across all services
- **Command**: Text input, validated for safety (e.g., "npx", "python")
- **Arguments**: Dynamic array of strings (e.g., ["-y", "@modelcontextprotocol/server-memory"])

#### **Optional Fields**
- **Environment Variables**: Key-value pairs for server configuration
- **Description**: Text area for service description
- **Card Color**: Color picker for service card customization

#### **Form Validation**
- **Command Safety**: Real-time validation against unsafe commands
- **Name Uniqueness**: Check against existing service names
- **Environment Variables**: Sanitize variable names
- **Required Fields**: Ensure all required fields are filled

### 3. Service Card Display Updates

#### **Current Display**
```typescript
// Corner indicators
{service.type === 'mcp' ? 'M' : 'A'}

// Type badge
{service.type.toUpperCase()} // Shows "MCP" for all MCP services
```

#### **New Display**
```typescript
// Corner indicators
{service.type === 'mcp' ? 'RM' : 
 service.type === 'local-mcp' ? 'LM' : 'A'}

// Type badge
{service.type === 'mcp' ? 'Remote MCP' : 
 service.type === 'local-mcp' ? 'Local MCP' : 'A2A'}
```

#### **Visual Distinctions**
- **Remote MCP**: Blue accent, "RM" corner indicator, "Remote MCP" badge
- **Local MCP**: Green accent, "LM" corner indicator, "Local MCP" badge
- **A2A**: Purple accent, "A" corner indicator, "A2A" badge

### 4. API Integration

#### **New API Calls**
```typescript
// Import local server configuration
POST /api/local-mcp/import
{
  "config": "{\"mcpServers\":{\"name\":{\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-memory\"]}}}"
}

// Start local server
POST /api/local-mcp/:serviceId/start

// Stop local server
POST /api/local-mcp/:serviceId/stop

// Get server status
GET /api/local-mcp/:serviceId/status
```

#### **Form Submission Flow**
1. **Validate Form**: Client-side validation
2. **Create Configuration**: Build mcpServers manifest
3. **Import Configuration**: Call `/api/local-mcp/import`
4. **Start Server**: Automatically start the local server
5. **Success Feedback**: Show discovered tools and server status

### 5. User Experience Flow

#### **Step-by-Step Process**
1. **Click "Register MCP"** → Opens tabbed modal
2. **Switch to "Local MCP Server" tab** → Shows local server form
3. **Fill Form**:
   - Name: "Memory Server"
   - Command: "npx"
   - Arguments: ["-y", "@modelcontextprotocol/server-memory"]
   - Environment Variables: Optional
4. **Submit Form** → Validation → Import → Start → Success
5. **Result**: Service appears in collection with "Local MCP" badge

#### **Loading States**
- **Validating**: "Validating command and configuration..."
- **Importing**: "Importing local server configuration..."
- **Starting**: "Starting local MCP server..."
- **Discovering**: "Discovering tools and capabilities..."
- **Success**: "Local MCP server started successfully! Found X tools."

#### **Error Handling**
- **Command Validation**: "Unsafe command detected. Please use a safe command."
- **Name Conflict**: "Service name already exists. Please choose a different name."
- **Server Startup**: "Failed to start local server. Check command and arguments."
- **Tool Discovery**: "Server started but no tools discovered."

### 6. Implementation Steps

#### **Phase 1: Card Component Updates**
1. Update corner indicators logic
2. Update type badge display
3. Add local MCP specific styling
4. Test with existing services

#### **Phase 2: Registration Modal Enhancement**
1. Add tabbed interface to existing modal
2. Create local MCP form component
3. Add form validation logic
4. Implement environment variables input

#### **Phase 3: API Integration**
1. Add local MCP API calls
2. Implement form submission flow
3. Add loading states and error handling
4. Test end-to-end flow

#### **Phase 4: Polish and Testing**
1. Add success feedback
2. Implement real-time validation
3. Add keyboard shortcuts
4. Comprehensive testing

### 7. Technical Implementation Details

#### **File Changes Required**
1. **`service-registration-modal.tsx`**:
   - Add tabbed interface
   - Add local MCP form
   - Add validation and loading states

2. **`card-component.tsx`**:
   - Update corner indicators
   - Update type badge display
   - Add local MCP styling

3. **`home.tsx`**:
   - Update button text (unchanged)
   - Add local MCP API integration

4. **New Components** (optional):
   - `LocalMCPForm.tsx` - Local MCP form component
   - `EnvironmentVariablesInput.tsx` - Environment variables input
   - `CommandValidation.tsx` - Real-time command validation

#### **State Management**
```typescript
// Form state
const [formData, setFormData] = useState({
  name: "",
  command: "",
  args: [""],
  env: {},
  description: "",
  cardColor: "#39FF14" // Green for local MCP
});

// Tab state
const [activeTab, setActiveTab] = useState<'remote' | 'local'>('remote');

// Loading state
const [isLoading, setIsLoading] = useState(false);
const [loadingStep, setLoadingStep] = useState<string>('');
```

#### **Validation Logic**
```typescript
// Command safety validation
const isCommandSafe = (command: string): boolean => {
  const unsafeCommands = ['rm', 'sudo', 'chmod', 'chown', 'dd'];
  return !unsafeCommands.some(unsafe => command.includes(unsafe));
};

// Environment variable sanitization
const sanitizeEnvVar = (key: string): boolean => {
  return /^[A-Z_][A-Z0-9_]*$/.test(key);
};
```

## Benefits

### **User Experience**
- **Unified Interface**: Single "Register MCP" button for all MCP servers
- **Clear Distinction**: Visual separation between remote and local servers
- **Intuitive Flow**: Familiar tabbed interface
- **Real-time Feedback**: Immediate validation and status updates

### **Technical Benefits**
- **Maintains Architecture**: Preserves unified service architecture
- **Extensible Design**: Easy to add more service types in the future
- **Consistent API**: Same service management for all types
- **Security First**: Built-in validation and sanitization

### **Development Benefits**
- **Reusable Components**: Tabbed interface can be reused
- **Type Safety**: Full TypeScript support
- **Testable**: Clear separation of concerns
- **Maintainable**: Modular component structure

## Success Criteria

### **Functional Requirements**
- ✅ Users can register local MCP servers through the UI
- ✅ Local servers appear with distinct "Local MCP" badges
- ✅ Form validation prevents unsafe commands
- ✅ Environment variables are properly handled
- ✅ Local servers can be started/stopped from the UI

### **User Experience Requirements**
- ✅ Single "Register MCP" button opens tabbed modal
- ✅ Remote MCP tab works exactly as before
- ✅ Local MCP tab provides intuitive form
- ✅ Clear visual distinction between service types
- ✅ Helpful error messages and loading states

### **Technical Requirements**
- ✅ Maintains existing API compatibility
- ✅ Preserves unified service architecture
- ✅ Full TypeScript type safety
- ✅ Comprehensive error handling
- ✅ Responsive design across devices

## Timeline

### **Week 1**: Card Component Updates
- Update service type display logic
- Add local MCP styling
- Test with existing services

### **Week 2**: Registration Modal Enhancement
- Add tabbed interface
- Create local MCP form
- Add form validation

### **Week 3**: API Integration
- Implement local MCP API calls
- Add loading states and error handling
- Test end-to-end flow

### **Week 4**: Polish and Testing
- Add success feedback
- Implement real-time validation
- Comprehensive testing and bug fixes

## Conclusion

This frontend integration plan maintains the unified service architecture while providing an intuitive and secure way for users to register and manage local MCP servers. The tabbed interface approach ensures a smooth user experience while preserving existing functionality.
