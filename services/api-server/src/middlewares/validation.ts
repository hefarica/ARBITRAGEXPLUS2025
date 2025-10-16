import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '../lib/errors.js';

export async function validationMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Validación de request
}
