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
import {
  applyDeckScope,
  DashboardOnlyError,
  getClientScope,
  requireDashboardClient,
} from '../lib/client-scope';
import { AgentDeckContextError, resolveAgentDeckId } from '../lib/agent-deck-context';

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
      const scope = getClientScope(request);
      let visibleDeckId: string | undefined;

      if (scope === 'agent') {
        try {
          visibleDeckId = await resolveAgentDeckId(request, fastify.db);
        } catch (error) {
          if (!(error instanceof AgentDeckContextError)) {
            throw error;
          }
        }
      }

      const decks = await fastify.db.getAllDecks();
      const scopedDecks = decks.map((deck) => applyDeckScope(deck, scope, visibleDeckId));
      
      const response: ApiResponse<Deck[]> = {
        success: true,
        data: scopedDecks,
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

      const scope = getClientScope(request);
      let visibleDeckId: string | undefined;

      if (scope === 'agent') {
        try {
          visibleDeckId = await resolveAgentDeckId(request, fastify.db);
        } catch (error) {
          if (!(error instanceof AgentDeckContextError)) {
            throw error;
          }
        }
      }

      const scopedDeck = applyDeckScope(deck, scope, visibleDeckId);
      
      const response: ApiResponse<Deck> = {
        success: true,
        data: scopedDeck,
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

  // Add credential to deck
  fastify.post<{ Params: { id: string }; Body: { credentialId: string; position?: number } }>(
    '/:id/credentials',
    async (request, reply) => {
      try {
        requireDashboardClient(request);

        await fastify.credentialManager.addToDeck({
          deckId: request.params.id,
          credentialId: request.body.credentialId,
          position: request.body.position,
        });

        fastify.broadcastDeckUpdate({
          deckId: request.params.id,
          action: 'updated',
          data: { credentialId: request.body.credentialId },
        });

        const response: ApiResponse = {
          success: true,
          message: 'Credential added to deck successfully',
        };

        return reply.send(response);
      } catch (error) {
        const response: ApiResponse = {
          success: false,
          error: error instanceof DashboardOnlyError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Unknown error',
        };

        return reply.status(error instanceof DashboardOnlyError ? 403 : 400).send(response);
      }
    },
  );

  // Remove credential from deck
  fastify.delete<{ Params: { id: string }; Body: { credentialId: string } }>(
    '/:id/credentials',
    async (request, reply) => {
      try {
        requireDashboardClient(request);

        await fastify.credentialManager.removeFromDeck({
          deckId: request.params.id,
          credentialId: request.body.credentialId,
        });

        fastify.broadcastDeckUpdate({
          deckId: request.params.id,
          action: 'updated',
          data: { credentialId: request.body.credentialId },
        });

        const response: ApiResponse = {
          success: true,
          message: 'Credential removed from deck successfully',
        };

        return reply.send(response);
      } catch (error) {
        const response: ApiResponse = {
          success: false,
          error: error instanceof DashboardOnlyError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Unknown error',
        };

        return reply.status(error instanceof DashboardOnlyError ? 403 : 400).send(response);
      }
    },
  );

  // Add playbook to deck
  fastify.post<{ Params: { id: string }; Body: { playbookId: string; position?: number } }>(
    '/:id/playbooks',
    async (request, reply) => {
      try {
        requireDashboardClient(request);

        await fastify.playbookManager.addToDeck({
          deckId: request.params.id,
          playbookId: request.body.playbookId,
          position: request.body.position,
        });

        fastify.broadcastDeckUpdate({
          deckId: request.params.id,
          action: 'updated',
          data: { playbookId: request.body.playbookId },
        });

        return reply.send({
          success: true,
          message: 'Playbook added to deck successfully',
        } satisfies ApiResponse);
      } catch (error) {
        return reply.status(error instanceof DashboardOnlyError ? 403 : 400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        } satisfies ApiResponse);
      }
    },
  );

  // Remove playbook from deck
  fastify.delete<{ Params: { id: string }; Body: { playbookId: string } }>(
    '/:id/playbooks',
    async (request, reply) => {
      try {
        requireDashboardClient(request);

        await fastify.playbookManager.removeFromDeck({
          deckId: request.params.id,
          playbookId: request.body.playbookId,
        });

        fastify.broadcastDeckUpdate({
          deckId: request.params.id,
          action: 'updated',
          data: { playbookId: request.body.playbookId },
        });

        return reply.send({
          success: true,
          message: 'Playbook removed from deck successfully',
        } satisfies ApiResponse);
      } catch (error) {
        return reply.status(error instanceof DashboardOnlyError ? 403 : 400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        } satisfies ApiResponse);
      }
    },
  );
}
