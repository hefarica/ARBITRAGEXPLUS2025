import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pricesRouter from './routes/prices';

// Cargar variables de entorno
dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.API_PORT || '8009');
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'tu-super-secreto-unico-y-muy-largo-12345!@#$%';

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de autenticación simple
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (apiKey && apiKey === API_SECRET_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
    }
};

// Health check (sin autenticación)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes (con autenticación)
app.use('/api/v1/prices', authMiddleware, pricesRouter);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  ARBITRAGEXPLUS2025 - API Server');
    console.log('========================================');
    console.log();
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log();
    console.log('Available endpoints:');
    console.log(`  POST   /api/v1/prices          - Receive price updates`);
    console.log(`  GET    /api/v1/prices/latest   - Get latest prices`);
    console.log(`  GET    /api/v1/prices/stream   - SSE stream`);
    console.log();
    console.log('Press Ctrl+C to stop');
    console.log();
});

export default app;

