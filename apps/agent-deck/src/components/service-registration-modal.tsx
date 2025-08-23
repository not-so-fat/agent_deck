import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Bot, X, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateServiceSchema, Service } from "@agent-deck/shared";

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
  const [formData, setFormData] = useState({
    name: "",
    type: type, // Add type to form data
    url: type === 'mcp' ? "http://localhost:8000/mcp" : "",
    manifest_url: type === 'a2a' ? "http://localhost:8001/.well-known/a2a/manifest.json" : "",
    description: "",
    // Headers configuration fields
    headers_enabled: false,
    headers: {},
    // Color selection
    cardColor: "#7ed4da", // Default color
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const registerServiceMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const serviceData = {
        name: data.name,
        type: type, // Explicitly use the type prop
        url: type === 'mcp' ? data.url : data.manifest_url,
        description: data.description,
        cardColor: data.cardColor, // Include custom card color
        // Include headers configuration if enabled
        ...(data.headers_enabled && {
          headers: data.headers,
        }),
      };

      // Debug: Log what we're sending
      console.log('Sending service data:', serviceData);
      console.log('Form data:', data);
      console.log('Type:', type);

      // Send directly to backend API (bypass schema validation)
      return apiRequest('POST', '/api/services', serviceData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({
        title: `${type.toUpperCase()} service registered`,
        description: `${formData.name} has been successfully registered.`,
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
    registerServiceMutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({
      name: "",
      type: type,
      url: type === 'mcp' ? "http://localhost:8000/mcp" : "",
      manifest_url: type === 'a2a' ? "http://localhost:8001/.well-known/a2a/manifest.json" : "",
      description: "",
      // Reset headers configuration
      headers_enabled: false,
      headers: {},
      // Reset color selection
      cardColor: "#7ed4da",
    });
    onOpenChange(false);
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        
        <form onSubmit={handleSubmit} className="space-y-4 pb-6" data-testid="form-service-registration">
          <div>
            <Label htmlFor="name" className="text-sm font-semibold" style={{color: '#92E4DD'}}>
              {type === 'mcp' ? 'Server' : 'Agent'} Name
            </Label>
            <Input
              id="name"
              placeholder={type === 'mcp' ? "e.g., Database Tools" : "e.g., Code Assistant"}
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder-gray-400"
              required
              data-testid="input-service-name"
            />
          </div>
          
          {type === 'mcp' ? (
            <div>
              <Label htmlFor="url" className="text-sm font-semibold" style={{color: '#92E4DD'}}>MCP URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="http://localhost:8080/mcp or https://mcp.notion.com/mcp"
                value={formData.url}
                onChange={(e) => updateFormData('url', e.target.value)}
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
          ) : (
            <div>
              <Label htmlFor="manifest_url" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Manifest URL</Label>
              <Input
                id="manifest_url"
                type="url"
                placeholder="http://localhost:8001/.well-known/a2a/manifest.json"
                value={formData.manifest_url}
                onChange={(e) => updateFormData('manifest_url', e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                required
                data-testid="input-manifest-url"
              />
            </div>
          )}
          
          <div>
            <Label htmlFor="description" className="text-sm font-semibold" style={{color: '#92E4DD'}}>Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of capabilities..."
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              rows={3}
              className="bg-white/10 border-white/20 text-white placeholder-gray-400 resize-none"
              data-testid="textarea-description"
            />
          </div>

          {/* Color Selection */}
          <div>
            <Label className="text-sm font-semibold" style={{color: '#92E4DD'}}>Card Color</Label>
            <div className="flex gap-2 mt-2">
              {[
                { color: "#7ed4da", name: "Default" },
                { color: "#F9386D", name: "Pink" },
                { color: "#39FF14", name: "Green" },
                { color: "#E0E0E0", name: "Light Gray" },
                { color: "#FF6B00", name: "Orange" },
              ].map((colorOption) => (
                <button
                  key={colorOption.color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.cardColor === colorOption.color 
                      ? 'border-white scale-110' 
                      : 'border-gray-400 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  onClick={() => updateFormData('cardColor', colorOption.color)}
                  title={colorOption.name}
                  data-testid={`color-option-${colorOption.color}`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Choose a color for your service card</p>
          </div>

          {/* Headers Configuration Section - Only for MCP services */}
          {type === 'mcp' && (
            <div className="space-y-4 border border-white/10 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="headers_enabled"
                  checked={formData.headers_enabled}
                  onChange={(e) => updateFormData('headers_enabled', e.target.checked)}
                  className="rounded border-white/20 bg-white/10"
                />
                <Label htmlFor="headers_enabled" className="text-sm font-semibold" style={{color: '#92E4DD'}}>
                  🔐 Authentication Required
                </Label>
              </div>
              <div className="text-xs text-gray-400">
                <p>Enable this if your MCP server requires authentication (API keys, tokens, etc.).</p>
              </div>
              
              {formData.headers_enabled && (
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
                      value={JSON.stringify(formData.headers, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsedHeaders = JSON.parse(e.target.value);
                          updateFormData('headers', parsedHeaders);
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
              type="submit" 
              className="flex-1 border"
              style={{
                background: 'linear-gradient(135deg, #C4B643, #D4C760)',
                borderColor: '#C4B643',
                color: '#0A0A07'
              }}
              disabled={registerServiceMutation.isPending}
              data-testid="button-register"
            >
              <Plus className="w-4 h-4 mr-2" style={{color: '#0A0A07'}} />
              {registerServiceMutation.isPending ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
