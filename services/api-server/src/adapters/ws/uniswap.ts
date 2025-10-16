import WebSocket from 'ws';
import { Logger } from '../../lib/logger.js';
import { PriceUpdate } from '../../lib/types.js';

export class UniswapAdapter {
  private logger: Logger;
  private ws: WebSocket | null = null;
  private pools: any[];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(pools: any[]) {
    this.logger = new Logger('UniswapAdapter');
    this.pools = pools;
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('🔗 Connecting to Uniswap WebSocket...');
      
      // Endpoint de Uniswap Subgraph WebSocket
      const wsUrl = 'wss://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.logger.info('✅ Connected to Uniswap WebSocket');
        this.reconnectAttempts = 0;
        this.subscribe();
      });
      
      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });
      
      this.ws.on('error', (error: Error) => {
        this.logger.error('❌ Uniswap WebSocket error:', error);
      });
      
      this.ws.on('close', () => {
        this.logger.warn('⚠️ Uniswap WebSocket closed');
        this.handleReconnect();
      });
      
    } catch (error) {
      this.logger.error('❌ Failed to connect to Uniswap:', error);
      throw error;
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Subscribe a los pools configurados
    const poolAddresses = this.pools.map(p => p.address);
    
    const subscription = {
      type: 'start',
      payload: {
        query: `
          subscription {
            pools(where: { id_in: ${JSON.stringify(poolAddresses)} }) {
              id
              token0 { symbol }
              token1 { symbol }
              token0Price
              token1Price
              volumeUSD
              txCount
            }
          }
        `
      }
    };
    
    this.ws.send(JSON.stringify(subscription));
    this.logger.info(`📡 Subscribed to ${poolAddresses.length} Uniswap pools`);
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'data' && message.payload?.data?.pools) {
        const pools = message.payload.data.pools;
        
        pools.forEach((pool: any) => {
          const priceUpdate: PriceUpdate = {
            dex: 'uniswap',
            pool: pool.id,
            token0: pool.token0.symbol,
            token1: pool.token1.symbol,
            price: parseFloat(pool.token0Price),
            timestamp: Date.now(),
            volume: parseFloat(pool.volumeUSD)
          };
          
          // Emitir evento de actualización de precio
          this.emit('priceUpdate', priceUpdate);
        });
      }
    } catch (error) {
      this.logger.error('❌ Error handling Uniswap message:', error);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('❌ Max reconnect attempts reached for Uniswap');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.logger.info(`🔄 Reconnecting to Uniswap in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private emit(event: string, data: any): void {
    // Implementar EventEmitter o callback
    this.logger.debug(`📊 Price update: ${data.token0}/${data.token1} = ${data.price}`);
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
