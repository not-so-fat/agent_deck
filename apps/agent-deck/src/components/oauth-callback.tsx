import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export default function OAuthCallback() {
  const [location] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Authenticating...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Parse URL parameters from the current location
        const url = new URL(window.location.href);
        const success = url.searchParams.get('success');
        const error = url.searchParams.get('error');

        if (success === 'true') {
          setStatus('success');
          setMessage('Authentication successful! This window will close automatically.');
          
          // Close the window after a short delay
          setTimeout(() => {
            window.close();
          }, 2000);
        } else if (success === 'false') {
          setStatus('error');
          setMessage(`OAuth Error: ${error || 'Authentication failed'}`);
        } else {
          // Legacy handling for direct OAuth provider callbacks (shouldn't happen with new flow)
          setStatus('error');
          setMessage('Invalid OAuth callback - please try again');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleOAuthCallback();
  }, [location]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        )}
        {status === 'success' && (
          <div className="text-green-500 text-4xl">✓</div>
        )}
        {status === 'error' && (
          <div className="text-red-500 text-4xl">✗</div>
        )}
        <h1 className="text-xl font-semibold">{message}</h1>
        {status === 'error' && (
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Close Window
          </button>
        )}
      </div>
    </div>
  );
}


