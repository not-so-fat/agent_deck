import { useEffect } from 'react';
import { onMcpAuthorization } from 'use-mcp';

export default function OAuthCallback() {
  useEffect(() => {
    onMcpAuthorization();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <h1 className="text-xl font-semibold">Authenticating...</h1>
        <p className="text-muted-foreground">
          This window should close automatically once authentication is complete.
        </p>
      </div>
    </div>
  );
}
