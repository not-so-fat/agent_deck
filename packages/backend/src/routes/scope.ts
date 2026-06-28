import { FastifyInstance } from 'fastify';
import { ApiResponse } from '@agent-deck/shared';
import { AgentDeckContextError, resolveAgentDeckId } from '../lib/agent-deck-context';
import { isDashboardClient, requireDashboardClient } from '../lib/client-scope';
import { formatRepoDeckManifest, loadRepoDeckManifest, RepoDeckManifestError } from '../scope/repo-deck';

export async function registerScopeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { workspaceRoot: string } }>('/resolve', async (request, reply) => {
    try {
      const { workspaceRoot } = request.body;
      if (!workspaceRoot?.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'workspaceRoot is required',
        } satisfies ApiResponse);
      }

      const manifest = await loadRepoDeckManifest(workspaceRoot);
      if (!manifest) {
        return reply.status(404).send({
          success: false,
          error: 'No .agent-deck/deck.yaml found in workspace',
        } satisfies ApiResponse);
      }

      const deck = await fastify.db.getDeck(manifest.deck_id);
      if (!deck) {
        return reply.status(404).send({
          success: false,
          error: `Deck not found: ${manifest.deck_id}`,
        } satisfies ApiResponse);
      }

      return reply.send({
        success: true,
        data: {
          manifest,
          deck,
          manifestPath: '.agent-deck/deck.yaml',
        },
      } satisfies ApiResponse);
    } catch (error) {
      const message =
        error instanceof RepoDeckManifestError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      return reply.status(400).send({
        success: false,
        error: message,
      } satisfies ApiResponse);
    }
  });

  fastify.get('/deck', async (request, reply) => {
    try {
      if (isDashboardClient(request)) {
        return reply.status(400).send({
          success: false,
          error: 'Use GET /api/decks/:id from the dashboard',
        } satisfies ApiResponse);
      }

      const deckId = await resolveAgentDeckId(request, fastify.db);
      const deck = await fastify.db.getDeck(deckId);
      if (!deck) {
        return reply.status(404).send({
          success: false,
          error: 'Deck not found',
        } satisfies ApiResponse);
      }

      return reply.send({
        success: true,
        data: deck,
      } satisfies ApiResponse);
    } catch (error) {
      const status = error instanceof AgentDeckContextError ? 400 : 500;
      return reply.status(status).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies ApiResponse);
    }
  });

  fastify.get<{ Querystring: { deckId?: string; name?: string } }>(
    '/manifest-template',
    async (request, reply) => {
      try {
        requireDashboardClient(request);
        const { deckId, name } = request.query;
        if (!deckId) {
          return reply.status(400).send({
            success: false,
            error: 'deckId query parameter is required',
          } satisfies ApiResponse);
        }

        return reply.send({
          success: true,
          data: {
            path: '.agent-deck/deck.yaml',
            content: formatRepoDeckManifest(deckId, name),
          },
        } satisfies ApiResponse);
      } catch (error) {
        return reply.status(403).send({
          success: false,
          error: error instanceof Error ? error.message : 'Forbidden',
        } satisfies ApiResponse);
      }
    },
  );
}
