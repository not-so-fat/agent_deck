#!/usr/bin/env python3
"""
Agent Deck MCP Server - Python implementation using new TypeScript backend APIs
"""

import requests
import json
import asyncio
import threading
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from fastmcp import FastMCP, Client
from typing import Dict, Any, Optional, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
BACKEND_BASE_URL = "http://localhost:8000"
API_TIMEOUT = 10

class AgentDeckAPIClient:
    """Client for interacting with the Agent Deck TypeScript backend APIs"""
    
    def __init__(self, base_url: str = BACKEND_BASE_URL):
        self.base_url = base_url.rstrip('/')
    
    def _make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make HTTP request to the backend API"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=API_TIMEOUT)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=API_TIMEOUT)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=API_TIMEOUT)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=API_TIMEOUT)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            result = response.json()
            
            # Handle new API response format
            if not result.get('success', False):
                error_msg = result.get('error', 'Unknown API error')
                raise Exception(f"API Error: {error_msg}")
            
            return result.get('data')
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise Exception(f"Failed to communicate with backend: {str(e)}")
    
    def get_active_deck(self) -> Optional[Dict]:
        """Get the currently active deck"""
        try:
            return self._make_request('GET', '/api/decks/active')
        except Exception as e:
            logger.error(f"Error getting active deck: {e}")
            return None
    
    def get_all_services(self) -> List[Dict]:
        """Get all services"""
        try:
            return self._make_request('GET', '/api/services')
        except Exception as e:
            logger.error(f"Error getting services: {e}")
            return []
    
    def get_service(self, service_id: str) -> Optional[Dict]:
        """Get a specific service by ID"""
        try:
            return self._make_request('GET', f'/api/services/{service_id}')
        except Exception as e:
            logger.error(f"Error getting service {service_id}: {e}")
            return None
    
    def call_service_tool(self, service_id: str, tool_name: str, arguments: Dict) -> Any:
        """Call a tool on a service"""
        try:
            data = {
                'toolName': tool_name,
                'arguments': arguments
            }
            return self._make_request('POST', f'/api/services/{service_id}/call', data)
        except Exception as e:
            logger.error(f"Error calling service tool: {e}")
            raise

# Initialize API client
api_client = AgentDeckAPIClient()

def get_active_deck_services() -> List[Dict]:
    """Get services for the currently active deck only"""
    active_deck = api_client.get_active_deck()
    if not active_deck:
        return []
    
    # The new API returns services directly in the deck object
    deck_services = []
    for service in active_deck.get("services", []):
        deck_services.append({
            "service_id": service["id"],
            **service
        })
    
    return deck_services

# Create the FastMCP app
app = FastMCP(
    name="AgentDeck Active Deck MCP Service",
    instructions="An MCP service that provides access to tools from the currently active deck's services only. Deck management should be done through the web UI."
)

async def call_mcp_service_async(service_endpoint: str, tool_name: str, kwargs: Dict[str, Any], custom_headers: Optional[Dict[str, str]] = None) -> str:
    """Call an MCP service using MCPClientManager."""
    try:
        # For now, we'll use a simplified approach
        # In a full implementation, you'd want to use the MCP client from the TypeScript backend
        headers = {
            'Content-Type': 'application/json',
            **(custom_headers or {})
        }
        
        # Try to call the MCP service directly
        # The service_endpoint should already be the full MCP endpoint
        response = requests.post(
            service_endpoint,
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": tool_name,
                "params": kwargs
            },
            timeout=API_TIMEOUT
        )
        response.raise_for_status()
        
        result = response.json()
        if 'error' in result:
            raise ValueError(f'MCP service returned error: {result["error"]}')
        
        return json.dumps(result.get('result', result))
        
    except Exception as e:
        raise ValueError(f'Failed to call MCP service: {str(e)}')

def call_mcp_service_sync(service_endpoint: str, tool_name: str, kwargs: Dict[str, Any], custom_headers: Optional[Dict[str, str]] = None) -> str:
    """Synchronous wrapper for calling MCP service using threading."""
    def run_async():
        return asyncio.run(call_mcp_service_async(service_endpoint, tool_name, kwargs, custom_headers))
    
    with ThreadPoolExecutor() as executor:
        future = executor.submit(run_async)
        return future.result()

def _call_service_internal(service_id: str, tool_name: str, arguments: str) -> str:
    """
    Internal function to call a service from the active deck (not a FastMCP tool).
    This can be called by other FastMCP tools.
    """
    active_services = get_active_deck_services()
    service = None
    for s in active_services:
        if s["service_id"] == service_id:
            service = s
            break
    
    if not service:
        raise ValueError('Service not found in active deck')
    
    service_endpoint = service['url']
    service_api_key = service.get('apiKey')  # Note: changed from api_key to apiKey
    
    # Parse the arguments JSON string
    try:
        kwargs = json.loads(arguments) if arguments else {}
    except json.JSONDecodeError:
        raise ValueError('Invalid JSON in arguments')
    
    # Handle different service types
    if service['type'] == 'mcp':
        # For MCP services, use direct MCP client call
        try:
            # Get custom headers from service registration
            custom_headers = service.get('headers', {})
            logger.info(f"Using custom headers for {service['name']}: {custom_headers}")
            
            result = call_mcp_service_sync(service_endpoint, tool_name, kwargs, custom_headers)
            logger.info(f"Called {tool_name} on {service['name']} (Type: {service['type']})")
            return result
        except Exception as e:
            raise ValueError(f'Failed to call MCP service: {str(e)}')
    else:
        # For A2A services, use the existing logic (unchanged)
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {service_api_key}' if service_api_key else ''
        }
        
        # Step 1: Fetch the agent card from the registered URL
        try:
            agent_card_response = requests.get(service_endpoint, timeout=API_TIMEOUT)
            agent_card_response.raise_for_status()
            agent_card = agent_card_response.json()
            logger.info(f"Successfully fetched agent card from: {service_endpoint}")
        except Exception as e:
            raise ValueError(f'Failed to fetch agent card from {service_endpoint}: {e}')
        
        # Step 2: Extract the communication endpoint from the agent card
        communication_endpoint = agent_card.get('url')
        if not communication_endpoint:
            raise ValueError(f'Agent card does not specify a communication endpoint. Agent card: {agent_card}')
        
        # Step 3: Confirm the service is an A2A agent by checking the endpoint
        try:
            agent_response = requests.get(communication_endpoint, timeout=API_TIMEOUT)
            agent_response.raise_for_status()
            agent_info = agent_response.json()
            
            # Check if it's an A2A agent by looking for available_tools
            if 'available_tools' in agent_info:
                logger.info(f"Confirmed A2A agent with available tools: {agent_info['available_tools']}")
            else:
                logger.warning(f"Warning: Service at {communication_endpoint} does not appear to be an A2A agent")
                
        except Exception as e:
            logger.warning(f"Warning: Could not confirm A2A agent status: {e}")
        
        # Step 4: Get agent information
        agent_name = agent_card.get('name', 'Unknown A2A Agent')
        skills = agent_card.get('skills', [])
        preferred_transport = agent_card.get('preferredTransport', 'JSONRPC')
        
        logger.info(f"A2A Agent: {agent_name}")
        logger.info(f"Communication endpoint: {communication_endpoint}")
        logger.info(f"Preferred transport: {preferred_transport}")
        logger.info(f"Available skills: {[skill['id'] for skill in skills]}")
        
        # Step 5: Find the appropriate skill for the tool being called
        target_skill = None
        for skill in skills:
            if skill['id'] == tool_name or skill['name'].lower().replace(' ', '-') == tool_name:
                target_skill = skill
                break
        
        if target_skill:
            logger.info(f"Found matching skill: {target_skill['id']}")
        else:
            logger.info(f"No specific skill found for tool '{tool_name}', using general communication endpoint")
        
        # Step 6: Prepare JSON-RPC request according to A2A protocol
        jsonrpc_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": tool_name,
            "params": kwargs
        }
        
        logger.info(f"Sending JSON-RPC request to: {communication_endpoint}")
        logger.info(f"JSON-RPC method: {tool_name}")
        logger.info(f"JSON-RPC params: {kwargs}")
        
        try:
            response = requests.post(
                url=communication_endpoint,
                headers=headers,
                json=jsonrpc_request,
                timeout=API_TIMEOUT
            )
            response.raise_for_status()
            
            # Parse JSON-RPC response
            jsonrpc_response = response.json()
            
            if 'error' in jsonrpc_response:
                raise ValueError(f'A2A agent returned error: {jsonrpc_response["error"]}')
            
            result = jsonrpc_response.get('result', jsonrpc_response)
            logger.info(f"Called {tool_name} on {service['name']} (Type: {service['type']})")
            return json.dumps(result) if isinstance(result, dict) else str(result)
            
        except requests.exceptions.RequestException as e:
            # Fallback: Try direct REST endpoints for non-standard A2A implementations
            logger.info(f"JSON-RPC failed, trying REST fallback: {e}")
            
            # Try common REST endpoints
            rest_endpoints = [
                f"{communication_endpoint}/analyze",
                f"{communication_endpoint}/tool/process",
                f"{communication_endpoint}/{tool_name}"
            ]
            
            for endpoint in rest_endpoints:
                try:
                    logger.info(f"Trying REST endpoint: {endpoint}")
                    response = requests.post(
                        url=endpoint,
                        headers=headers,
                        json=kwargs,
                        timeout=API_TIMEOUT
                    )
                    response.raise_for_status()
                    
                    result = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                    logger.info(f"Called {tool_name} on {service['name']} via REST fallback")
                    return json.dumps(result) if isinstance(result, dict) else str(result)
                    
                except Exception as rest_error:
                    logger.info(f"REST endpoint {endpoint} failed: {rest_error}")
                    continue
            
            # If all fallbacks fail, raise the original error
            raise ValueError(f'Failed to call A2A service: {str(e)}')

@app.tool()
def call_service(service_id: str, tool_name: str, arguments: str) -> str:
    """
    Calls a tool on a service from the currently active deck.
    
    Args:
        service_id: The ID of the service in the active deck
        tool_name: Name of the tool to call
        arguments: JSON string of arguments to pass to the tool
    
    Returns:
        Response from the service
    """
    return _call_service_internal(service_id, tool_name, arguments)

@app.tool()
def get_active_deck_info() -> str:
    """
    Gets information about the currently active deck and its services.
    
    Returns:
        JSON string with active deck information and its services
    """
    active_deck = api_client.get_active_deck()
    if not active_deck:
        return json.dumps({
            "active_deck": None,
            "message": "No active deck found. Please activate a deck via the web UI."
        }, indent=2)
    
    deck_services = get_active_deck_services()
    
    return json.dumps({
        "active_deck": {
            "id": active_deck["id"],
            "name": active_deck["name"],
            "description": active_deck["description"],
            "services": deck_services
        }
    }, indent=2)

@app.tool()
def list_active_deck_services() -> str:
    """
    Lists all services in the currently active deck.
    
    Returns:
        JSON string with list of services in the active deck
    """
    active_deck = api_client.get_active_deck()
    if not active_deck:
        return json.dumps({
            "services": [],
            "message": "No active deck found. Please activate a deck via the web UI."
        }, indent=2)
    
    deck_services = get_active_deck_services()
    service_list = []
    for service in deck_services:
        service_list.append({
            'service_id': service['service_id'],
            'name': service['name'],
            'type': service['type'],
            'url': service['url']
        })
    
    return json.dumps({
        'services': service_list,
        'deck_name': active_deck['name']
    }, indent=2)

@app.tool()
def list_service_tools(service_id: str) -> str:
    """
    Lists all available tools for a specific service in the active deck.
    
    Args:
        service_id: The ID of the service in the active deck
    
    Returns:
        JSON string with list of tools available on the service
    """
    logger.info(f"Listing tools for service ID: {service_id}")
    
    active_services = get_active_deck_services()
    logger.info(f"Found {len(active_services)} services in active deck")
    
    service = None
    for s in active_services:
        logger.info(f"Checking service: {s['service_id']} - {s['name']}")
        if s["service_id"] == service_id:
            service = s
            break
    
    if not service:
        logger.error(f"Service with ID '{service_id}' not found in active deck")
        return json.dumps({
            "error": f"Service with ID '{service_id}' not found in active deck"
        }, indent=2)
    
    logger.info(f"Found service: {service['name']} (type: {service['type']})")
    
    if service['type'] != 'mcp':
        logger.error(f"Service '{service['name']}' is not an MCP service (type: {service['type']})")
        return json.dumps({
            "error": f"Service '{service['name']}' is not an MCP service (type: {service['type']})"
        }, indent=2)
    
    try:
        logger.info(f"Calling backend API to discover tools for service {service_id}")
        # Use the backend API to discover tools
        tools = api_client._make_request('GET', f'/api/services/{service_id}/tools')
        logger.info(f"Successfully discovered {len(tools)} tools")
        
        return json.dumps({
            "service_id": service_id,
            "service_name": service['name'],
            "service_url": service['url'],
            "tools": tools
        }, indent=2)
        
    except Exception as e:
        logger.error(f"Failed to discover tools for service '{service['name']}': {str(e)}")
        return json.dumps({
            "error": f"Failed to discover tools for service '{service['name']}': {str(e)}"
        }, indent=2)

if __name__ == '__main__':
    print("🚀 Starting AgentDeck Active Deck MCP Service (HTTP)...")
    print("📡 Available MCP tools:")
    print("   - call_service(service_id, tool_name, arguments)")
    print("   - get_active_deck_info()")
    print("   - list_active_deck_services()")
    print("   - list_service_tools(service_id)")
    print("\n📋 Note: This MCP service only provides access to the currently active deck's services.")
    print("🎛️  Deck management should be done through the web UI.")
    print(f"🌐 MCP service will be available at: http://localhost:3001/mcp")
    print(f"🔗 Backend API: {BACKEND_BASE_URL}")
    
    # Run the FastMCP server with HTTP transport
    app.run(transport="http", host="0.0.0.0", port=3001)
