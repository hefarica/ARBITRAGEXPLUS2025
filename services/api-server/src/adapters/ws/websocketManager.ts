/**
 * WebSocket Manager - Gestor principal de conexiones WebSocket
 * 
 * Gestiona conexiones WebSocket a múltiples fuentes de datos:
 * - Pyth Network (precios en tiempo real)
 * - DEX WebSockets (actualizaciones de pools)
 * - Subgraphs (eventos on-chain)
 * 
 * Premisas:
 * 1. Configuración de endpoints desde Google Sheets
 * 2. Manejo dinámico de múltiples conexiones
 * 3. Reconexión automática y manejo de errores
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  type: 'pyth' | 'dex' | 'subgraph';
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  subscriptions?: string[];
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
  source: string;
}

export interface PoolUpdate {
  dexId: string;
  poolAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  timestamp: number;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocket>;
  private configs: Map<string, WebSocketConfig>;
  private reconnectTimers: Map<string, NodeJS.Timeout>;
  private reconnectAttempts: Map<string, number>;
  private isShuttingDown: boolean;

  constructor() {
    super();
    this.connections = new Map();
    this.configs = new Map();
    this.reconnectTimers = new Map();
    this.reconnectAttempts = new Map();
    this.isShuttingDown = false;
  }

  /**
   * Añade y conecta a un WebSocket
   */
  async addConnection(id: string, config: WebSocketConfig): Promise<void> {
    this.configs.set(id, {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config,
    });

    await this.connect(id);
  }

  /**
   * Conecta a un WebSocket específico
   */
  private async connect(id: string): Promise<void> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`No configuration found for connection ${id}`);
    }

    try {
      const ws = new WebSocket(config.url);

      ws.on('open', () => {
        console.log(`[WS] Connected to ${id} (${config.type})`);
        this.reconnectAttempts.set(id, 0);
        
        // Enviar suscripciones si existen
        if (config.subscriptions && config.subscriptions.length > 0) {
          this.subscribe(id, config.subscriptions);
        }

        this.emit('connected', { id, type: config.type });
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(id, config.type, message);
        } catch (error) {
          console.error(`[WS] Error parsing message from ${id}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`[WS] Error on ${id}:`, error.message);
        this.emit('error', { id, error });
      });

      ws.on('close', () => {
        console.log(`[WS] Disconnected from ${id}`);
        this.connections.delete(id);
        
        if (!this.isShuttingDown) {
          this.scheduleReconnect(id);
        }

        this.emit('disconnected', { id, type: config.type });
      });

      this.connections.set(id, ws);
    } catch (error) {
      console.error(`[WS] Failed to connect to ${id}:`, error);
      this.scheduleReconnect(id);
    }
  }

  /**
   * Programa reconexión automática
   */
  private scheduleReconnect(id: string): void {
    const config = this.configs.get(id);
    if (!config) return;

    const attempts = this.reconnectAttempts.get(id) || 0;
    
    if (attempts >= (config.maxReconnectAttempts || 10)) {
      console.error(`[WS] Max reconnect attempts reached for ${id}`);
      this.emit('maxReconnectAttemptsReached', { id });
      return;
    }

    const timer = setTimeout(() => {
      console.log(`[WS] Reconnecting to ${id} (attempt ${attempts + 1})`);
      this.reconnectAttempts.set(id, attempts + 1);
      this.connect(id);
    }, config.reconnectInterval || 5000);

    this.reconnectTimers.set(id, timer);
  }

  /**
   * Maneja mensajes recibidos
   */
  private handleMessage(id: string, type: string, message: any): void {
    switch (type) {
      case 'pyth':
        this.handlePythMessage(id, message);
        break;
      case 'dex':
        this.handleDexMessage(id, message);
        break;
      case 'subgraph':
        this.handleSubgraphMessage(id, message);
        break;
      default:
        console.warn(`[WS] Unknown message type from ${id}:`, type);
    }
  }

  /**
   * Maneja mensajes de Pyth Network
   */
  private handlePythMessage(id: string, message: any): void {
    // Formato de Pyth: { type: 'price_update', price_feed: {...} }
    if (message.type === 'price_update' && message.price_feed) {
      const priceUpdate: PriceUpdate = {
        symbol: message.price_feed.id,
        price: parseFloat(message.price_feed.price),
        confidence: parseFloat(message.price_feed.conf),
        timestamp: Date.now(),
        source: 'pyth',
      };

      this.emit('priceUpdate', priceUpdate);
    }
  }

  /**
   * Maneja mensajes de DEX WebSockets
   */
  private handleDexMessage(id: string, message: any): void {
    // Formato genérico de DEX: { type: 'pool_update', data: {...} }
    if (message.type === 'pool_update' && message.data) {
      const poolUpdate: PoolUpdate = {
        dexId: id,
        poolAddress: message.data.pool,
        token0: message.data.token0,
        token1: message.data.token1,
        reserve0: message.data.reserve0,
        reserve1: message.data.reserve1,
        timestamp: Date.now(),
      };

      this.emit('poolUpdate', poolUpdate);
    }
  }

  /**
   * Maneja mensajes de Subgraphs
   */
  private handleSubgraphMessage(id: string, message: any): void {
    // Formato de Subgraph: { data: {...} }
    if (message.data) {
      this.emit('subgraphUpdate', { id, data: message.data });
    }
  }

  /**
   * Suscribe a tópicos específicos
   */
  subscribe(id: string, topics: string[]): void {
    const ws = this.connections.get(id);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WS] Cannot subscribe to ${id}: connection not ready`);
      return;
    }

    const config = this.configs.get(id);
    if (!config) return;

    // Formato de suscripción depende del tipo
    let subscribeMessage: any;

    switch (config.type) {
      case 'pyth':
        // Pyth: { type: 'subscribe', ids: [...] }
        subscribeMessage = {
          type: 'subscribe',
          ids: topics,
        };
        break;
      case 'dex':
        // DEX genérico: { action: 'subscribe', channels: [...] }
        subscribeMessage = {
          action: 'subscribe',
          channels: topics,
        };
        break;
      case 'subgraph':
        // Subgraph: GraphQL subscription
        subscribeMessage = {
          type: 'start',
          payload: {
            query: topics[0], // Asumimos que topics[0] es la query GraphQL
          },
        };
        break;
    }

    if (subscribeMessage) {
      ws.send(JSON.stringify(subscribeMessage));
      console.log(`[WS] Subscribed to ${topics.length} topics on ${id}`);
    }
  }

  /**
   * Desuscribe de tópicos
   */
  unsubscribe(id: string, topics: string[]): void {
    const ws = this.connections.get(id);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const config = this.configs.get(id);
    if (!config) return;

    let unsubscribeMessage: any;

    switch (config.type) {
      case 'pyth':
        unsubscribeMessage = {
          type: 'unsubscribe',
          ids: topics,
        };
        break;
      case 'dex':
        unsubscribeMessage = {
          action: 'unsubscribe',
          channels: topics,
        };
        break;
      case 'subgraph':
        unsubscribeMessage = {
          type: 'stop',
        };
        break;
    }

    if (unsubscribeMessage) {
      ws.send(JSON.stringify(unsubscribeMessage));
    }
  }

  /**
   * Cierra una conexión específica
   */
  async disconnect(id: string): Promise<void> {
    const ws = this.connections.get(id);
    if (ws) {
      ws.close();
      this.connections.delete(id);
    }

    const timer = this.reconnectTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(id);
    }

    this.configs.delete(id);
    this.reconnectAttempts.delete(id);
  }

  /**
   * Cierra todas las conexiones
   */
  async disconnectAll(): Promise<void> {
    this.isShuttingDown = true;

    // Limpiar todos los timers de reconexión
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Cerrar todas las conexiones
    const closePromises = Array.from(this.connections.entries()).map(
      ([id, ws]) =>
        new Promise<void>((resolve) => {
          ws.once('close', () => resolve());
          ws.close();
        })
    );

    await Promise.all(closePromises);

    this.connections.clear();
    this.configs.clear();
    this.reconnectAttempts.clear();

    console.log('[WS] All connections closed');
  }

  /**
   * Obtiene el estado de una conexión
   */
  getConnectionStatus(id: string): string {
    const ws = this.connections.get(id);
    if (!ws) return 'disconnected';

    switch (ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }

  /**
   * Obtiene estadísticas de todas las conexiones
   */
  getStats(): {
    total: number;
    connected: number;
    disconnected: number;
    byType: Record<string, number>;
  } {
    const stats = {
      total: this.configs.size,
      connected: 0,
      disconnected: 0,
      byType: {} as Record<string, number>,
    };

    for (const [id, config] of this.configs.entries()) {
      const status = this.getConnectionStatus(id);
      
      if (status === 'connected') {
        stats.connected++;
      } else {
        stats.disconnected++;
      }

      stats.byType[config.type] = (stats.byType[config.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Verifica si todas las conexiones están activas
   */
  isHealthy(): boolean {
    for (const id of this.connections.keys()) {
      if (this.getConnectionStatus(id) !== 'connected') {
        return false;
      }
    }
    return this.connections.size > 0;
  }
}
