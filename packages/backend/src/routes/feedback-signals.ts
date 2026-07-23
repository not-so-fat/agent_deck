import { FastifyInstance } from 'fastify';
import {
  ApiResponse,
  DiscardFeedbackSignalsSchema,
  ImportFeedbackSignalsSchema,
  FeedbackSignalStatusSchema,
  generateShortId,
  type DiscardFeedbackSignalsResult,
  type FeedbackSignal,
  type FeedbackSignalCount,
  type FeedbackSignalStatus,
  type ImportFeedbackSignalsResult,
} from '@agent-deck/shared';
import { requireDashboardClient } from '../lib/client-scope';

function parseBoolQuery(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return undefined;
}

/** Feedback data browse/discard/import — dashboard only. Capture stays on MCP propose. */
export async function registerFeedbackSignalRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      status?: string;
      playbookId?: string;
      deckId?: string;
      excludeInProposal?: string;
    };
  }>('/', async (request, reply) => {
    try {
      requireDashboardClient(request);
      let status: FeedbackSignalStatus | undefined;
      if (request.query.status) {
        status = FeedbackSignalStatusSchema.parse(request.query.status);
      }
      const signals = await fastify.db.listFeedbackSignals({
        status,
        candidatePlaybookId: request.query.playbookId,
        candidateDeckId: request.query.deckId,
        excludeInProposal: parseBoolQuery(request.query.excludeInProposal),
      });
      return reply.send({
        success: true,
        data: signals,
      } satisfies ApiResponse<FeedbackSignal[]>);
    } catch (error) {
      const statusCode =
        error instanceof Error && error.name === 'ZodError'
          ? 400
          : 403;
      return reply.status(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Forbidden',
      } satisfies ApiResponse);
    }
  });

  fastify.get<{
    Querystring: { status?: string; playbookId?: string; available?: string };
  }>('/count', async (request, reply) => {
    try {
      requireDashboardClient(request);
      const available = parseBoolQuery(request.query.available);
      // Badge default: available open (not already in a proposed patch).
      if (available !== false && !request.query.status) {
        const open = await fastify.db.countFeedbackSignals({
          status: 'open',
          playbookId: request.query.playbookId,
          excludeInProposal: true,
        });
        return reply.send({
          success: true,
          data: { open } satisfies FeedbackSignalCount,
        } satisfies ApiResponse<FeedbackSignalCount>);
      }
      const status =
        request.query.status === 'actioned' || request.query.status === 'discarded'
          ? request.query.status
          : 'open';
      const open = await fastify.db.countFeedbackSignals({
        status,
        playbookId: request.query.playbookId,
        excludeInProposal: available === true,
      });
      return reply.send({
        success: true,
        data: { open } satisfies FeedbackSignalCount,
      } satisfies ApiResponse<FeedbackSignalCount>);
    } catch (error) {
      return reply.status(403).send({
        success: false,
        error: error instanceof Error ? error.message : 'Forbidden',
      } satisfies ApiResponse);
    }
  });

  fastify.post('/discard', async (request, reply) => {
    try {
      requireDashboardClient(request);
      const body = DiscardFeedbackSignalsSchema.parse(request.body);
      const ids: string[] = [];
      for (const id of body.signalIds) {
        const existing = await fastify.db.getFeedbackSignal(id);
        if (!existing || existing.status !== 'open') continue;
        await fastify.db.updateFeedbackSignalStatus(id, 'discarded', null);
        ids.push(id);
      }
      return reply.send({
        success: true,
        data: {
          discarded: ids.length,
          ids,
        } satisfies DiscardFeedbackSignalsResult,
      } satisfies ApiResponse<DiscardFeedbackSignalsResult>);
    } catch (error) {
      const statusCode =
        error instanceof Error && error.name === 'ZodError'
          ? 400
          : error instanceof Error && error.message.toLowerCase().includes('dashboard')
            ? 403
            : 400;
      return reply.status(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies ApiResponse);
    }
  });

  fastify.post('/import', async (request, reply) => {
    try {
      requireDashboardClient(request);
      const raw = request.body as { signals?: unknown };
      if (!raw || !Array.isArray(raw.signals) || raw.signals.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'signals array is required and must be non-empty',
        } satisfies ApiResponse);
      }

      const ids: string[] = [];
      const errors: ImportFeedbackSignalsResult['errors'] = [];

      for (let index = 0; index < raw.signals.length; index += 1) {
        try {
          const item = ImportFeedbackSignalsSchema.shape.signals.element.parse(raw.signals[index]);
          const created = await fastify.db.createFeedbackSignal({
            id: `fs_${generateShortId()}`,
            source: 'backfill',
            sourceRef: item.sourceRef ?? null,
            failureSummary: item.failureSummary,
            userFeedbackExcerpt: item.userFeedbackExcerpt,
            correctedOutputHint: item.correctedOutputHint ?? null,
            candidatePlaybookId: item.candidatePlaybookId ?? null,
            candidateDeckId: item.candidateDeckId ?? null,
            linkedPatchId: null,
            status: 'open',
          });
          ids.push(created.id);
        } catch (err) {
          errors.push({
            index,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return reply.status(201).send({
        success: true,
        data: {
          inserted: ids.length,
          errors,
          ids,
        } satisfies ImportFeedbackSignalsResult,
      } satisfies ApiResponse<ImportFeedbackSignalsResult>);
    } catch (error) {
      const status = error instanceof Error && error.message.includes('dashboard') ? 403 : 400;
      return reply.status(status).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies ApiResponse);
    }
  });
}
