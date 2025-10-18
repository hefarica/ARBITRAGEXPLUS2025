/**
 * ============================================================================
 * ARCHIVO: ./ARBITRAGEXPLUS2025/services/api-server/src/server.ts
 * SERVICIO: services
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: fastify, @fastify/cors, @fastify/websocket
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - fastify
 *   - @fastify/cors
 *   - @fastify/websocket
 * 
 * ============================================================================
 */

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';

const app = Fastify({ logger: { level: 'info' } });

// Register CORS
await app.register(cors, { origin: true });
await app.register(websocket);

// Import routes lazily
import { RouteOptions, HTTPMethods } from 'fastify';

type HttpRouteDef = { method: HTTPMethods; url: string; handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>; };
type WsRouteDef = { method: HTTPMethods; url: string; handler: (connection: any, req: any) => void; websocket: true };
type RouteDef = HttpRouteDef | WsRouteDef;
const routes: RouteDef[] = [
  {
    method: 'GET',
    url: '/health',
    handler: async () => ({ status: 'ok', timestamp: new Date().toISOString(), service: 'arbitragexplus-api' })
  },
  {
    method: 'GET',
    url: '/',
    handler: async () => ({ name: 'arbitragexplus-api', version: '1.0.0' })
  },
  {
    method: 'GET',
url: 
    '/ws',
    websocket: true,
    handler: (conn: any, req: any) => {      conn.socket.on('message', (message: Buffer) => {
        // Echo back the message
        conn.socket.send(message);
      });
    }
  }
];

for (const r of routes) {
  if ('websocket' in r && r.websocket) {
    app.get(r.url, { websocket: true }, r.handler);
  } else if ('handler' in r) {
    app.route(r as HttpRouteDef);
  }
}

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = '0.0.0.0';
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
