#!/usr/bin/env python3
"""
Test script for the Python MCP server
"""

import requests
import json

def test_mcp_server():
    """Test the MCP server endpoints"""
    
    print("🧪 Testing MCP Server...")
    
    # Step 1: Initialize the MCP connection
    init_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    }
    
    try:
        print("📡 Step 1: Initializing MCP connection...")
        response = requests.post(
            "http://localhost:3002/mcp",
            headers={"Content-Type": "application/json"},
            json=init_request,
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"❌ Initialize failed: {response.status_code}")
            print(response.text)
            return
            
        print("✅ Initialize successful")
        
        # Step 2: List tools
        list_tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list"
        }
        
        print("📡 Step 2: Listing tools...")
        response = requests.post(
            "http://localhost:3002/mcp",
            headers={"Content-Type": "application/json"},
            json=list_tools_request,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Tools listed successfully!")
            print(json.dumps(result, indent=2))
            
            # Step 3: Call list_service_tools
            service_id = "6d00cb90-bb82-4941-954e-61e41548b8e0"
            call_request = {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "list_service_tools",
                    "arguments": {
                        "service_id": service_id
                    }
                }
            }
            
            print(f"📡 Step 3: Calling list_service_tools for service: {service_id}")
            response = requests.post(
                "http://localhost:3002/mcp",
                headers={"Content-Type": "application/json"},
                json=call_request,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print("✅ list_service_tools successful!")
                print(json.dumps(result, indent=2))
            else:
                print(f"❌ list_service_tools failed: {response.status_code}")
                print(response.text)
        else:
            print(f"❌ List tools failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_mcp_server()
