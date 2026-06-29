import { CreateServiceInput } from '@agent-deck/shared';

/**
 * Preset remote MCP service cards seeded on first install (empty services table).
 * Users can delete cards they do not need. Not re-added on subsequent starts.
 *
 * Skipped:
 * - Docmost — requires a self-hosted instance URL per user
 * - Obsidian — local MCP (stdio); not a remote HTTP preset
 * - Figma — remote MCP not enabled yet (vendor OAuth allowlist)
 * - Gmail / Google Calendar / Google Drive — remote Google MCP needs painful BYO GCP OAuth;
 *   use local community servers instead (see docs/GOOGLE_DRIVE_WORKAROUND.md)
 */
export const DEFAULT_MCP_SERVICES: CreateServiceInput[] = [
  {
    name: 'Linear',
    type: 'mcp',
    url: 'https://mcp.linear.app/mcp',
    description: 'Issues, projects, and team workflows in Linear',
    cardColor: '#5E6AD2',
  },
  {
    name: 'GitHub',
    type: 'mcp',
    url: 'https://api.githubcopilot.com/mcp/',
    description: 'Repositories, issues, and pull requests via GitHub MCP',
    cardColor: '#24292F',
  },
  {
    name: 'Notion',
    type: 'mcp',
    url: 'https://mcp.notion.com/mcp',
    description: 'Pages, databases, and workspace content in Notion',
    cardColor: '#37352F',
  },
  {
    name: 'Draw.io',
    type: 'mcp',
    url: 'https://mcp.draw.io/mcp',
    description: 'Diagrams and whiteboards with draw.io',
    cardColor: '#F08705',
  },
  {
    name: 'Slack',
    type: 'mcp',
    url: 'https://mcp.slack.com/mcp',
    description: 'Channels, messages, and workspace actions in Slack',
    cardColor: '#4A154B',
  },
];
