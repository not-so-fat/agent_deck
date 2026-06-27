import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { App as McpHostBridge } from "@modelcontextprotocol/ext-apps";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/home";
import "./index.css";

// MCP Apps run in a sandbox without a normal browser URL, so wouter never matches "/"
// and falls through to NotFound. Render the dashboard Home view directly.
const bridge = new McpHostBridge({ name: "Agent Deck", version: "1.0.0" });
void bridge.connect();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Home />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
