import { MCPServersManifest, LocalMCPServerConfig, CreateServiceInput } from '@agent-deck/shared';
import { z } from 'zod';

// Validation schemas
const LocalMCPServerConfigSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).optional().default([]),
  workingDir: z.string().optional(),
  env: z.record(z.string()).optional(),
});

const MCPServersManifestSchema = z.object({
  mcpServers: z.record(z.string(), LocalMCPServerConfigSchema),
});

export class ConfigManager {
  /**
   * Parse and validate MCP servers manifest from JSON
   */
  parseManifest(jsonContent: string): MCPServersManifest {
    try {
      const parsed = JSON.parse(jsonContent);
      const validated = MCPServersManifestSchema.parse(parsed);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid manifest format: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert manifest to service creation inputs
   */
  manifestToServices(manifest: MCPServersManifest): CreateServiceInput[] {
    const services: CreateServiceInput[] = [];

    for (const [name, config] of Object.entries(manifest.mcpServers)) {
      const service: CreateServiceInput = {
        name,
        type: 'local-mcp',
        url: `local://${name}`, // Use a local URL scheme for local servers
        description: `Local MCP server: ${config.command} ${config.args.join(' ')}`,
        cardColor: '#39FF14', // Green color for local servers
        localCommand: config.command,
        localArgs: config.args,
        localWorkingDir: config.workingDir,
        localEnv: config.env,
      };

      services.push(service);
    }

    return services;
  }

  /**
   * Validate a single local MCP server configuration
   */
  validateLocalServerConfig(config: LocalMCPServerConfig): void {
    LocalMCPServerConfigSchema.parse(config);
  }

  /**
   * Generate a sample manifest
   */
  generateSampleManifest(): MCPServersManifest {
    return {
      mcpServers: {
        memory: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-memory"]
        },
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          env: {
            MCP_SERVER_FILESYSTEM_ROOT: "/path/to/root"
          }
        },
        git: {
          command: "python",
          args: ["-m", "mcp.server.git"],
          workingDir: "/path/to/git/repo"
        }
      }
    };
  }

  /**
   * Convert manifest to JSON string
   */
  manifestToJson(manifest: MCPServersManifest): string {
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Check if a command is safe to execute (basic security check)
   */
  isCommandSafe(command: string): boolean {
    const unsafeCommands = [
      'rm', 'del', 'format', 'mkfs', 'dd', 'shred',
      'sudo', 'su', 'chmod', 'chown', 'mount', 'umount'
    ];

    const lowerCommand = command.toLowerCase();
    return !unsafeCommands.some(unsafe => lowerCommand.includes(unsafe));
  }

  /**
   * Validate and sanitize environment variables
   */
  sanitizeEnvironment(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      // Only allow safe environment variable names
      if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        sanitized[key] = value;
      } else {
        console.warn(`⚠️ Skipping potentially unsafe environment variable: ${key}`);
      }
    }

    return sanitized;
  }
}
