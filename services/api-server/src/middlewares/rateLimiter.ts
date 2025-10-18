/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/middlewares/rateLimiter.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: @fastify/rate-limit
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: rateLimiterConfig
 * 
 * 🔗 DEPENDENCIAS:
 *   - @fastify/rate-limit
 * 
 * ============================================================================
 */

import rateLimit from '@fastify/rate-limit';

export const rateLimiterConfig = {
  max: 100,
  timeWindow: '1 minute'
};
