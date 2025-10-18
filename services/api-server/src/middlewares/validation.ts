/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/middlewares/validation.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ../lib/errors.js, fastify
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: validationMiddleware
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - ../lib/errors.js
 *   - fastify
 * 
 * ============================================================================
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '../lib/errors.js';

export async function validationMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Validación de request
}
