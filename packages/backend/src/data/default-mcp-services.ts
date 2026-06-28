import { CreateServiceInput } from '@agent-deck/shared';

/**
 * Preset remote MCP service cards seeded on first install (empty services table).
 * Users can delete cards they do not need. Not re-added on subsequent starts.
 *
 * Skipped:
 * - Docmost — requires a self-hosted instance URL per user
 * - Obsidian — local MCP (stdio); not a remote HTTP preset
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
    description: 'Repositories, issues, and pull requests via GitHub Copilot MCP',
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
    name: 'Gmail',
    type: 'mcp',
    url: 'https://gmailmcp.googleapis.com/mcp/v1',
    description: 'Read and manage Gmail messages',
    cardColor: '#EA4335',
  },
  {
    name: 'Google Calendar',
    type: 'mcp',
    url: 'https://calendarmcp.googleapis.com/mcp/v1',
    description: 'Events and schedules in Google Calendar',
    cardColor: '#4285F4',
  },
  {
    name: 'Google Drive',
    type: 'mcp',
    url: 'https://drivemcp.googleapis.com/mcp/v1',
    description: 'Files and folders in Google Drive',
    cardColor: '#0F9D58',
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
  {
    name: 'Figma',
    type: 'mcp',
    url: 'https://mcp.figma.com/mcp',
    description: 'Design files, components, and comments in Figma',
    cardColor: '#F24E1E',
  },
];
