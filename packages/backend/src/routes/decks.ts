import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  CreateDeckInput, 
  UpdateDeckInput,
  AddServiceToDeckInput,
  RemoveServiceFromDeckInput,
  ReorderDeckServicesInput,
  ApiResponse,
  Deck
} from '@agent-deck/shared';

interface CreateDeckRequest {
  Body: CreateDeckInput;
}

interface UpdateDeckRequest {
  Params: { id: string };
  Body: UpdateDeckInput;
}

interface DeckIdRequest {
  Params: { id: string };
}

interface AddServiceToDeckRequest {
  Params: { id: string };
  Body: { serviceId: string; position?: number };
}

interface RemoveServiceFromDeckRequest {
  Params: { id: string };
  Body: { serviceId: string };
}

interface ReorderDeckServicesRequest {
  Params: { id: string };
  Body: { serviceIds: string[] };
}

export async function registerDeckRoutes(fastify: FastifyInstance) {
  // Create deck
  fastify.post<CreateDeckRequest>('/', async (request, reply) => {
    try {
      const deck = await fastify.db.createDeck(request.body);
      
      const response: ApiResponse<Deck> = {
        success: true,
        data: deck,
      };
      
      return reply.status(201).send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Get all decks
  fastify.get('/', async (request, reply) => {
    try {
      const decks = await fastify.db.getAllDecks();
      
      const response: ApiResponse<Deck[]> = {
        success: true,
        data: decks,
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Get active deck
  fastify.get('/active', async (request, reply) => {
    try {
      const deck = await fastify.db.getActiveDeck();
      
      if (!deck) {
        const response: ApiResponse = {
          success: false,
          error: 'No active deck found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse<Deck> = {
        success: true,
        data: deck,
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Get deck by ID
  fastify.get<DeckIdRequest>('/:id', async (request, reply) => {
    try {
      const deck = await fastify.db.getDeck(request.params.id);
      
      if (!deck) {
        const response: ApiResponse = {
          success: false,
          error: 'Deck not found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse<Deck> = {
        success: true,
        data: deck,
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Update deck
  fastify.put<UpdateDeckRequest>('/:id', async (request, reply) => {
    try {
      const deck = await fastify.db.updateDeck(request.params.id, request.body);
      
      if (!deck) {
        const response: ApiResponse = {
          success: false,
          error: 'Deck not found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse<Deck> = {
        success: true,
        data: deck,
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Delete deck
  fastify.delete<DeckIdRequest>('/:id', async (request, reply) => {
    try {
      const deleted = await fastify.db.deleteDeck(request.params.id);
      
      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          error: 'Deck not found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Deck deleted successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Set active deck
  fastify.post<DeckIdRequest>('/:id/activate', async (request, reply) => {
    try {
      await fastify.db.setActiveDeck(request.params.id);
      
      // Broadcast deck update via WebSocket
      fastify.broadcastDeckUpdate({
        deckId: request.params.id,
        action: 'updated',
        data: { isActive: true }
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'Deck activated successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Add service to deck
  fastify.post<AddServiceToDeckRequest>('/:id/services', async (request, reply) => {
    try {
      await fastify.db.addServiceToDeck({
        deckId: request.params.id,
        serviceId: request.body.serviceId,
        position: request.body.position,
      });
      
      // Broadcast deck update via WebSocket
      fastify.broadcastDeckUpdate({
        deckId: request.params.id,
        action: 'service_added',
        data: { serviceId: request.body.serviceId }
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'Service added to deck successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Remove service from deck
  fastify.delete<RemoveServiceFromDeckRequest>('/:id/services', async (request, reply) => {
    try {
      await fastify.db.removeServiceFromDeck({
        deckId: request.params.id,
        serviceId: request.body.serviceId,
      });
      
      // Broadcast deck update via WebSocket
      fastify.broadcastDeckUpdate({
        deckId: request.params.id,
        action: 'service_removed',
        data: { serviceId: request.body.serviceId }
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'Service removed from deck successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Reorder deck services
  fastify.put<ReorderDeckServicesRequest>('/:id/services/reorder', async (request, reply) => {
    try {
      await fastify.db.reorderDeckServices({
        deckId: request.params.id,
        serviceIds: request.body.serviceIds,
      });
      
      // Broadcast deck update via WebSocket
      fastify.broadcastDeckUpdate({
        deckId: request.params.id,
        action: 'updated',
        data: { serviceIds: request.body.serviceIds }
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'Deck services reordered successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Clear all services from deck
  fastify.delete<DeckIdRequest>('/:id/services/clear', async (request, reply) => {
    try {
      await fastify.db.clearDeckServices(request.params.id);
      
      // Broadcast deck update via WebSocket
      fastify.broadcastDeckUpdate({
        deckId: request.params.id,
        action: 'service_removed',
        data: { allServices: true }
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'All services removed from deck successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });
}
