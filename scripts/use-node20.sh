#!/bin/bash

# Script to switch to Node.js 20 for Agent Deck development
# This is a temporary workaround until the project supports Node.js 24

echo "Switching to Node.js 20 for Agent Deck development..."

# Check if Node 20 is available via Homebrew
if [ -d "/opt/homebrew/opt/node@20" ]; then
    export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    echo "✅ Using Homebrew Node.js 20"
elif [ -d "/usr/local/opt/node@20" ]; then
    export PATH="/usr/local/opt/node@20/bin:$PATH"
    echo "✅ Using Homebrew Node.js 20 (Intel Mac)"
else
    echo "❌ Node.js 20 not found. Please install with: brew install node@20"
    exit 1
fi

# Verify Node version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "turbo.json" ]; then
    echo "❌ Please run this script from the Agent Deck project root directory"
    exit 1
fi

echo "✅ Ready to work with Node.js 20"
echo ""
echo "You can now run:"
echo "  npm install    # Install dependencies"
echo "  npm run build  # Build all packages"
echo "  npm test       # Run tests"
echo "  npm run dev    # Start development servers"
echo ""
echo "Note: This script only affects the current terminal session."
echo "To make it permanent, add the export PATH line to your shell profile."
