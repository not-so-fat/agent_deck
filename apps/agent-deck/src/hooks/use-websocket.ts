import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateDashboardServiceQueries,
  isOAuthCompleteMessage,
} from "@/lib/invalidate-dashboard-queries";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/events`;
    
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            setLastMessage(message);
            
            // Handle specific message types and invalidate queries
            if (message.type === 'deck_update') {
              console.log('Received deck update:', message);
              queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
            } else if (message.type === 'service_update') {
              console.log('Received service update:', message);
              invalidateDashboardServiceQueries(
                queryClient,
                typeof message.data?.serviceId === 'string' ? message.data.serviceId : undefined,
              );
            } else if (message.type === 'connection_status') {
              setConnectionStatus(message.status === 'connected' ? 'connected' : 'disconnected');
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            setConnectionStatus('connecting');
            connect();
          }, 3000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('disconnected');
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setConnectionStatus('disconnected');
      }
    };

    connect();

    const handleOAuthComplete = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (!isOAuthCompleteMessage(event.data)) {
        return;
      }
      invalidateDashboardServiceQueries(queryClient, event.data.serviceId);
    };

    window.addEventListener('message', handleOAuthComplete);

    return () => {
      window.removeEventListener('message', handleOAuthComplete);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return {
    connectionStatus,
    lastMessage,
  };
}
