/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/routes/index.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: fastify
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: routes
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - fastify
 * 
 * ============================================================================
 */

import { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  app.get('/api', async () => ({ message: 'API Routes' }));
}
