import { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  app.get('/api', async () => ({ message: 'API Routes' }));
}
