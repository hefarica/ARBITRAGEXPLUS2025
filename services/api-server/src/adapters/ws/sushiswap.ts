
import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface PriceUpdate {
  dex: string;
  pair: string;
  price: number;
  timestamp: number;
}

interface PoolConfig {
  name: string;
  endpoint: string;
  pairs: string[];
}

export class SushiswapAdapter extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 1000; // 1 second
  private maxReconnectInterval: number = 30000; // 30 seconds
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private pools: PoolConfig[] = [];

  constructor(private wsUrl: string) {
    super();
  }

  public async start(pools: PoolConfig[]): Promise<void> {
    this.pools = pools.filter(pool => pool.name === 'Sushiswap'); // Filter for Sushiswap pools
    if (this.pools.length === 0) {
      console.warn('No Sushiswap pools configured. Adapter will not start.');
      return;
    }
    this.connect();
  }

  private connect(): void {
    if (this.isConnected) return;

    console.log(`Connecting to Sushiswap WS at ${this.wsUrl}...`);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to Sushiswap WS.');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000; // Reset reconnect interval on successful connection
      this.subscribeToPools();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        this.processMessage(data);
      } catch (error) {
        console.error('Error parsing Sushiswap WS message:', error);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      console.warn(`Sushiswap WS disconnected: Code=${event.code}, Reason=${event.reason}. Reconnecting...`);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('Sushiswap WS error:', error);
      this.ws?.close(); // Close to trigger onclose and reconnect logic
    };
  }

  private subscribeToPools(): void {
    // This is a placeholder. Actual subscription logic depends on the Sushiswap WS API.
    this.pools.forEach(pool => {
      pool.pairs.forEach(pair => {
        console.log(`Subscribing to Sushiswap ${pool.name} for pair ${pair}`);
      });
    });
  }

  private processMessage(data: any): void {
    // This is a placeholder for actual message processing.
    if (data.type === 'price_update' && data.dex === 'Sushiswap') {
      const priceUpdate: PriceUpdate = {
        dex: data.dex,
        pair: data.pair,
        price: parseFloat(data.price),
        timestamp: Date.now(),
      };
      this.emit('priceUpdate', priceUpdate);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < 10) { // Limit reconnect attempts
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.maxReconnectInterval);
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('Max Sushiswap WS reconnect attempts reached. Giving up.');
      this.emit('error', new Error('Max reconnect attempts reached for Sushiswap WS.'));
    }
  }

  public stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    console.log('SushiswapAdapter stopped.');
  }
}

