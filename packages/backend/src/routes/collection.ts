import { FastifyInstance } from 'fastify';
import { ApiResponse } from '@agent-deck/shared';
import { requireDashboardClient, DashboardOnlyError } from '../lib/client-scope';
import { CollectionWarningsPayload } from '../services/collection-warning-service';

function dashboardOnlyResponse(error: unknown): { status: number; body: ApiResponse } {
  const message =
    error instanceof DashboardOnlyError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Unknown error';

  return {
    status: error instanceof DashboardOnlyError ? 403 : 400,
    body: { success: false, error: message },
  };
}

export async function registerCollectionRoutes(fastify: FastifyInstance) {
  fastify.get('/warnings', async (request, reply) => {
    try {
      requireDashboardClient(request);

      const [services, credentials, playbooks] = await Promise.all([
        fastify.db.getAllServices(),
        fastify.db.getAllCredentials(),
        fastify.db.getAllPlaybooks(),
      ]);

      const warnings = await fastify.collectionWarningService.summarize(
        services,
        credentials,
        playbooks,
      );

      return reply.send({ success: true, data: warnings } satisfies ApiResponse<CollectionWarningsPayload>);
    } catch (error) {
      const { status, body } = dashboardOnlyResponse(error);
      return reply.status(status).send(body);
    }
  });
}
