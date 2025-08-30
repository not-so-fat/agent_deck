# Agent Deck - User Guide

## Overview

Agent Deck is a local application that acts as a "browser for agents" to manage MCP servers and services. It provides a clean, modern interface for managing decks of AI services and integrates with the Model Context Protocol (MCP).

## Getting Started

### **First Launch**
1. **Start the Application**: Run `npm run dev:all` to start all services
2. **Open the Interface**: Navigate to http://localhost:3000 in your browser
3. **Explore the Interface**: You'll see the main dashboard with service cards

### **Interface Overview**
- **Service Cards**: Display all registered services with health status
- **Deck Builder**: Drag-and-drop interface for building service decks
- **Service Registration**: Modal for adding new MCP or A2A services
- **Real-time Updates**: Live status updates via WebSocket

## Service Management

### **Adding Services**

#### **MCP Services**
1. Click the **"Add Service"** button
2. Select **"MCP Service"** type
3. Fill in the service details:
   - **Name**: Descriptive name for the service
   - **URL**: MCP server endpoint (e.g., `https://example.com/mcp`)
   - **Description**: Optional description
   - **Card Color**: Choose a color for the service card
4. Click **"Register Service"**

#### **A2A Services**
1. Click the **"Add Service"** button
2. Select **"A2A Service"** type
3. Fill in the service details:
   - **Name**: Descriptive name for the service
   - **URL**: A2A service endpoint
   - **Description**: Optional description
   - **Card Color**: Choose a color for the service card
4. Click **"Register Service"**

#### **Local MCP Services**
1. Click the **"Register MCP"** button
2. Switch to the **"Local MCP Server"** tab
3. **Option 1 - JSON Configuration**:
   - Paste a JSON configuration with `mcpServers` format
   - Click **"Parse Configuration"** to extract details
   - Review and edit the parsed information
   - Click **"Register Service"**
4. **Option 2 - Manual Entry**:
   - **Name**: Unique name for the service
   - **Command**: Executable command (e.g., `npx`, `python`)
   - **Arguments**: Array of command arguments
   - **Environment Variables**: Optional key-value pairs
   - **Description**: Optional description
5. Click **"Register Service"**

**Important Notes**:
- **On-Demand Startup**: Local MCP servers start automatically when first accessed, not on system startup
- **Name Uniqueness**: Service names must be unique across all service types (Remote MCP, Local MCP, A2A)
- **Command Safety**: Only safe commands are allowed (no `rm`, `sudo`, etc.)
- **Process Management**: Servers are automatically managed and cleaned up on system shutdown

### **Service Configuration**

#### **OAuth Setup**
For services requiring OAuth authentication:

1. **Register the Service**: Add the service as normal
2. **Configure OAuth**: Click on the service card to open details
3. **Enter OAuth Credentials**:
   - **Client ID**: Your OAuth application client ID
   - **Client Secret**: Your OAuth application client secret
   - **Authorization URL**: OAuth provider's authorization endpoint
   - **Token URL**: OAuth provider's token endpoint
   - **Redirect URI**: `http://localhost:8000/api/oauth/callback`
   - **Scope**: Required OAuth scopes
4. **Save Configuration**: Click "Save" to store the OAuth settings
5. **Authorize**: Click "Authorize" to start the OAuth flow

#### **Common OAuth Providers**

**GitHub**
- **Authorization URL**: `https://github.com/login/oauth/authorize`
- **Token URL**: `https://github.com/login/oauth/access_token`
- **Scope**: `repo` (for repository access)

**Notion**
- **Authorization URL**: `https://api.notion.com/v1/oauth/authorize`
- **Token URL**: `https://api.notion.com/v1/oauth/token`
- **Scope**: `read` or `write`

### **Service Health Monitoring**
- **Green**: Service is healthy and responding
- **Red**: Service is unhealthy or unreachable
- **Gray**: Service status is unknown
- **Real-time Updates**: Health status updates automatically

### **Service Actions**
- **View Details**: Click on a service card to see details
- **Edit Service**: Modify service configuration
- **Delete Service**: Remove service from the system
- **Test Connection**: Verify service is accessible

## Deck Building

### **Creating Decks**
1. Click **"Create Deck"** button
2. Enter deck details:
   - **Name**: Descriptive name for the deck
   - **Description**: Optional description
3. Click **"Create Deck"**

### **Adding Services to Decks**
1. **Drag and Drop**: Drag service cards from the service list to the deck area
2. **Reorder Services**: Drag services within the deck to reorder them
3. **Remove Services**: Drag services out of the deck to remove them

### **Deck Management**
- **Activate Deck**: Click "Activate" to make a deck the active deck
- **Edit Deck**: Modify deck name and description
- **Delete Deck**: Remove deck and all its services
- **View Active Deck**: The active deck is highlighted and used by the MCP server

### **Active Deck**
- Only one deck can be active at a time
- The active deck's services are available through the MCP server
- MCP clients can access tools from all services in the active deck
- Changes to the active deck are immediately available to MCP clients

## MCP Integration

### **MCP Server Access**
- **URL**: `http://localhost:3001/mcp`
- **Protocol**: Model Context Protocol (MCP)
- **Transport**: HTTP with session management

### **Available MCP Tools**
When connected to the MCP server, you can access:

1. **Deck Management Tools**:
   - `get_decks` - List all available decks
   - `get_active_deck` - Get the currently active deck with services
   - `list_active_deck_services` - List services in the active deck

2. **Service Tools**:
   - `list_service_tools(serviceId)` - Discover tools for a specific service in the active deck
   - `call_service_tool(serviceId, toolName, arguments?)` - Call a tool on a service from the active deck

### **Available MCP Resources**
- `agent-deck://decks` - List of all available decks
- `agent-deck://active-deck` - The currently active deck
- `agent-deck://active-deck/services` - Services in the currently active deck

### **Connecting MCP Clients**
1. **Configure MCP Client**: Set the MCP server URL to `http://localhost:3001/mcp`
2. **Establish Connection**: Connect using the MCP protocol
3. **Discover Tools**: Use `listTools()` to see available tools
4. **Call Tools**: Use `callTool()` to execute tools

## OAuth Status and Troubleshooting

### **OAuth Status**
- **Configured**: OAuth credentials are set up
- **Authorized**: OAuth tokens are valid and working
- **Expired**: OAuth tokens need to be refreshed
- **Error**: OAuth configuration or authorization failed

### **OAuth Troubleshooting**

#### **Common Issues**
1. **Invalid Credentials**: Verify client ID and secret are correct
2. **Wrong Redirect URI**: Ensure redirect URI matches exactly
3. **Expired Tokens**: Re-authorize to get new tokens
4. **Scope Issues**: Check that required scopes are included

#### **Provider-Specific Setup**

**GitHub OAuth Setup**
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:8000/api/oauth/callback`
4. Copy Client ID and Client Secret to Agent Deck

**Notion OAuth Setup**
1. Go to Notion Integrations page
2. Create a new integration
3. Set Redirect URI to: `http://localhost:8000/api/oauth/callback`
4. Copy Client ID and Client Secret to Agent Deck

## Real-time Features

### **Live Updates**
- **Service Health**: Health status updates automatically
- **Deck Changes**: Deck modifications are reflected immediately
- **Service Additions**: New services appear in real-time
- **Connection Status**: WebSocket connection status is shown

### **WebSocket Connection**
- **Connected**: Real-time updates are working
- **Disconnected**: Updates may be delayed
- **Reconnecting**: System is attempting to reconnect
- **Error**: Connection issues detected

## User Interface Features

### **Cyberpunk Theme**
- **Dark Mode**: Beautiful dark interface with glowing effects
- **Colorful Cards**: Each service has its own color theme
- **Smooth Animations**: Fluid transitions and hover effects
- **Modern Design**: Clean, professional interface

### **Responsive Design**
- **Desktop**: Full-featured interface with all capabilities
- **Tablet**: Optimized layout for medium screens
- **Mobile**: Simplified interface for small screens

### **Accessibility**
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Compatible with screen readers
- **High Contrast**: Clear visual hierarchy
- **Focus Indicators**: Clear focus states for navigation

## Troubleshooting

### **Common Issues**

#### **Service Won't Connect**
1. **Check URL**: Verify the service URL is correct
2. **Check Network**: Ensure the service is accessible
3. **Check OAuth**: Verify OAuth is configured correctly
4. **Check Logs**: Look for error messages in the browser console

#### **MCP Server Issues**
1. **Check Backend**: Ensure the backend API is running
2. **Check Ports**: Verify ports 8000 and 3001 are available
3. **Check Connection**: Test MCP server connectivity
4. **Check Logs**: Review server logs for errors

#### **OAuth Issues**
1. **Check Credentials**: Verify client ID and secret
2. **Check Redirect URI**: Ensure it matches exactly
3. **Check Scopes**: Verify required scopes are included
4. **Re-authorize**: Try the OAuth flow again

#### **Real-time Updates Not Working**
1. **Check WebSocket**: Verify WebSocket connection
2. **Check Network**: Ensure network connectivity
3. **Refresh Page**: Try refreshing the browser
4. **Check Logs**: Look for WebSocket errors

### **Getting Help**
1. **Check Documentation**: Review this user guide
2. **Check Logs**: Look at browser console and server logs
3. **Restart Services**: Try restarting the application
4. **Report Issues**: Create an issue with detailed information

## Best Practices

### **Service Management**
- **Use Descriptive Names**: Choose clear, descriptive names for services
- **Organize by Purpose**: Group related services together
- **Regular Health Checks**: Monitor service health regularly
- **Keep Credentials Secure**: Store OAuth credentials securely

### **Deck Building**
- **Logical Grouping**: Group related services in decks
- **Limit Deck Size**: Keep decks manageable (5-10 services)
- **Test Decks**: Verify all services in a deck work together
- **Document Decks**: Add descriptions to explain deck purpose

### **OAuth Management**
- **Use Secure Credentials**: Keep OAuth credentials secure
- **Regular Re-authorization**: Re-authorize when tokens expire
- **Monitor Access**: Check OAuth app permissions regularly
- **Backup Configuration**: Keep OAuth configuration backed up

### **Performance**
- **Limit Active Services**: Don't overload the system with too many services
- **Monitor Resources**: Watch for performance issues
- **Regular Maintenance**: Clean up unused services and decks
- **Update Regularly**: Keep the application updated

## Next Steps

### **Advanced Usage**
1. **Service Templates**: Create reusable service configurations
2. **Automated Workflows**: Set up automated service management
3. **Integration Scripts**: Create scripts for bulk operations
4. **Custom Themes**: Customize the interface appearance

### **Integration**
1. **MCP Clients**: Connect various MCP clients
2. **External Tools**: Integrate with external tools and services
3. **APIs**: Use the REST API for automation
4. **Webhooks**: Set up webhooks for external integrations

### **Customization**
1. **Service Colors**: Customize service card colors
2. **Deck Organization**: Organize decks by project or purpose
3. **OAuth Providers**: Add support for additional OAuth providers
4. **Service Types**: Add support for new service types

This user guide covers all the essential features and functionality of Agent Deck. The interface is designed to be intuitive and user-friendly while providing powerful capabilities for managing MCP services and building service decks.
