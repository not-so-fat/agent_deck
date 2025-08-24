import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

export default function OAuthCallback() {
  const [location] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Authenticating...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Parse URL parameters from the current location
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`OAuth Error: ${error}`);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization code or state parameter');
          return;
        }

        // For now, we'll use a hardcoded service ID since we're testing with Notion
        // In a production system, you'd want to encode the service ID in the state parameter
        const serviceId = 'ae0b8862-0b01-446c-8a20-790d57a6a509'; // Notion service ID
        
        if (!serviceId) {
          setStatus('error');
          setMessage('Could not determine service ID from state');
          return;
        }

        // Call our backend to handle the OAuth callback
        const response = await apiRequest('GET', `/api/oauth/${serviceId}/callback?code=${code}&state=${state}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStatus('success');
            setMessage('Authentication successful! This window will close automatically.');
            
            // Close the window after a short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          } else {
            setStatus('error');
            setMessage(data.error || 'Authentication failed');
          }
        } else {
          const errorData = await response.json();
          setStatus('error');
          setMessage(errorData.error || 'Authentication failed');
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


