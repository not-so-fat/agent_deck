import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, Bot, X, Plus, Terminal } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Service } from "@agent-deck/shared";

interface ServiceRegistrationModalProps {
  type: Service['type'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ServiceRegistrationModal({ 
  type, 
  open, 
  onOpenChange 
}: ServiceRegistrationModalProps) {
  // Tab state for MCP registration
  const [activeTab, setActiveTab] = useState<'remote' | 'local'>('remote');
  
  // Remote MCP form data
  const [remoteFormData, setRemoteFormData] = useState({
    name: "",
    type: 'mcp' as const,
    url: "http://localhost:8000/mcp",
    description: "",
    headers_enabled: false,
    headers: {},
    cardColor: "#7ed4da",
  });

  // Local MCP form data
  const [localFormData, setLocalFormData] = useState({
    name: "",
    type: 'local-mcp' as const,
    command: "",
    args: [""],
    env: {} as Record<string, string>,
    description: "",
    cardColor: "#39FF14", // Green for local MCP
  });

  // A2A form data
  const [a2aFormData, setA2aFormData] = useState({
    name: "",
    type: 'a2a' as const,
    manifest_url: "http://localhost:8001/.well-known/a2a/manifest.json",
    description: "",
    cardColor: "#7ed4da",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const registerServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      if (type === 'mcp' && activeTab === 'local') {
        // Local MCP server registration
        const config = {
          mcpServers: {
            [data.name]: {
              command: data.command,
              args: data.args.filter((arg: string) => arg.trim() !== ''),
              ...(Object.keys(data.env).length > 0 && { env: data.env })
            }
          }
        };

        console.log('Importing local MCP server:', config);
        return apiRequest('POST', '/api/local-mcp/import', { config: JSON.stringify(config) });
      } else {
        // Remote MCP or A2A service registration
        const serviceData = {
          name: data.name,
          type: type,
          url: type === 'mcp' ? data.url : data.manifest_url,
          description: data.description,
          cardColor: data.cardColor,
          ...(data.headers_enabled && {
            headers: data.headers,
          }),
        };

        console.log('Sending service data:', serviceData);
        return apiRequest('POST', '/api/services', serviceData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      const currentFormData = type === 'mcp' ? 
        (activeTab === 'remote' ? remoteFormData : localFormData) : 
        a2aFormData;
      toast({
        title: `${type.toUpperCase()} service registered`,
        description: `${currentFormData.name} has been successfully registered.`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to register service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentFormData = type === 'mcp' ? 
      (activeTab === 'remote' ? remoteFormData : localFormData) : 
      a2aFormData;
    registerServiceMutation.mutate(currentFormData);
  };

  const handleClose = () => {
    // Reset remote MCP form
    setRemoteFormData({
      name: "",
      type: 'mcp' as const,
      url: "http://localhost:8000/mcp",
      description: "",
      headers_enabled: false,
      headers: {},
      cardColor: "#7ed4da",
    });

    // Reset local MCP form
    setLocalFormData({
      name: "",
      type: 'local-mcp' as const,
      command: "",
      args: [""],
      env: {},
      description: "",
      cardColor: "#39FF14",
    });

    // Reset A2A form
    setA2aFormData({
      name: "",
      type: 'a2a' as const,
      manifest_url: "http://localhost:8001/.well-known/a2a/manifest.json",
      description: "",
      cardColor: "#7ed4da",
    });

    // Reset tab state
    setActiveTab('remote');
    onOpenChange(false);
  };

  const updateRemoteFormData = (field: string, value: string | boolean) => {
    setRemoteFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateLocalFormData = (field: string, value: any) => {
    setLocalFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateA2aFormData = (field: string, value: string) => {
    setA2aFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center" style={{background: 'linear-gradient(to right, #C4B643, #D4C760)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
            {type === 'mcp' ? (
              <Server className="w-6 h-6 mr-3" style={{color: '#92E4DD'}} />
            ) : (
              <Bot className="w-6 h-6 mr-3" style={{color: '#92E4DD'}} />
            )}
            Register {type === 'mcp' ? 'MCP Server' : 'A2A Agent'}
          </DialogTitle>
          <DialogDescription className="mt-2" style={{color: '#92E4DD', opacity: 0.8}}>
            {type === 'mcp' ? 
              'Add a new Model Context Protocol (MCP) server to your service deck. Configure the server URL and provide details for registration.' :
              'Register a new A2A agent with your service deck. Provide the agent manifest and configuration details.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {type === 'mcp' ? (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'remote' | 'local')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/10 border border-white/20">
              <TabsTrigger 
                value="remote" 
                className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-gray-400"
              >
                <Server className="w-4 h-4 mr-2" />
                Remote MCP
              </TabsTrigger>
              <TabsTrigger 
                value="local" 
                className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-gray-400"
              >
                <Terminal className="w-4 h-4 mr-2" />
                Local MCP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="remote" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name" className="text-sm font-semibold" style={{color: '#92E4DD'}}>
                  Server Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Database Tools"
                  value={remoteFormData.name}
                  onChange={(e) => updateRemoteFormData('name', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  required
                  data-testid="input-service-name"
                />
              </div>
              
              <div>
                <Label htmlFor="url" className="text-sm font-semibold" style={{color: '#92E4DD'}}>MCP URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="http://localhost:8080/mcp or https://mcp.notion.com/mcp"
                  value={remoteFormData.url}
                  onChange={(e) => updateRemoteFormData('url', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  required
                  data-testid="input-mcp-url"
                />
                <div className="mt-1 text-xs text-gray-400">
                    <p>Supported formats:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>HTTP MCP: <code>http://localhost:8080/mcp</code></li>
                        <li>SSE MCP: <code>https://be.omnimcp.ai/api/v1/mcp/.../sse</code></li>
                        <li>Notion MCP: <code>https://mcp.notion.com/mcp</code></li>
                    </ul>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of capabilities..."
                  value={remoteFormData.description}
                  onChange={(e) => updateRemoteFormData('description', e.target.value)}
                  rows={3}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400 resize-none"
                  data-testid="textarea-description"
                />
              </div>
            </TabsContent>

            <TabsContent value="local" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="local-name" className="text-sm font-semibold" style={{color: '#92E4DD'}}>
                  Server Name
                </Label>
                <Input
                  id="local-name"
                  placeholder="e.g., Memory Server"
                  value={localFormData.name}
                  onChange={(e) => updateLocalFormData('name', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  required
                  data-testid="input-local-service-name"
                />
              </div>
              
              <div>
                <Label htmlFor="command" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Command</Label>
                <Input
                  id="command"
                  placeholder="e.g., npx, python, node"
                  value={localFormData.command}
                  onChange={(e) => updateLocalFormData('command', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  required
                  data-testid="input-command"
                />
                <div className="mt-1 text-xs text-gray-400">
                  The command to execute (e.g., npx, python, node)
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-semibold" style={{color: '#92E4DD'}}>Arguments</Label>
                {localFormData.args.map((arg, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder={`Argument ${index + 1}`}
                      value={arg}
                      onChange={(e) => {
                        const newArgs = [...localFormData.args];
                        newArgs[index] = e.target.value;
                        updateLocalFormData('args', newArgs);
                      }}
                      className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                      data-testid={`input-arg-${index}`}
                    />
                    {index === localFormData.args.length - 1 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateLocalFormData('args', [...localFormData.args, ''])}
                        className="bg-white/20 hover:bg-white/30 text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                    {localFormData.args.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const newArgs = localFormData.args.filter((_, i) => i !== index);
                          updateLocalFormData('args', newArgs);
                        }}
                        className="bg-red-500/80 hover:bg-red-500 text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="mt-1 text-xs text-gray-400">
                  Command arguments (e.g., -y, @modelcontextprotocol/server-memory)
                </div>
              </div>
              
              <div>
                <Label htmlFor="local-description" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Description</Label>
                <Textarea
                  id="local-description"
                  placeholder="Brief description of capabilities..."
                  value={localFormData.description}
                  onChange={(e) => updateLocalFormData('description', e.target.value)}
                  rows={3}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400 resize-none"
                  data-testid="textarea-local-description"
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-semibold" style={{color: '#92E4DD'}}>
                Agent Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Code Assistant"
                value={a2aFormData.name}
                onChange={(e) => updateA2aFormData('name', e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                required
                data-testid="input-service-name"
              />
            </div>
            
            <div>
              <Label htmlFor="manifest_url" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Manifest URL</Label>
              <Input
                id="manifest_url"
                type="url"
                placeholder="http://localhost:8001/.well-known/a2a/manifest.json"
                value={a2aFormData.manifest_url}
                onChange={(e) => updateA2aFormData('manifest_url', e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                required
                data-testid="input-manifest-url"
              />
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of capabilities..."
                value={a2aFormData.description}
                onChange={(e) => updateA2aFormData('description', e.target.value)}
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400 resize-none"
                data-testid="textarea-description"
              />
            </div>
          </div>
        )}

        {/* Color Selection - Shared for all forms */}
        <div>
          <Label className="text-sm font-semibold" style={{color: '#92E4DD'}}>Card Color</Label>
          <div className="flex gap-2 mt-2">
            {[
              { color: "#7ed4da", name: "Default" },
              { color: "#F9386D", name: "Pink" },
              { color: "#39FF14", name: "Green" },
              { color: "#E0E0E0", name: "Light Gray" },
              { color: "#FF6B00", name: "Orange" },
            ].map((colorOption) => {
              const currentColor = type === 'mcp' ? 
                (activeTab === 'remote' ? remoteFormData.cardColor : localFormData.cardColor) : 
                a2aFormData.cardColor;
              
              return (
                <button
                  key={colorOption.color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    currentColor === colorOption.color 
                      ? 'border-white scale-110' 
                      : 'border-gray-400 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  onClick={() => {
                    if (type === 'mcp') {
                      if (activeTab === 'remote') {
                        updateRemoteFormData('cardColor', colorOption.color);
                      } else {
                        updateLocalFormData('cardColor', colorOption.color);
                      }
                    } else {
                      updateA2aFormData('cardColor', colorOption.color);
                    }
                  }}
                  title={colorOption.name}
                  data-testid={`color-option-${colorOption.color}`}
                />
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">Choose a color for your service card</p>
        </div>

        {/* Headers Configuration Section - Only for Remote MCP services */}
        {type === 'mcp' && activeTab === 'remote' && (
          <div className="space-y-4 border border-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="headers_enabled"
                checked={remoteFormData.headers_enabled}
                onChange={(e) => updateRemoteFormData('headers_enabled', e.target.checked)}
                className="rounded border-white/20 bg-white/10"
              />
              <Label htmlFor="headers_enabled" className="text-sm font-semibold" style={{color: '#92E4DD'}}>
                🔐 Authentication Required
              </Label>
            </div>
            <div className="text-xs text-gray-400">
              <p>Enable this if your MCP server requires authentication (API keys, tokens, etc.).</p>
            </div>
            
            {remoteFormData.headers_enabled && (
              <div className="space-y-3 pl-6">
                <div className="text-xs text-gray-400 mb-2">
                  <p>Configure HTTP headers for authentication. Common examples:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li><code>Authorization: Bearer YOUR_TOKEN</code> - For API tokens</li>
                    <li><code>X-API-Key: YOUR_API_KEY</code> - For API keys</li>
                    <li><code>X-Custom-Header: value</code> - For custom headers</li>
                  </ul>
                </div>
                <div>
                  <Label htmlFor="headers" className="text-sm font-semibold" style={{color: '#92E4DD'}}>HTTP Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    placeholder={`{
  "Authorization": "Bearer YOUR_TOKEN_HERE",
  "X-API-Key": "YOUR_API_KEY_HERE"
}`}
                    value={JSON.stringify(remoteFormData.headers, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsedHeaders = JSON.parse(e.target.value);
                        updateRemoteFormData('headers', parsedHeaders);
                      } catch (error) {
                        // Keep the raw string if JSON is invalid
                        console.warn('Invalid JSON in headers:', error);
                      }
                    }}
                    rows={6}
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400 resize-none font-mono text-xs"
                    data-testid="textarea-headers"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    <p>Enter headers as JSON. Keys are header names, values are header values.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button 
            type="button" 
            variant="secondary" 
            className="flex-1 border text-white"
            style={{
              background: '#ad095e',
              borderColor: '#ad095e'
            }}
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            className="flex-1 border"
            style={{
              background: 'linear-gradient(135deg, #C4B643, #D4C760)',
              borderColor: '#C4B643',
              color: '#0A0A07'
            }}
            disabled={registerServiceMutation.isPending}
            data-testid="button-register"
            onClick={handleSubmit}
          >
            <Plus className="w-4 h-4 mr-2" style={{color: '#0A0A07'}} />
            {registerServiceMutation.isPending ? 'Registering...' : 'Register'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
