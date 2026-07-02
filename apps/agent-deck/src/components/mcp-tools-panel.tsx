import { Fragment, useEffect, useMemo, useState } from "react";
import { ServiceTool } from "@agent-deck/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, Search, Wrench } from "lucide-react";

interface McpToolsPanelProps {
  serviceId: string;
  tools: ServiceTool[];
  isLoading?: boolean;
}

function disabledToolsFromServer(tools: ServiceTool[]): Set<string> {
  return new Set(tools.filter((tool) => tool.enabled === false).map((tool) => tool.name));
}

export default function McpToolsPanel({ serviceId, tools, isLoading }: McpToolsPanelProps) {
  const [search, setSearch] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [disabledTools, setDisabledTools] = useState<Set<string>>(() => disabledToolsFromServer(tools));

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const serverDisabledKey = useMemo(
    () =>
      tools
        .map((tool) => `${tool.name}:${tool.enabled === false ? "0" : "1"}`)
        .sort()
        .join("\0"),
    [tools],
  );

  useEffect(() => {
    setDisabledTools(disabledToolsFromServer(tools));
  }, [serviceId, serverDisabledKey]);

  const saveMutation = useMutation({
    mutationFn: async (nextDisabled: string[]) => {
      await apiRequest("PUT", `/api/services/${serviceId}/tool-settings`, {
        disabledTools: nextDisabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId, "tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save tool settings",
        description: error.message,
        variant: "destructive",
      });
      setDisabledTools(disabledToolsFromServer(tools));
    },
  });

  const persistDisabled = (next: Set<string>) => {
    setDisabledTools(next);
    saveMutation.mutate([...next]);
  };

  const toggleTool = (toolName: string, enabled: boolean) => {
    const next = new Set(disabledTools);
    if (enabled) {
      next.delete(toolName);
    } else {
      next.add(toolName);
    }
    persistDisabled(next);
  };

  const setAllEnabled = (enabled: boolean) => {
    if (enabled) {
      persistDisabled(new Set());
      return;
    }
    persistDisabled(new Set(tools.map((tool) => tool.name)));
  };

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return tools;
    }
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query),
    );
  }, [tools, search]);

  const enabledCount = tools.length - disabledTools.size;

  if (isLoading) {
    return (
      <div className="bg-black/20 rounded-lg p-4 border border-white/10">
        <p className="text-sm text-gray-400">Loading tools…</p>
      </div>
    );
  }

  if (tools.length === 0) {
    return null;
  }

  return (
    <div className="bg-black/20 rounded-lg p-4 border border-white/10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          <Wrench className="w-5 h-5 mr-2" />
          Tools
          <span className="ml-2 text-sm font-normal text-gray-400">
            {enabledCount} of {tools.length} enabled
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-[#A8C4C0] hover:text-white hover:bg-white/10"
            onClick={() => setAllEnabled(true)}
            disabled={disabledTools.size === 0 || saveMutation.isPending}
          >
            Enable all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-[#A8C4C0] hover:text-white hover:bg-white/10"
            onClick={() => setAllEnabled(false)}
            disabled={enabledCount === 0 || saveMutation.isPending}
          >
            Disable all
          </Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-[#A8C4C0]">
        Choose which tools your agent can use from this MCP. Disabled tools are hidden from the agent but stay registered on the server.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tools…"
          className="border-white/15 bg-[#0F0F0C] pl-9 text-[#E8F6F4] placeholder:text-[#6B8581]"
        />
      </div>

      <div className="rounded-md border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-[72px] text-center text-[#A8C4C0]">Enabled</TableHead>
              <TableHead className="w-[220px] text-[#A8C4C0]">Tool</TableHead>
              <TableHead className="text-[#A8C4C0]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTools.length === 0 ? (
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableCell colSpan={3} className="py-8 text-center text-sm text-gray-400">
                  No tools match your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredTools.map((tool) => {
                const isEnabled = !disabledTools.has(tool.name);
                const isExpanded = expandedTool === tool.name;
                const hasSchema =
                  tool.inputSchema && Object.keys(tool.inputSchema).length > 0;

                return (
                  <Fragment key={tool.name}>
                    <TableRow
                      className={`border-white/10 ${isEnabled ? "hover:bg-white/5" : "opacity-60 hover:bg-white/5"}`}
                    >
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              toggleTool(tool.name, checked === true)
                            }
                            disabled={saveMutation.isPending}
                            aria-label={`${isEnabled ? "Disable" : "Enable"} ${tool.name}`}
                            className="h-[18px] w-[18px] border-white/40 bg-[#0F0F0C] data-[state=checked]:border-[#92E4DD] data-[state=checked]:bg-[#92E4DD] data-[state=checked]:text-[#0F0F0C]"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasSchema ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTool(isExpanded ? null : tool.name)
                            }
                            className="flex w-full items-center gap-1 text-left font-mono text-sm text-[#92E4DD] hover:text-white"
                          >
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                            {tool.name}
                          </button>
                        ) : (
                          <span className="font-mono text-sm text-[#92E4DD]">{tool.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-300">
                        {tool.description || "—"}
                      </TableCell>
                    </TableRow>
                    {hasSchema && isExpanded && (
                      <TableRow className="border-white/10 bg-black/30 hover:bg-black/30">
                        <TableCell colSpan={3} className="py-3">
                          <pre className="max-h-48 overflow-auto rounded border border-white/10 bg-[#0F0F0C] p-3 text-xs text-gray-300">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
