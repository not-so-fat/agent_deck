export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: string;
}

export interface ServiceStatusUpdate {
  serviceId: string;
  isConnected: boolean;
  lastPing?: string;
  health: 'unknown' | 'healthy' | 'unhealthy';
}

export interface DeckUpdate {
  deckId: string;
  action: 'created' | 'updated' | 'deleted' | 'service_added' | 'service_removed';
  data: any;
}
