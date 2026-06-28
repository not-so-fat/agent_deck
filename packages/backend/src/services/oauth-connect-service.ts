import { MCPDiscoveryService } from './mcp-discovery-service';
import { OAuthManager } from './oauth-manager';
import { DatabaseManager } from '../models/database';
import {
  getOAuthProviderGuide,
  getOAuthRedirectUri,
  inferOAuthProvider,
  resolveOAuthSetupMode,
  type OAuthProviderGuide,
} from '../data/oauth-provider-guides';
import { getSharedOAuthCredentials } from '../config/shared-oauth-apps';

export type OAuthConnectInput = {
  clientId?: string;
  clientSecret?: string;
};

export type OAuthConnectResult =
  | {
      success: true;
      authorizationUrl: string;
      state: string;
      mode: 'dynamic' | 'manual' | 'managed';
    }
  | {
      success: false;
      needsCredentials: boolean;
      setupMode: OAuthProviderGuide['setupMode'];
      guide: OAuthProviderGuide;
      error: string;
    };

export async function getOAuthSetupInfo(
  db: DatabaseManager,
  serviceId: string,
): Promise<{ guide: OAuthProviderGuide; discovery: Awaited<ReturnType<MCPDiscoveryService['discoverService']>> }> {
  const service = await db.getService(serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  const discoveryService = new MCPDiscoveryService();
  const discovery = await discoveryService.discoverService(service.url);
  const provider = discovery.oauth.provider
    ?? inferOAuthProvider(service.url, []);
  const setupMode = resolveOAuthSetupMode(provider, discovery.oauth.supportsDynamicRegistration);
  const guide = { ...getOAuthProviderGuide(provider), setupMode };

  return { guide, discovery };
}

export async function startOAuthConnect(
  db: DatabaseManager,
  oauthManager: OAuthManager,
  serviceId: string,
  input: OAuthConnectInput = {},
): Promise<OAuthConnectResult> {
  const service = await db.getService(serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  const discoveryService = new MCPDiscoveryService();
  const mcpDiscovery = await discoveryService.discoverService(service.url);

  if (!mcpDiscovery.oauth.required) {
    throw new Error('Service does not require OAuth authentication');
  }

  const provider =
    mcpDiscovery.oauth.provider ?? inferOAuthProvider(service.url, []);
  const setupMode = resolveOAuthSetupMode(provider, mcpDiscovery.oauth.supportsDynamicRegistration);
  const guide = { ...getOAuthProviderGuide(provider), setupMode };

  if (guide.setupMode === 'unavailable') {
    return {
      success: false,
      needsCredentials: false,
      setupMode: guide.setupMode,
      guide,
      error: guide.unavailableReason ?? 'OAuth is not available for this provider in Agent Deck.',
    };
  }

  const redirectUri = getOAuthRedirectUri();
  const scope = mcpDiscovery.oauth.scopesSupported?.length
    ? mcpDiscovery.oauth.scopesSupported.join(' ')
    : 'read write';

  const oauthConfig = {
    clientId: '',
    clientSecret: '',
    authorizationUrl: mcpDiscovery.oauth.authorizationUrl || '',
    tokenUrl: mcpDiscovery.oauth.tokenUrl || '',
    redirectUri,
    scope,
  };

  if (!oauthConfig.authorizationUrl || !oauthConfig.tokenUrl) {
    return {
      success: false,
      needsCredentials: false,
      setupMode: guide.setupMode,
      guide,
      error: 'Could not discover OAuth authorization and token URLs for this service.',
    };
  }

  const manualClientId = input.clientId?.trim() || service.oauthClientId?.trim();
  const manualClientSecret = input.clientSecret?.trim() || service.oauthClientSecret?.trim();

  let clientId = manualClientId;
  let clientSecret = manualClientSecret;
  let mode: 'dynamic' | 'manual' | 'managed' = manualClientId ? 'manual' : 'dynamic';

  const shared = !manualClientId ? getSharedOAuthCredentials(provider) : null;
  if (shared) {
    clientId = shared.clientId;
    clientSecret = shared.clientSecret;
    mode = 'managed';
  } else if (!clientId) {
    const registration = await oauthManager.autoRegisterOAuthApp(service.url, oauthConfig);
    if (!registration.success || !registration.clientId) {
      return {
        success: false,
        needsCredentials: true,
        setupMode: 'manual',
        guide: { ...getOAuthProviderGuide(provider), setupMode: 'manual' },
        error:
          guide.setupMode === 'manual'
            ? 'Add your OAuth Client ID and Client Secret below, then click Connect.'
            : registration.error ?? 'Failed to register OAuth application automatically.',
      };
    }
    clientId = registration.clientId;
    clientSecret = registration.clientSecret;
    mode = 'dynamic';
  }

  await db.updateService(serviceId, {
    oauthClientId: clientId,
    oauthClientSecret: clientSecret,
    oauthAuthorizationUrl: oauthConfig.authorizationUrl,
    oauthTokenUrl: oauthConfig.tokenUrl,
    oauthRedirectUri: redirectUri,
    oauthScope: scope,
  });

  const { authorizationUrl, state } = await oauthManager.initiateOAuthFlow({
    serviceId,
    redirectUri,
  });

  return {
    success: true,
    authorizationUrl,
    state,
    mode,
  };
}
