import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '../lib/errors.js';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    throw new ApiError('Unauthorized', 401);
  }
}
