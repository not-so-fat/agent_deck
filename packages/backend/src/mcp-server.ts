import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  AGENT_DECK_AGENT_CLIENT,
  AGENT_DECK_CLIENT_HEADER,
  REPO_DECK_MANIFEST_PATH,
  countDeckCards,
  formatDisplayLine,
} from '@agent-deck/shared';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  formatRepoDeckManifest,
  loadRepoDeckManifest,
  repoDeckManifestFilePath,
} from './scope/repo-deck';
import { getAgentDeckVersion } from './lib/version';
import {
  McpSessionBindingStore,
  resolveDeckBindingSource,
} from './mcp-session-binding';
import { upsertBindingForSession } from './scope/bindings-sidecar';

const agentClientHeaders = {
  [AGENT_DECK_CLIENT_HEADER]: AGENT_DECK_AGENT_CLIENT,
  Accept: 'application/json',
};

type McpSession = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

export class AgentDeckMCPServer {
  private port: number;
  private app: express.Application;
  private backendUrl: string;
  private sessions = new Map<string, McpSession>();
  /** Set only while registerTools/registerResources run for a new session server. */
  private mcpServerForRegistration: McpServer | undefined;
  /** Per-session workspace + optional deck override (see mcp-session-binding.ts). */
  private sessionBinding: McpSessionBindingStore;
  private activeSessionId: string | undefined;

  private get server(): McpServer {
    if (!this.mcpServerForRegistration) {
      throw new Error('Internal: MCP server not in registration context');
    }
    return this.mcpServerForRegistration;
  }

  constructor(port: number = 3001, backendUrl: string = 'http://localhost:8000') {
    this.port = port;
    this.backendUrl = backendUrl;

    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();

    this.sessionBinding = new McpSessionBindingStore({
      workspace: process.env.AGENT_DECK_WORKSPACE,
      deckId: process.env.AGENT_DECK_DECK_ID,
    });
  }

  private createMcpServer(): McpServer {
    this.mcpServerForRegistration = new McpServer({
      name: "agent-deck-server",
      version: getAgentDeckVersion(),
    });
    this.setupTools();
    this.setupResources();
    const server = this.mcpServerForRegistration;
    this.mcpServerForRegistration = undefined;
    return server;
  }

  private getSessionId(): string {
    return this.activeSessionId ?? 'default';
  }

  private getAgentHeaders(): Record<string, string> {
    return this.sessionBinding.getAgentHeaders(this.getSessionId());
  }

  private async fetchDeck(deckId: string): Promise<{ id: string; name: string }> {
    const deck = await fetch(`${this.backendUrl}/api/decks/${deckId}`, {
      headers: {
        ...agentClientHeaders,
        Accept: 'application/json',
      },
    });
    const body = (await deck.json()) as {
      success: boolean;
      error?: string;
      data?: { id: string; name: string };
    };
    if (!deck.ok || !body.success || !body.data?.id) {
      throw new Error(body.error ?? `Deck not found: ${deckId}`);
    }
    return body.data;
  }

  private async buildBindingPayload(sessionId: string, manifestDeckId?: string) {
    const snapshot = this.sessionBinding.getBinding(sessionId);
    const deck = await this.callBackendAPI('/api/scope/deck');
    return {
      workspaceRoot: snapshot.workspaceRoot,
      deck_id: deck?.id as string,
      deck_name: deck?.name as string,
      deck_source: resolveDeckBindingSource(snapshot, manifestDeckId),
      session_deck_override: this.sessionBinding.hasSessionDeckOverride(sessionId),
    };
  }

  private async writeBindingSidecar(sessionId: string, manifestDeckId?: string): Promise<void> {
    const snapshot = this.sessionBinding.getBinding(sessionId);
    if (!snapshot.workspaceRoot) {
      return;
    }

    const deck = await this.callBackendAPI('/api/scope/deck');
    if (!deck?.id || !deck?.name) {
      return;
    }

    await upsertBindingForSession(sessionId, {
      deckId: deck.id as string,
      deckName: deck.name as string,
      source: resolveDeckBindingSource(snapshot, manifestDeckId),
      updatedAt: new Date().toISOString(),
      cardCounts: countDeckCards(deck),
      workspaceRoot: snapshot.workspaceRoot,
    });
  }

  private async callBackendAPI(endpoint: string, init: RequestInit = {}): Promise<any> {
    try {
      const response = await fetch(`${this.backendUrl}${endpoint}`, {
        ...init,
        headers: {
          ...this.getAgentHeaders(),
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) {
        const text = await response.text();
        let message = `Backend API error: ${response.status} ${response.statusText}`;
        try {
          const body = JSON.parse(text);
          if (body.error) message = String(body.error);
        } catch {
          if (text.trim()) message = text;
        }
        throw new Error(message);
      }
      const body = await response.json();

      // Unwrap ApiResponse shape { success, data?, error? }
      if (typeof body === 'object' && body !== null && 'success' in body) {
        if (body.success) {
          // Some endpoints return the raw data (legacy); fallback to body if data missing
          return 'data' in body ? body.data : body;
        }
        const message = 'error' in body ? body.error : 'Unknown backend error';
        throw new Error(String(message));
      }

      // Fallback: return as-is if not wrapped
      return body;
    } catch (error) {
      console.error(`Failed to call backend API ${endpoint}:`, error);
      throw error;
    }
  }

  private async getBoundDeckId(): Promise<string> {
    const deck = await this.callBackendAPI('/api/scope/deck');
    if (!deck?.id) {
      throw new Error('No bound deck — call bind_workspace (optionally with deckId) or switch_bound_deck first');
    }
    return deck.id as string;
  }

  private toolResult(data: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }

  private toolError(error: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }, null, 2) }] };
  }

  /** Avoid TS2589 when registering many MCP tools (SDK overload recursion). */
  private registerTool(
    name: string,
    config: { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny> },
    handler: (...args: any[]) => Promise<any>,
  ): void {
    (this.server as { registerTool: (...args: unknown[]) => unknown }).registerTool(
      name,
      config,
      handler,
    );
  }

  private setupTools() {
    this.registerTool("bind_workspace", {
      title: "Bind Workspace",
      description:
        "Bind this MCP session to a workspace root. Pass deckId for a session-only deck override (same path, different concurrent agents). Without deckId, uses .agent-deck/deck.yaml when present.",
      inputSchema: {
        workspaceRoot: z.string(),
        deckId: z.string().uuid().optional(),
      },
    }, async ({ workspaceRoot, deckId }) => {
      try {
        const sessionId = this.getSessionId();
        this.sessionBinding.setWorkspace(sessionId, workspaceRoot);

        if (deckId) {
          const deck = await this.fetchDeck(deckId);
          this.sessionBinding.setDeckId(sessionId, deckId);
          const payload = await this.buildBindingPayload(sessionId);
          await this.writeBindingSidecar(sessionId);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ...payload,
                deck_name: deck.name,
                message:
                  'Session bound with deck override. .agent-deck/deck.yaml is unchanged; other MCP sessions can use a different deck at the same path.',
              }, null, 2),
            }],
          };
        }

        this.sessionBinding.clearDeckId(sessionId);

        const resolved = await fetch(`${this.backendUrl}/api/scope/resolve`, {
          method: 'POST',
          headers: { ...agentClientHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceRoot }),
        });
        const body = (await resolved.json()) as {
          success: boolean;
          error?: string;
          data?: {
            manifestPath: string;
            manifest: { deck_id: string };
            deck: { name: string };
          };
        };
        if (!body.success || !body.data) {
          throw new Error(
            body.error ??
              'Failed to resolve workspace deck. Pass deckId to bind without deck.yaml, or call setup_repo_deck.',
          );
        }

        const { data } = body;
        const payload = await this.buildBindingPayload(sessionId, data.manifest.deck_id);
        await this.writeBindingSidecar(sessionId, data.manifest.deck_id);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...payload,
              manifestPath: data.manifestPath,
              message: 'Session bound via .agent-deck/deck.yaml.',
            }, null, 2),
          }],
        };
      } catch (error) {
        const message = String(error);
        const hint = message.includes('deck.yaml') || message.includes('No .agent-deck')
          ? ' Pass deckId on bind_workspace, call setup_repo_deck, or get_repo_deck_status to diagnose.'
          : '';
        return {
          content: [{ type: "text", text: JSON.stringify({ error: message + hint }, null, 2) }],
        };
      }
    });

    this.registerTool("switch_bound_deck", {
      title: "Switch Bound Deck",
      description:
        "Switch the deck for this MCP session only. Does not modify .agent-deck/deck.yaml. Use when multiple agent sessions share the same workspace path.",
      inputSchema: { deckId: z.string().uuid() },
    }, async ({ deckId }) => {
      try {
        const sessionId = this.getSessionId();
        const deck = await this.fetchDeck(deckId);
        this.sessionBinding.setDeckId(sessionId, deckId);
        const payload = await this.buildBindingPayload(sessionId);
        await this.writeBindingSidecar(sessionId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...payload,
              deck_name: deck.name,
              message: 'Session deck switched. Other sessions and deck.yaml are unchanged.',
            }, null, 2),
          }],
        };
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("get_session_binding", {
      title: "Get Session Binding",
      description:
        "Show workspace and effective deck for this MCP session, including whether the deck comes from a session override or repo deck.yaml.",
      inputSchema: {},
    }, async () => {
      try {
        const sessionId = this.getSessionId();
        const snapshot = this.sessionBinding.getBinding(sessionId);
        let manifestDeckId: string | undefined;
        if (snapshot.workspaceRoot && !snapshot.deckSource) {
          const manifest = await loadRepoDeckManifest(snapshot.workspaceRoot);
          manifestDeckId = manifest?.deck_id;
        }
        const deck = await this.callBackendAPI('/api/scope/deck');
        const cardCounts = deck ? countDeckCards(deck) : { mcp: 0, credentials: 0, playbooks: 0 };
        const displaySummary = formatDisplayLine(deck?.name ?? null, cardCounts);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              workspaceRoot: snapshot.workspaceRoot,
              session_deck_override: snapshot.deckId,
              session_deck_source: snapshot.deckSource,
              repo_manifest_deck_id: manifestDeckId,
              effective_deck_id: deck?.id,
              effective_deck_name: deck?.name,
              effective_deck_source: resolveDeckBindingSource(snapshot, manifestDeckId),
              display_summary: displaySummary,
            }, null, 2),
          }],
        };
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("get_repo_deck_status", {
      title: "Get Repo Deck Status",
      description:
        "Check whether .agent-deck/deck.yaml exists in a workspace and whether it links to a valid deck",
      inputSchema: { workspaceRoot: z.string() },
    }, async ({ workspaceRoot }) => {
      try {
        const filePath = repoDeckManifestFilePath(workspaceRoot);
        const manifest = await loadRepoDeckManifest(workspaceRoot);

        if (!manifest) {
          const decks = await this.callBackendAPI('/api/decks');
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: 'missing',
                workspaceRoot,
                expectedPath: REPO_DECK_MANIFEST_PATH,
                message: 'No .agent-deck/deck.yaml found. Use setup_repo_deck to create one.',
                availableDecks: Array.isArray(decks)
                  ? decks.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))
                  : decks,
              }, null, 2),
            }],
          };
        }

        const resolved = await fetch(`${this.backendUrl}/api/scope/resolve`, {
          method: 'POST',
          headers: { ...agentClientHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceRoot }),
        });
        const body = (await resolved.json()) as {
          success: boolean;
          error?: string;
          data?: { manifest: { deck_id: string; name?: string }; deck: { name: string } };
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: body.success ? 'ok' : 'invalid',
              workspaceRoot,
              filePath,
              manifest,
              deck: body.data?.deck,
              error: body.success ? undefined : body.error,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
        };
      }
    });

    this.registerTool("setup_repo_deck", {
      title: "Setup Repo Deck",
      description:
        "Create or verify .agent-deck/deck.yaml in a repo. Links the workspace to an Agent Deck by deck_id. Optionally writes the file.",
      inputSchema: {
        workspaceRoot: z.string(),
        deckId: z.string().uuid().optional(),
        deckName: z.string().optional(),
        writeFile: z.boolean().optional(),
      },
    }, async ({ workspaceRoot, deckId, deckName, writeFile = true }) => {
      try {
        const sessionId = this.getSessionId();
        const existing = await loadRepoDeckManifest(workspaceRoot);

        if (existing) {
          this.sessionBinding.setWorkspace(sessionId, workspaceRoot);
          const resolved = await fetch(`${this.backendUrl}/api/scope/resolve`, {
            method: 'POST',
            headers: { ...agentClientHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceRoot }),
          });
          const body = (await resolved.json()) as {
            success: boolean;
            error?: string;
            data?: { manifestPath: string; manifest: { deck_id: string }; deck: { name: string } };
          };
          if (!body.success || !body.data) {
            throw new Error(body.error ?? 'Existing manifest is invalid');
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: 'existing',
                workspaceRoot,
                manifestPath: body.data.manifestPath,
                deck_id: body.data.manifest.deck_id,
                deck_name: body.data.deck.name,
                message: 'Workspace already linked. Session bound to this deck.',
              }, null, 2),
            }],
          };
        }

        if (!deckId) {
          const decks = await this.callBackendAPI('/api/decks');
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: 'needs_deck_id',
                workspaceRoot,
                expectedPath: REPO_DECK_MANIFEST_PATH,
                message:
                  'Pick a deck id from the dashboard (My Decks → copy icon) and call setup_repo_deck again with deckId.',
                availableDecks: Array.isArray(decks)
                  ? decks.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))
                  : decks,
              }, null, 2),
            }],
          };
        }

        const deck = await this.callBackendAPI(`/api/decks/${deckId}`);
        if (!deck?.id) {
          throw new Error(`Deck not found: ${deckId}`);
        }

        const content = formatRepoDeckManifest(deckId, deckName ?? deck.name);
        const dirPath = path.join(path.resolve(workspaceRoot), '.agent-deck');
        const filePath = repoDeckManifestFilePath(workspaceRoot);

        if (writeFile) {
          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(filePath, content, 'utf8');
        }

        this.sessionBinding.setWorkspace(sessionId, workspaceRoot);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: writeFile ? 'created' : 'preview',
              workspaceRoot,
              filePath,
              deck_id: deckId,
              deck_name: deck.name,
              manifestContent: content,
              message: writeFile
                ? 'Created .agent-deck/deck.yaml and bound this session to the deck.'
                : 'Preview only — set writeFile true to write the file.',
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
        };
      }
    });

    // Get all decks (metadata only; credentials stripped unless bound)
    this.registerTool("get_decks", {
      title: "Get Decks",
      description: "Get all available decks from Agent Deck",
      inputSchema: {}
    }, async () => {
      try {
        const decks = await this.callBackendAPI('/api/decks');
        return {
          content: [{ type: "text", text: JSON.stringify(decks, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }]
        };
      }
    });

    this.registerTool("get_bound_deck", {
      title: "Get Bound Deck",
      description:
        "Get the deck bound to this session (session deckId override, env, or .agent-deck/deck.yaml)",
      inputSchema: {},
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        return {
          content: [{ type: "text", text: JSON.stringify(deck, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
        };
      }
    });

    // Deprecated alias
    this.registerTool("get_active_deck", {
      title: "Get Active Deck (deprecated)",
      description: "Deprecated — use get_bound_deck. Returns the workspace-bound deck.",
      inputSchema: {},
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        return {
          content: [{ type: "text", text: JSON.stringify(deck, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
        };
      }
    });

    this.registerTool("list_bound_deck_services", {
      title: "List Bound Deck Services",
      description: "List MCP services on the workspace-bound deck",
      inputSchema: {},
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        const services = deck?.services ?? [];
        return { content: [{ type: "text", text: JSON.stringify(services, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("list_active_deck_services", {
      title: "List Active Deck Services (deprecated)",
      description: "Deprecated — use list_bound_deck_services",
      inputSchema: {},
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        const services = deck?.services ?? [];
        return { content: [{ type: "text", text: JSON.stringify(services, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("list_bound_deck_credentials", {
      title: "List Bound Deck Credentials",
      description: "List API key metadata on the workspace-bound deck",
      inputSchema: {},
    }, async () => {
      try {
        const credentials = await this.callBackendAPI('/api/credentials');
        return { content: [{ type: "text", text: JSON.stringify(credentials, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("list_active_deck_credentials", {
      title: "List Active Deck Credentials (deprecated)",
      description: "Deprecated — use list_bound_deck_credentials",
      inputSchema: {},
    }, async () => {
      try {
        const credentials = await this.callBackendAPI('/api/credentials');
        return { content: [{ type: "text", text: JSON.stringify(credentials, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("list_playbooks", {
      title: "List Playbooks",
      description: "List playbook cards on the bound deck (id, title, triggers)",
      inputSchema: {},
    }, async () => {
      try {
        const playbooks = await this.callBackendAPI('/api/playbooks/summaries');
        return { content: [{ type: "text", text: JSON.stringify(playbooks, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("get_playbook", {
      title: "Get Playbook",
      description: "Get full markdown body, metadata, and dependencies for a playbook card by id",
      inputSchema: { playbook_id: z.string() },
    }, async ({ playbook_id }) => {
      try {
        const playbook = await this.callBackendAPI(`/api/playbooks/${encodeURIComponent(playbook_id)}`);
        return { content: [{ type: "text", text: JSON.stringify(playbook, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("register_playbook", {
      title: "Register Playbook",
      description:
        "Create a playbook card, auto-detect API key and MCP dependencies from the content, and add it to the bound deck by default",
      inputSchema: {
        title: z.string(),
        body: z.string(),
        triggers: z.array(z.string()).optional(),
        playbook_id: z.string().optional(),
        exec: z.string().optional(),
        skill: z.string().optional(),
        depends_on_credential_ids: z.array(z.string()).optional(),
        depends_on_service_ids: z.array(z.string()).optional(),
        add_to_bound_deck: z.boolean().optional(),
        auto_detect_dependencies: z.boolean().optional(),
      },
    }, async (args) => {
      try {
        const playbook = await this.callBackendAPI("/api/playbooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: args.title,
            body: args.body,
            triggers: args.triggers,
            id: args.playbook_id,
            exec: args.exec,
            skill: args.skill,
            dependsOnCredentialIds: args.depends_on_credential_ids,
            dependsOnServiceIds: args.depends_on_service_ids,
            addToBoundDeck: args.add_to_bound_deck,
            autoDetectDependencies: args.auto_detect_dependencies,
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(playbook, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("update_playbook", {
      title: "Update Playbook",
      description:
        "Update a playbook on the bound deck. Dependencies are re-detected from the updated content by default.",
      inputSchema: {
        playbook_id: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        triggers: z.array(z.string()).optional(),
        exec: z.string().optional(),
        skill: z.string().optional(),
        depends_on_credential_ids: z.array(z.string()).optional(),
        depends_on_service_ids: z.array(z.string()).optional(),
        auto_detect_dependencies: z.boolean().optional(),
      },
    }, async ({ playbook_id, ...args }) => {
      try {
        const playbook = await this.callBackendAPI(
          `/api/playbooks/${encodeURIComponent(playbook_id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: args.title,
              body: args.body,
              triggers: args.triggers,
              exec: args.exec,
              skill: args.skill,
              dependsOnCredentialIds: args.depends_on_credential_ids,
              dependsOnServiceIds: args.depends_on_service_ids,
              autoDetectDependencies: args.auto_detect_dependencies,
            }),
          },
        );
        return { content: [{ type: "text", text: JSON.stringify(playbook, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    this.registerTool("list_collection_services", {
      title: "List Collection Services",
      description: "List all registered MCP services in the collection (metadata only)",
      inputSchema: {},
    }, async () => {
      try {
        const services = await this.callBackendAPI('/api/services');
        return this.toolResult(services);
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("register_service", {
      title: "Register Service",
      description:
        "Register an MCP service in the collection. Optionally add it to the bound deck. OAuth setup still requires the dashboard browser flow.",
      inputSchema: {
        name: z.string(),
        type: z.enum(['mcp', 'a2a', 'local-mcp']),
        url: z.string(),
        description: z.string().optional(),
        cardColor: z.string().optional(),
        credentialId: z.string().optional(),
        headers: z.record(z.string()).optional(),
        localCommand: z.string().optional(),
        localArgs: z.array(z.string()).optional(),
        localWorkingDir: z.string().optional(),
        localEnv: z.record(z.string()).optional(),
        add_to_bound_deck: z.boolean().optional(),
        position: z.number().optional(),
      },
    }, async (args) => {
      try {
        const { add_to_bound_deck, position, ...serviceInput } = args;
        const service = await this.callBackendAPI('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceInput),
        });

        if (add_to_bound_deck !== false) {
          const deckId = await this.getBoundDeckId();
          await this.callBackendAPI(`/api/decks/${deckId}/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceId: service.id, position }),
          });
        }

        return this.toolResult(service);
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("update_service", {
      title: "Update Service",
      description: "Update MCP service metadata in the collection (not OAuth tokens — use dashboard for OAuth)",
      inputSchema: {
        service_id: z.string(),
        name: z.string().optional(),
        type: z.enum(['mcp', 'a2a', 'local-mcp']).optional(),
        url: z.string().optional(),
        description: z.string().optional(),
        cardColor: z.string().optional(),
        credentialId: z.string().optional(),
        headers: z.record(z.string()).optional(),
        localCommand: z.string().optional(),
        localArgs: z.array(z.string()).optional(),
        localWorkingDir: z.string().optional(),
        localEnv: z.record(z.string()).optional(),
      },
    }, async ({ service_id, ...updates }) => {
      try {
        const service = await this.callBackendAPI(`/api/services/${service_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        return this.toolResult(service);
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("delete_service", {
      title: "Delete Service",
      description: "Remove an MCP service from the collection entirely",
      inputSchema: { service_id: z.string() },
    }, async ({ service_id }) => {
      try {
        await this.callBackendAPI(`/api/services/${service_id}`, { method: 'DELETE' });
        return this.toolResult({ success: true, service_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("add_service_to_bound_deck", {
      title: "Add Service To Bound Deck",
      description: "Link an existing MCP service from the collection onto the bound deck",
      inputSchema: {
        service_id: z.string(),
        position: z.number().optional(),
      },
    }, async ({ service_id, position }) => {
      try {
        const deckId = await this.getBoundDeckId();
        await this.callBackendAPI(`/api/decks/${deckId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: service_id, position }),
        });
        return this.toolResult({ success: true, deck_id: deckId, service_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("remove_service_from_bound_deck", {
      title: "Remove Service From Bound Deck",
      description: "Unlink an MCP service from the bound deck (service stays in the collection)",
      inputSchema: { service_id: z.string() },
    }, async ({ service_id }) => {
      try {
        const deckId = await this.getBoundDeckId();
        await this.callBackendAPI(`/api/decks/${deckId}/services`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: service_id }),
        });
        return this.toolResult({ success: true, deck_id: deckId, service_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("update_service_tool_settings", {
      title: "Update Service Tool Settings",
      description: "Enable or disable individual tools for an MCP service on the bound deck",
      inputSchema: {
        service_id: z.string(),
        disabled_tools: z.array(z.string()),
      },
    }, async ({ service_id, disabled_tools }) => {
      try {
        const service = await this.callBackendAPI(`/api/services/${service_id}/tool-settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabledTools: disabled_tools }),
        });
        return this.toolResult(service);
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("list_collection_credentials", {
      title: "List Collection Credentials",
      description:
        "List all API key metadata in the collection (no secret values). Use credential ids to link keys to the bound deck after the user stores the secret in the dashboard.",
      inputSchema: {},
    }, async () => {
      try {
        const credentials = await this.callBackendAPI('/api/credentials/collection');
        return this.toolResult(credentials);
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("add_credential_to_bound_deck", {
      title: "Add Credential To Bound Deck",
      description:
        "Link an existing API key (by credential id) to the bound deck. The secret must already be stored via the dashboard or CLI.",
      inputSchema: {
        credential_id: z.string(),
        position: z.number().optional(),
      },
    }, async ({ credential_id, position }) => {
      try {
        const deckId = await this.getBoundDeckId();
        await this.callBackendAPI(`/api/decks/${deckId}/credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentialId: credential_id, position }),
        });
        return this.toolResult({ success: true, deck_id: deckId, credential_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("remove_credential_from_bound_deck", {
      title: "Remove Credential From Bound Deck",
      description: "Unlink an API key from the bound deck (credential stays in the vault)",
      inputSchema: { credential_id: z.string() },
    }, async ({ credential_id }) => {
      try {
        const deckId = await this.getBoundDeckId();
        await this.callBackendAPI(`/api/decks/${deckId}/credentials`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentialId: credential_id }),
        });
        return this.toolResult({ success: true, deck_id: deckId, credential_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("list_collection_playbooks", {
      title: "List Collection Playbooks",
      description: "List all playbook cards in the collection (for linking existing playbooks to the bound deck)",
      inputSchema: {},
    }, async () => {
      try {
        const playbooks = await this.callBackendAPI('/api/playbooks/collection');
        return this.toolResult(playbooks);
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("add_playbook_to_bound_deck", {
      title: "Add Playbook To Bound Deck",
      description: "Link an existing playbook card from the collection onto the bound deck",
      inputSchema: {
        playbook_id: z.string(),
        position: z.number().optional(),
      },
    }, async ({ playbook_id, position }) => {
      try {
        const deckId = await this.getBoundDeckId();
        await this.callBackendAPI(`/api/decks/${deckId}/playbooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playbookId: playbook_id, position }),
        });
        return this.toolResult({ success: true, deck_id: deckId, playbook_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("remove_playbook_from_bound_deck", {
      title: "Remove Playbook From Bound Deck",
      description: "Unlink a playbook from the bound deck (playbook stays in the collection)",
      inputSchema: { playbook_id: z.string() },
    }, async ({ playbook_id }) => {
      try {
        const deckId = await this.getBoundDeckId();
        await this.callBackendAPI(`/api/decks/${deckId}/playbooks`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playbookId: playbook_id }),
        });
        return this.toolResult({ success: true, deck_id: deckId, playbook_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("delete_playbook", {
      title: "Delete Playbook",
      description: "Delete a playbook from the collection (must be on the bound deck for agent clients)",
      inputSchema: { playbook_id: z.string() },
    }, async ({ playbook_id }) => {
      try {
        await this.callBackendAPI(`/api/playbooks/${encodeURIComponent(playbook_id)}`, {
          method: 'DELETE',
        });
        return this.toolResult({ success: true, playbook_id });
      } catch (error) {
        return this.toolError(error);
      }
    });

    this.registerTool("create_deck", {
      title: "Create Deck",
      description: "Create a new deck in Agent Deck",
      inputSchema: {
        name: z.string(),
        description: z.string().optional(),
      },
    }, async ({ name, description }) => {
      try {
        const deck = await this.callBackendAPI('/api/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description }),
        });
        return this.toolResult(deck);
      } catch (error) {
        return this.toolError(error);
      }
    });

    // Remove duplicate old tools block - list_service_tools follows
    this.registerTool("list_service_tools", {
      title: "List Service Tools",
      description: "List all available tools for a specific service in the active deck",
      inputSchema: { serviceId: z.string() }
    }, async ({ serviceId }) => {
      try {
        const tools = await this.callBackendAPI(`/api/services/${serviceId}/tools`);
        return { content: [{ type: "text", text: JSON.stringify(tools, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    // Call a tool on a service in the active deck
    this.registerTool("call_service_tool", {
      title: "Call Service Tool",
      description: "Call a tool on a service from the active deck",
      inputSchema: {
        serviceId: z.string(),
        toolName: z.string(),
        arguments: z.union([z.record(z.any()), z.string()]).optional()
      }
    }, async ({ serviceId, toolName, arguments: args = {} }) => {
      try {
        // Support both object and JSON string inputs for arguments
        let normalizedArgs: any = args;
        if (typeof normalizedArgs === 'string' && normalizedArgs.length > 0) {
          try {
            normalizedArgs = JSON.parse(normalizedArgs);
          } catch (e) {
            return { content: [{ type: "text", text: JSON.stringify({ error: `Invalid JSON in arguments: ${String(e)}` }, null, 2) }] };
          }
        }

        const res = await fetch(`${this.backendUrl}/api/services/${serviceId}/call`, {
          method: 'POST',
          headers: { ...this.getAgentHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolName, arguments: normalizedArgs ?? {} })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Backend API error ${res.status}: ${text}`);
        }
        const body: any = await res.json();
        const data = (body && (body as any).success) ? ((body as any).data ?? (body as any).result ?? body) : body;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });
  }

  private setupResources() {
    this.server.resource("bound_deck_summary", "agent-deck://bound-deck/summary", {
      description: "One-line summary of the workspace-bound deck for status display",
      mimeType: "text/plain",
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        const summary = formatDisplayLine(deck?.name ?? null, countDeckCards(deck ?? {}));

        return {
          contents: [{
            uri: "agent-deck://bound-deck/summary",
            mimeType: "text/plain",
            text: summary,
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://bound-deck/summary",
            mimeType: "text/plain",
            text: formatDisplayLine(null, { mcp: 0, credentials: 0, playbooks: 0 }),
          }],
        };
      }
    });

    this.server.resource("bound_deck_services", "agent-deck://bound-deck/services", {
      description: "MCP services on the workspace-bound deck",
      mimeType: "application/json"
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        const services = deck?.services ?? [];
        
        return {
          contents: [{
            uri: "agent-deck://bound-deck/services",
            mimeType: "application/json",
            text: JSON.stringify(services, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://bound-deck/services",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get bound deck services: ${error}` }, null, 2)
          }]
        };
      }
    });

    this.server.resource("active_deck_services", "agent-deck://active-deck/services", {
      description: "Deprecated — use agent-deck://bound-deck/services",
      mimeType: "application/json"
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        const services = deck?.services ?? [];
        
        return {
          contents: [{
            uri: "agent-deck://active-deck/services",
            mimeType: "application/json",
            text: JSON.stringify(services, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://active-deck/services",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get bound deck services: ${error}` }, null, 2)
          }]
        };
      }
    });

    this.server.resource("bound_deck_credentials", "agent-deck://bound-deck/credentials", {
      description: "API key metadata on the workspace-bound deck",
      mimeType: "application/json"
    }, async () => {
      try {
        const credentials = await this.callBackendAPI('/api/credentials');

        return {
          contents: [{
            uri: "agent-deck://bound-deck/credentials",
            mimeType: "application/json",
            text: JSON.stringify(credentials, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://bound-deck/credentials",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get bound deck credentials: ${error}` }, null, 2)
          }]
        };
      }
    });

    this.server.resource("active_deck_credentials", "agent-deck://active-deck/credentials", {
      description: "Deprecated — use agent-deck://bound-deck/credentials",
      mimeType: "application/json"
    }, async () => {
      try {
        const credentials = await this.callBackendAPI('/api/credentials');

        return {
          contents: [{
            uri: "agent-deck://active-deck/credentials",
            mimeType: "application/json",
            text: JSON.stringify(credentials, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://active-deck/credentials",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get bound deck credentials: ${error}` }, null, 2)
          }]
        };
      }
    });

    this.server.resource("bound_deck", "agent-deck://bound-deck", {
      description: "Deck bound via .agent-deck/deck.yaml in the workspace",
      mimeType: "application/json"
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        
        return {
          contents: [{
            uri: "agent-deck://bound-deck",
            mimeType: "application/json",
            text: JSON.stringify(deck, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://bound-deck",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get bound deck: ${error}` }, null, 2)
          }]
        };
      }
    });

    this.server.resource("active_deck", "agent-deck://active-deck", {
      description: "Deprecated — use agent-deck://bound-deck",
      mimeType: "application/json"
    }, async () => {
      try {
        const deck = await this.callBackendAPI('/api/scope/deck');
        
        return {
          contents: [{
            uri: "agent-deck://active-deck",
            mimeType: "application/json",
            text: JSON.stringify(deck, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://active-deck",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get bound deck: ${error}` }, null, 2)
          }]
        };
      }
    });

    // Register resource for all decks
    this.server.resource("decks", "agent-deck://decks", {
      description: "List of all available decks",
      mimeType: "application/json"
    }, async () => {
      try {
        const decks = await this.callBackendAPI('/api/decks');
        
        return {
          contents: [{
            uri: "agent-deck://decks",
            mimeType: "application/json",
            text: JSON.stringify(decks, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://decks",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get decks: ${error}` }, null, 2)
          }]
        };
      }
    });
  }

  private setupRoutes() {
    this.app.post('/mcp', async (req: Request, res: Response) => {
      await this.handleMcpPost(req, res);
    });

    this.app.get('/mcp', async (req: Request, res: Response) => {
      await this.handleMcpSessionRequest(req, res);
    });

    this.app.delete('/mcp', async (req: Request, res: Response) => {
      await this.handleMcpSessionRequest(req, res);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        service: 'agent-deck-mcp-server',
        backendUrl: this.backendUrl
      });
    });

    // Backend connectivity check
    this.app.get('/backend-status', async (req: Request, res: Response) => {
      try {
        const response = await fetch(`${this.backendUrl}/health`);
        const backendStatus = await response.json();
        res.json({
          mcpServer: 'ok',
          backend: backendStatus,
          connected: response.ok
        });
      } catch (error) {
        res.json({
          mcpServer: 'ok',
          backend: 'unreachable',
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  private getSessionIdHeader(req: Request): string | undefined {
    const value = req.headers['mcp-session-id'];
    return typeof value === 'string' ? value : undefined;
  }

  private async handleMcpPost(req: Request, res: Response): Promise<void> {
    const sessionIdHeader = this.getSessionIdHeader(req);
    const existing = sessionIdHeader ? this.sessions.get(sessionIdHeader) : undefined;

    if (existing) {
      this.activeSessionId = sessionIdHeader;
      await existing.transport.handleRequest(req, res, req.body);
      return;
    }

    const body = req.body;
    const isInit =
      body &&
      typeof body === 'object' &&
      (isInitializeRequest(body) ||
        (Array.isArray(body) && body.some((message) => isInitializeRequest(message))));

    if (!isInit) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
      return;
    }

    const server = this.createMcpServer();
    let sessionEntry: McpSession | undefined;

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        sessionEntry = { transport, server };
        this.sessions.set(sessionId, sessionEntry);
      },
    });

    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId) {
        this.sessions.delete(sessionId);
        this.sessionBinding.clearSession(sessionId);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, body);

    if (transport.sessionId && !this.sessions.has(transport.sessionId)) {
      this.sessions.set(transport.sessionId, { transport, server });
    }
    this.activeSessionId = transport.sessionId;
  }

  private async handleMcpSessionRequest(req: Request, res: Response): Promise<void> {
    const sessionId = this.getSessionIdHeader(req);
    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    this.activeSessionId = sessionId;
    await session.transport.handleRequest(req, res);
  }

  async start() {
    try {
      console.log(`🚀 Starting Agent Deck MCP Server on port ${this.port}...`);
      console.log(`🔗 Backend API URL: ${this.backendUrl}`);

      this.app.listen(this.port, () => {
        console.log(`✅ Agent Deck MCP Server is ready to accept connections`);
        console.log(`📋 Available tools:`);
        console.log(`   - bind_workspace: Bind session to workspace; optional deckId override`);
        console.log(`   - switch_bound_deck: Switch deck for this session only`);
        console.log(`   - get_session_binding: Show session workspace + effective deck`);
        console.log(`   - get_repo_deck_status: Check repo deck manifest`);
        console.log(`   - setup_repo_deck: Create .agent-deck/deck.yaml for a repo`);
        console.log(`   - get_bound_deck: Get workspace-bound deck`);
        console.log(`   - list_service_tools: List tools for a specific service`);
        console.log(`   - call_service_tool: Call a tool on a service`);
        console.log(`📋 Available resources:`);
        console.log(`   - agent-deck://decks: List of all available decks`);
        console.log(`   - agent-deck://active-deck: The currently active deck`);
        console.log(`   - agent-deck://active-deck/credentials: API keys on the active deck`);
        console.log(`   - agent-deck://active-deck/services: Services in the active deck`);
        console.log(`🌐 Server running on http://localhost:${this.port}`);
        console.log(`🔧 MCP endpoint: http://localhost:${this.port}/mcp`);
        console.log(`❤️  Health check: http://localhost:${this.port}/health`);
        console.log(`🔗 Backend status: http://localhost:${this.port}/backend-status`);
        console.log(`📝 Architecture: MCP Server → Backend API → Active Deck Services`);
      });
      
      return this.app;
    } catch (error) {
      console.error(`❌ Failed to start MCP server:`, error);
      throw error;
    }
  }

  async stop() {
    try {
      for (const [sessionId, session] of this.sessions) {
        try {
          await session.transport.close();
        } catch (error) {
          console.error(`Error closing MCP session ${sessionId}:`, error);
        }
      }
      this.sessions.clear();
      console.log(`🛑 MCP server stopped`);
    } catch (error) {
      console.error(`❌ Error stopping MCP server:`, error);
    }
  }
}