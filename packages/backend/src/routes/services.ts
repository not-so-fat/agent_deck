import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs/promises';
import { getServiceIconPath } from '../services/icon-resolver';
import { 
  CreateServiceInput, 
  UpdateServiceInput,
  ServiceCallInput,
  ApiResponse,
  Service,
  ServiceTool
} from '@agent-deck/shared';

interface CreateServiceRequest {
  Body: CreateServiceInput;
}

interface UpdateServiceRequest {
  Params: { id: string };
  Body: UpdateServiceInput;
}

interface ServiceCallRequest {
  Params: { id: string };
  Body: { toolName: string; arguments: any };
}

interface ServiceIdRequest {
  Params: { id: string };
}

function mimeFromIconBuffer(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return 'image/x-icon';
  }
  return 'application/octet-stream';
}

export async function registerServiceRoutes(fastify: FastifyInstance) {
  // Create service
  fastify.post<CreateServiceRequest>('/', async (request, reply) => {
    try {
      const service = await fastify.serviceManager.createService(request.body);
      
      const response: ApiResponse<Service> = {
        success: true,
        data: service,
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

  // Get all services
  fastify.get('/', async (request, reply) => {
    try {
      const services = await fastify.serviceManager.getAllServices();
      
      const response: ApiResponse<Service[]> = {
        success: true,
        data: services,
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

  // Cached service icon (must be registered before /:id)
  fastify.get<ServiceIdRequest>('/:id/icon', async (request, reply) => {
    try {
      const iconPath = getServiceIconPath(request.params.id);
      const buffer = await fs.readFile(iconPath);
      return reply.type(mimeFromIconBuffer(buffer)).send(buffer);
    } catch {
      return reply.status(404).send({
        success: false,
        error: 'Icon not found',
      });
    }
  });

  // Refresh favicon for a service
  fastify.post<ServiceIdRequest>('/:id/refresh-icon', async (request, reply) => {
    try {
      const service = await fastify.serviceManager.refreshServiceIcon(request.params.id);

      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse<Service> = {
        success: true,
        data: service,
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

  // Get service by ID
  fastify.get<ServiceIdRequest>('/:id', async (request, reply) => {
    try {
      const service = await fastify.serviceManager.getService(request.params.id);
      
      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse<Service> = {
        success: true,
        data: service,
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

  // Update service
  fastify.put<UpdateServiceRequest>('/:id', async (request, reply) => {
    try {
      const service = await fastify.serviceManager.updateService(request.params.id, request.body);
      
      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse<Service> = {
        success: true,
        data: service,
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

  // Delete service
  fastify.delete<ServiceIdRequest>('/:id', async (request, reply) => {
    try {
      const deleted = await fastify.serviceManager.deleteService(request.params.id);
      
      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        
        return reply.status(404).send(response);
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Service deleted successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'PlaybookDependencyError') {
        const dependencyError = error as import('../playbooks/playbook-manager').PlaybookDependencyError;
        return reply.status(409).send({
          success: false,
          error: dependencyError.message,
          data: dependencyError.dependents,
        } satisfies ApiResponse);
      }
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Discover service tools
  fastify.get<ServiceIdRequest>('/:id/tools', async (request, reply) => {
    try {
      const tools = await fastify.serviceManager.discoverServiceTools(request.params.id);
      
      if ('success' in tools && !tools.success) {
        return reply.status(400).send({
          success: false,
          error: tools.error,
        });
      }

      const response: ApiResponse<ServiceTool[]> = {
        success: true,
        data: tools as ServiceTool[],
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

  // Call service tool
  fastify.post<ServiceCallRequest>('/:id/call', async (request, reply) => {
    try {
      const result = await fastify.serviceManager.callServiceTool({
        serviceId: request.params.id,
        toolName: request.body.toolName,
        arguments: request.body.arguments,
      });
      
      const response: ApiResponse = {
        success: result.success,
        data: result.result,
        error: result.error,
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

  // Check service health
  fastify.get<ServiceIdRequest>('/:id/health', async (request, reply) => {
    try {
      const health = await fastify.serviceManager.checkServiceHealth(request.params.id);
      
      const response: ApiResponse = {
        success: true,
        data: health,
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
}
