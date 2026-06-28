import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Copy, ClipboardPaste } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type OAuthGuide = {
  provider: string;
  setupMode: 'dynamic' | 'managed' | 'manual' | 'unavailable';
  title: string;
  redirectUri: string;
  steps: string[];
  docsUrl?: string;
  unavailableReason?: string;
  manifestJson?: string;
  createAppUrl?: string;
  easierAlternative?: string;
};

type OAuthConnectPanelProps = {
  serviceId: string;
  onConnected?: () => void;
};

export function OAuthConnectPanel({ serviceId, onConnected }: OAuthConnectPanelProps) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const { data: setupData, isLoading } = useQuery({
    queryKey: ['/api/oauth', serviceId, 'setup'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/oauth/${serviceId}/setup`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to load OAuth setup');
      }
      return json.data as { guide: OAuthGuide };
    },
    enabled: Boolean(serviceId),
  });

  const guide = setupData?.guide;

  const copyToClipboard = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select and copy manually.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (guide?.setupMode === 'manual') {
      setShowManualForm(true);
    } else {
      setShowManualForm(false);
    }
  }, [guide?.setupMode]);

  const runConnect = async (credentials?: { clientId?: string; clientSecret?: string }) => {
    setConnecting(true);
    try {
      const response = await apiRequest('POST', `/api/oauth/${serviceId}/connect`, credentials ?? {});
      const json = await response.json();

      if (!response.ok || !json.success) {
        if (json.data?.needsCredentials || json.data?.setupMode === 'manual') {
          setShowManualForm(true);
        }
        toast({
          title: 'OAuth setup',
          description: json.error || 'Could not start OAuth flow.',
          variant: 'destructive',
        });
        return;
      }

      if (json.data?.authorizationUrl) {
        window.open(json.data.authorizationUrl, '_blank');
        toast({
          title: 'Continue in browser',
          description: 'Complete sign-in in the new tab, then return here.',
        });
        onConnected?.();
      }
    } catch (error) {
      toast({
        title: 'OAuth setup failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-orange-200">Loading OAuth setup…</p>;
  }

  if (!guide) {
    return null;
  }

  if (guide.setupMode === 'unavailable') {
    return (
      <div className="space-y-3 text-sm text-orange-100">
        <p>{guide.unavailableReason}</p>
        {guide.docsUrl && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 text-orange-200"
            onClick={() => window.open(guide.docsUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Provider docs
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-orange-100">
      <div>
        <p className="font-medium text-orange-200">{guide.title}</p>
        <p className="mt-1 text-xs text-orange-100/80">
          Redirect URI:{' '}
          <code className="text-orange-50">{guide.redirectUri}</code>
        </p>
        {guide.easierAlternative && (
          <p className="mt-2 text-xs text-orange-100/70 border-l-2 border-orange-500/30 pl-2">
            {guide.easierAlternative}
          </p>
        )}
      </div>

      {(guide.manifestJson || guide.createAppUrl) && (
        <div className="flex flex-wrap gap-2">
          {guide.manifestJson && (
            <Button
              size="sm"
              variant="outline"
              className="border-orange-500/30 text-orange-200"
              onClick={() => void copyToClipboard('App manifest', guide.manifestJson!)}
            >
              <ClipboardPaste className="w-4 h-4 mr-1" />
              Copy manifest
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 text-orange-200"
            onClick={() => void copyToClipboard('Redirect URI', guide.redirectUri)}
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy redirect URI
          </Button>
          {guide.createAppUrl && (
            <Button
              size="sm"
              variant="outline"
              className="border-orange-500/30 text-orange-200"
              onClick={() => window.open(guide.createAppUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open Slack app creator
            </Button>
          )}
        </div>
      )}

      {guide.steps.length > 0 && (
        <ol className="list-decimal list-inside space-y-1 text-xs">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {showManualForm && guide.setupMode === 'manual' && (
        <div className="space-y-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
          <div className="space-y-1">
            <Label htmlFor={`oauth-client-id-${serviceId}`} className="text-orange-200">
              Client ID
            </Label>
            <Input
              id={`oauth-client-id-${serviceId}`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="OAuth Client ID"
              className="bg-black/20 border-orange-500/30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`oauth-client-secret-${serviceId}`} className="text-orange-200">
              Client Secret
            </Label>
            <Input
              id={`oauth-client-secret-${serviceId}`}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="OAuth Client Secret"
              className="bg-black/20 border-orange-500/30"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-orange-600 hover:bg-orange-700"
          disabled={connecting || (showManualForm && guide.setupMode === 'manual' && !clientId.trim())}
          onClick={() =>
            runConnect(
              showManualForm && guide.setupMode === 'manual'
                ? { clientId: clientId.trim(), clientSecret: clientSecret.trim() }
                : undefined,
            )
          }
        >
          {connecting ? 'Connecting…' : guide.setupMode === 'dynamic' || guide.setupMode === 'managed' ? 'Connect' : 'Connect with credentials'}
        </Button>
        {guide.docsUrl && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 text-orange-200"
            onClick={() => window.open(guide.docsUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Docs
          </Button>
        )}
      </div>
    </div>
  );
}
