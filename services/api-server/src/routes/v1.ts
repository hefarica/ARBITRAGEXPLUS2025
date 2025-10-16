import { FastifyInstance } from 'fastify';

export async function v1Routes(app: FastifyInstance) {
  app.get('/v1/status', async () => ({ version: '1.0.0', status: 'ok' }));
}
