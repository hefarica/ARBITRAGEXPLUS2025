/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/routes/v1.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: fastify
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: v1Routes
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - fastify
 * 
 * ============================================================================
 */

import { FastifyInstance } from 'fastify';

export async function v1Routes(app: FastifyInstance) {
  app.get('/v1/status', async () => ({ version: '1.0.0', status: 'ok' }));
}
