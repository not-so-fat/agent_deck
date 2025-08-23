import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
