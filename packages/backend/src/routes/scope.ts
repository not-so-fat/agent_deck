import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiResponse, DeckCardCountsSchema, DeckDisplaySourceSchema } from '@agent-deck/shared';
import { AgentDeckContextError, resolveAgentDeckId } from '../lib/agent-deck-context';
import { isDashboardClient, requireAgentClient, requireDashboardClient } from '../lib/client-scope';
import { formatRepoDeckManifest, loadRepoDeckManifest, RepoDeckManifestError } from '../scope/repo-deck';
import { resolveDeckDisplay } from '../scope/display';

const LiveDisplayBodySchema = z.object({
  mcpSessionId: z.string().min(1),
  workspaceRoot: z.string().min(1),
  deckId: z.string().uuid(),
  deckName: z.string().min(1),
  source: DeckDisplaySourceSchema.exclude(['unbound']),
  cardCounts: DeckCardCountsSchema,
  updatedAt: z.string().datetime(),
});

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

  fastify.get<{ Querystring: { workspaceRoot?: string } }>('/display', async (request, reply) => {
    try {
      const workspaceRoot = request.query.workspaceRoot?.trim();
      if (!workspaceRoot) {
        return reply.status(400).send({
          success: false,
          error: 'workspaceRoot query parameter is required',
        } satisfies ApiResponse);
      }

      const display = await resolveDeckDisplay(
        { workspaceRoot },
        fastify.db,
        fastify.liveDisplayRegistry,
      );
      return reply.send({
        success: true,
        data: display,
      } satisfies ApiResponse);
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies ApiResponse);
    }
  });

  fastify.post('/live-display', async (request, reply) => {
    try {
      requireAgentClient(request);
      const parsed = LiveDisplayBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((issue) => issue.message).join('; '),
        } satisfies ApiResponse);
      }

      fastify.liveDisplayRegistry.upsert(parsed.data);
      return reply.send({ success: true } satisfies ApiResponse);
    } catch (error) {
      return reply.status(403).send({
        success: false,
        error: error instanceof Error ? error.message : 'Forbidden',
      } satisfies ApiResponse);
    }
  });

  fastify.delete<{ Params: { mcpSessionId: string } }>(
    '/live-display/:mcpSessionId',
    async (request, reply) => {
      try {
        requireAgentClient(request);
        const mcpSessionId = request.params.mcpSessionId?.trim();
        if (!mcpSessionId) {
          return reply.status(400).send({
            success: false,
            error: 'mcpSessionId is required',
          } satisfies ApiResponse);
        }

        fastify.liveDisplayRegistry.remove(mcpSessionId);
        return reply.send({ success: true } satisfies ApiResponse);
      } catch (error) {
        return reply.status(403).send({
          success: false,
          error: error instanceof Error ? error.message : 'Forbidden',
        } satisfies ApiResponse);
      }
    },
  );

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
