import { Router, Request, Response } from 'express';

const router = Router();

// Almacenamiento en memoria de precios
interface PriceData {
    symbol: string;
    price: number;
    timestamp: number;
    source: string;
}

const latestPrices: Map<string, PriceData> = new Map();

// Clientes SSE conectados
const sseClients: Set<Response> = new Set();

/**
 * POST /api/v1/prices
 * Recibe actualizaciones de precios de los oráculos
 */
router.post('/', (req: Request, res: Response) => {
    try {
        const { symbol, price, timestamp, source } = req.body;

        // Validar datos
        if (!symbol || !price || !timestamp || !source) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: symbol, price, timestamp, source'
            });
        }

        // Almacenar precio
        const priceData: PriceData = {
            symbol,
            price: parseFloat(price),
            timestamp: parseInt(timestamp),
            source
        };

        latestPrices.set(symbol, priceData);

        // Retransmitir a clientes SSE
        broadcastToSSEClients(priceData);

        console.log(`[API] Price update: ${symbol} = ${price} (${source})`);

        res.status(200).json({
            success: true,
            message: 'Price updated successfully'
        });
    } catch (error) {
        console.error('[API] Error processing price update:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to process price update'
        });
    }
});

/**
 * GET /api/v1/prices/latest
 * Obtiene los últimos precios almacenados
 */
router.get('/latest', (req: Request, res: Response) => {
    try {
        const symbol = req.query.symbol as string | undefined;

        if (symbol) {
            // Retornar precio específico
            const price = latestPrices.get(symbol.toUpperCase());
            if (price) {
                res.status(200).json(price);
            } else {
                res.status(404).json({
                    error: 'Not Found',
                    message: `Price for symbol ${symbol} not found`
                });
            }
        } else {
            // Retornar todos los precios
            const allPrices = Array.from(latestPrices.values());
            res.status(200).json({
                count: allPrices.length,
                prices: allPrices
            });
        }
    } catch (error) {
        console.error('[API] Error fetching latest prices:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch latest prices'
        });
    }
});

/**
 * GET /api/v1/prices/stream
 * Server-Sent Events (SSE) para streaming de precios en tiempo real
 */
router.get('/stream', (req: Request, res: Response) => {
    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Agregar cliente a la lista
    sseClients.add(res);
    console.log(`[API] SSE client connected (total: ${sseClients.size})`);

    // Enviar mensaje de bienvenida
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to price stream' })}\n\n`);

    // Enviar precios actuales
    const allPrices = Array.from(latestPrices.values());
    res.write(`data: ${JSON.stringify({ type: 'snapshot', prices: allPrices })}\n\n`);

    // Manejar desconexión del cliente
    req.on('close', () => {
        sseClients.delete(res);
        console.log(`[API] SSE client disconnected (total: ${sseClients.size})`);
    });
});

/**
 * Retransmite datos de precios a todos los clientes SSE conectados
 */
function broadcastToSSEClients(priceData: PriceData): void {
    const message = JSON.stringify({
        type: 'price_update',
        data: priceData
    });

    sseClients.forEach((client) => {
        try {
            client.write(`data: ${message}\n\n`);
        } catch (error) {
            console.error('[API] Error sending to SSE client:', error);
            sseClients.delete(client);
        }
    });
}

export default router;

