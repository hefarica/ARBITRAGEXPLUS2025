import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
  }
});

await app.register(cors, { origin: true });

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  service: 'arbitragexplus-api'
}));

app.get('/', async () => ({
  name: 'arbitragexplus-api',
  version: '1.0.0',
  status: 'running'
}));

// TODO: Implement actual logic for these endpoints
app.get('/status', async () => ({ message: 'Status endpoint' }));
app.get('/routes/live', async () => ({ message: 'Live routes endpoint' }));
app.get('/rpc/latency', async () => ({ message: 'RPC Latency endpoint' }));
app.get('/alerts', async () => ({ message: 'Alerts endpoint' }));
app.get('/feeds/pyth', async () => ({ message: 'Pyth feeds endpoint' }));
app.post('/sheets/push-config', async () => ({ message: 'Push config endpoint' }));
app.get('/sheets/refresh-pools', async () => ({ message: 'Refresh pools endpoint' }));
app.get('/sheets/sync-thresholds', async () => ({ message: 'Sync thresholds endpoint' }));
app.get('/version', async () => ({ version: '1.0.0' }));

const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

app.listen({ port, host }).then(() => {
  app.log.info(`API listening on http://${host}:${port}`);
}).catch(err => {
  app.log.error(err); process.exit(1);
});

