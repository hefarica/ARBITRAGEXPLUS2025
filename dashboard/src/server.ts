/**
 * @file server.ts
 * @description Dashboard server with API endpoints
 * 
 * ARBITRAGEXPLUS2025 - Dashboard Server
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleSheetsClient } from './google-sheets-client';
import { Logger } from './logger';

// Load environment variables
dotenv.config();

// ==================================================================================
// CONFIGURATION
// ==================================================================================

const PORT = parseInt(process.env.PORT || '3001');
const logger = new Logger('DashboardServer');

// ==================================================================================
// APP SETUP
// ==================================================================================

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Sheets client
const sheetsClient = new GoogleSheetsClient();

// ==================================================================================
// API ENDPOINTS
// ==================================================================================

/**
 * GET /api/stats
 * Returns overall system statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await sheetsClient.getStats();
    
    res.json({
      totalBatches: stats.totalBatches || 0,
      totalOperations: stats.totalOperations || 0,
      totalProfit: stats.totalProfit || '0.00',
      successRate: stats.successRate || 0,
      activeChains: stats.activeChains || 0,
    });
  } catch (error) {
    logger.error('Failed to get stats', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/activity
 * Returns recent activity (executions)
 */
app.get('/api/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const activities = await sheetsClient.getExecutions(limit);
    
    res.json(activities);
  } catch (error) {
    logger.error('Failed to get activity', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

/**
 * GET /api/chains
 * Returns chain configurations and status
 */
app.get('/api/chains', async (req, res) => {
  try {
    const chains = await sheetsClient.getChains();
    
    res.json(chains);
  } catch (error) {
    logger.error('Failed to get chains', error);
    res.status(500).json({ error: 'Failed to get chains' });
  }
});

/**
 * GET /api/alerts
 * Returns recent alerts
 */
app.get('/api/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const severity = req.query.severity as string;
    
    const alerts = await sheetsClient.getAlerts(limit, severity);
    
    res.json(alerts);
  } catch (error) {
    logger.error('Failed to get alerts', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/profit-history
 * Returns profit history for charts
 */
app.get('/api/profit-history', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    const history = await sheetsClient.getProfitHistory(timeframe);
    
    res.json(history);
  } catch (error) {
    logger.error('Failed to get profit history', error);
    res.status(500).json({ error: 'Failed to get profit history' });
  }
});

/**
 * GET /api/chain-distribution
 * Returns operations distribution by chain
 */
app.get('/api/chain-distribution', async (req, res) => {
  try {
    const distribution = await sheetsClient.getChainDistribution();
    
    res.json(distribution);
  } catch (error) {
    logger.error('Failed to get chain distribution', error);
    res.status(500).json({ error: 'Failed to get chain distribution' });
  }
});

/**
 * GET /api/gas-history
 * Returns gas usage history
 */
app.get('/api/gas-history', async (req, res) => {
  try {
    const history = await sheetsClient.getGasHistory();
    
    res.json(history);
  } catch (error) {
    logger.error('Failed to get gas history', error);
    res.status(500).json({ error: 'Failed to get gas history' });
  }
});

/**
 * GET /api/success-failed
 * Returns success vs failed operations count
 */
app.get('/api/success-failed', async (req, res) => {
  try {
    const stats = await sheetsClient.getSuccessFailedStats();
    
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get success/failed stats', error);
    res.status(500).json({ error: 'Failed to get success/failed stats' });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

// ==================================================================================
// SERVE DASHBOARD
// ==================================================================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================================================================================
// START SERVER
// ==================================================================================

app.listen(PORT, () => {
  logger.info(`Dashboard server started on port ${PORT}`);
  logger.info(`Dashboard URL: http://localhost:${PORT}`);
});

// ==================================================================================
// ERROR HANDLING
// ==================================================================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
  process.exit(1);
});

