export type OAuthSetupMode = 'dynamic' | 'managed' | 'manual' | 'unavailable';

import { hasSharedOAuthApp } from '../config/shared-oauth-apps';
import { getOAuthRedirectUri, isOAuthRedirectHttps } from '../config/oauth-redirect';

export type OAuthProviderGuide = {
  provider: string;
  setupMode: OAuthSetupMode;
  title: string;
  redirectUri: string;
  steps: string[];
  docsUrl?: string;
  unavailableReason?: string;
  /** Pre-filled app manifest (Slack: paste at Create New App → From a manifest). */
  manifestJson?: string;
  /** Deep link to provider app creation UI. */
  createAppUrl?: string;
  /** Shorter alternative when full setup is too heavy. */
  easierAlternative?: string;
};

/** Slack MCP app manifest with redirect URI and common user scopes pre-filled. */
export function getSlackMcpAppManifest(redirectUri = getOAuthRedirectUri()): string {
  return JSON.stringify(
    {
      display_information: {
        name: 'Agent Deck',
        description: 'Connect AI agents to your Slack workspace through Agent Deck.',
        long_description:
          'Agent Deck lets you authorize Slack so AI agents can read and search channels and direct messages you belong to, and send messages when you approve. Each user connects with their own Slack account. Tokens are stored on your Agent Deck instance.',
        background_color: '#2c2d30',
      },
      features: {
        bot_user: {
          display_name: 'Agent Deck MCP',
          always_online: false,
        },
      },
      oauth_config: {
        redirect_urls: [redirectUri],
        scopes: {
          bot: ['users:read'],
          user: [
            'search:read.public',
            'search:read.private',
            'search:read.mpim',
            'search:read.im',
            'search:read.files',
            'search:read.users',
            'chat:write',
            'channels:history',
            'groups:history',
            'mpim:history',
            'im:history',
            'canvases:read',
            'canvases:write',
            'users:read',
            'users:read.email',
          ],
        },
      },
      settings: {
        org_deploy_enabled: true,
      },
    },
    null,
    2,
  );
}

export function inferOAuthProvider(serviceUrl: string, authServers: string[] = []): string {
  const url = serviceUrl.toLowerCase();
  if (url.includes('figma.com')) return 'figma';
  if (url.includes('slack.com')) return 'slack';
  if (url.includes('googleapis.com') || authServers.some((s) => s.includes('accounts.google.com'))) {
    return 'google';
  }
  if (url.includes('linear.app')) return 'linear';
  if (url.includes('notion.com')) return 'notion';
  if (url.includes('githubcopilot.com') || authServers.some((s) => s.includes('github.com'))) {
    return 'github';
  }
  return 'custom';
}

export function resolveOAuthSetupMode(
  provider: string,
  supportsDynamicRegistration?: boolean,
): OAuthSetupMode {
  if (provider === 'figma') return 'unavailable';
  if (hasSharedOAuthApp(provider)) return 'managed';
  if (supportsDynamicRegistration) return 'dynamic';
  if (provider === 'linear' || provider === 'notion') return 'dynamic';
  return 'manual';
}

export function getOAuthProviderGuide(provider: string): OAuthProviderGuide {
  const redirectUri = getOAuthRedirectUri();
  const base = {
    provider,
    redirectUri,
  };

  switch (provider) {
    case 'google':
      return {
        ...base,
        setupMode: 'manual',
        title: 'Google OAuth app',
        docsUrl: 'https://developers.google.com/workspace/guides/configure-mcp-servers',
        steps: [
          'Open Google Cloud Console → APIs & Services → Credentials.',
          'Create an OAuth 2.0 Client ID (type: Web application or Desktop).',
          `Add authorized redirect URI: ${redirectUri}`,
          'Enable the Gmail / Calendar / Drive MCP APIs for your project if prompted.',
          'Paste the Client ID and Client Secret below, then click Connect.',
        ],
      };
    case 'slack':
      if (hasSharedOAuthApp('slack')) {
        return {
          ...base,
          setupMode: 'managed',
          title: 'Slack',
          docsUrl: 'https://docs.slack.dev/ai/slack-mcp-server/',
          steps: [
            'Click Connect — Agent Deck uses the shared Slack OAuth app.',
            'Sign in and approve access for your workspace (one time per workspace).',
          ],
        };
      }
      return {
        ...base,
        setupMode: 'manual',
        title: 'Slack MCP (~10 min, one-time)',
        docsUrl: 'https://docs.slack.dev/ai/slack-mcp-server/',
        createAppUrl: 'https://api.slack.com/apps/new',
        manifestJson: getSlackMcpAppManifest(redirectUri),
        easierAlternative:
          'If this is too much: use Slack MCP inside Cursor or Claude Code (partner apps), and keep this card as a reminder—or wait for a future Agent Deck shared OAuth app.',
        steps: [
          ...(isOAuthRedirectHttps()
            ? []
            : [
                'Set AGENT_DECK_PUBLIC_URL to your Agent Deck HTTPS origin (e.g. https://oauth.agent-deck.dev) so the manifest redirect URL uses https:// — required for Slack public distribution.',
              ]),
          'Use the buttons below: copy the manifest → open Slack app creator → Create New App → From a manifest → paste → Create.',
          'In the new app: Agents & AI Apps → enable Model Context Protocol (MCP). OAuth & Permissions → opt in to PKCE if shown.',
          'Basic Information → copy Client ID and Client Secret → paste below → Connect → approve in browser.',
        ],
      };
    case 'figma':
      return {
        ...base,
        setupMode: 'unavailable',
        title: 'Figma remote MCP',
        docsUrl: 'https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/',
        unavailableReason:
          'Figma remote MCP only allows OAuth from approved clients (Cursor, Claude Code, VS Code). Agent Deck cannot complete OAuth until Figma opens third-party registration. Use Figma in your agent app directly, or add a local MCP with a Figma personal access token.',
        steps: [],
      };
    case 'github':
      return {
        ...base,
        setupMode: 'manual',
        title: 'GitHub',
        docsUrl: 'https://docs.github.com/en/apps/oauth-apps',
        steps: [
          'Create a GitHub OAuth App or use a fine-grained Personal Access Token.',
          `For OAuth app, set callback URL: ${redirectUri}`,
          'Alternatively set Authorization: Bearer <PAT> in service headers.',
          'Paste Client ID and Secret below for OAuth, then Connect.',
        ],
      };
    case 'linear':
    case 'notion':
      return {
        ...base,
        setupMode: 'dynamic',
        title: provider === 'linear' ? 'Linear' : 'Notion',
        steps: ['Click Connect — Agent Deck registers automatically and opens the login page.'],
      };
    default:
      return {
        ...base,
        setupMode: 'manual',
        title: 'OAuth application',
        steps: [
          'Create an OAuth app with this MCP provider.',
          `Set redirect URI to: ${redirectUri}`,
          'Paste Client ID and Client Secret below, then Connect.',
        ],
      };
  }
}

export { getOAuthRedirectUri } from '../config/oauth-redirect';
