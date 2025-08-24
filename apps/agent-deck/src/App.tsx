import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import OAuthCallback from "@/components/oauth-callback";
import McpTestPage from "@/pages/mcp-test";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/oauth/callback" component={OAuthCallback} />
      <Route path="/mcp-test" component={McpTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
