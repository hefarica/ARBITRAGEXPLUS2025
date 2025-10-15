
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

export class UniswapAdapter extends EventEmitter {
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
    this.pools = pools.filter(pool => pool.name === 'Uniswap'); // Filter for Uniswap pools
    if (this.pools.length === 0) {
      console.warn('No Uniswap pools configured. Adapter will not start.');
      return;
    }
    this.connect();
  }

  private connect(): void {
    if (this.isConnected) return;

    console.log(`Connecting to Uniswap WS at ${this.wsUrl}...`);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to Uniswap WS.');
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
        console.error('Error parsing Uniswap WS message:', error);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      console.warn(`Uniswap WS disconnected: Code=${event.code}, Reason=${event.reason}. Reconnecting...`);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('Uniswap WS error:', error);
      this.ws?.close(); // Close to trigger onclose and reconnect logic
    };
  }

  private subscribeToPools(): void {
    // This is a placeholder. Actual subscription logic depends on the Uniswap WS API.
    // For example, you might send a message like: { "method": "subscribe", "channels": ["trades_ETH-USDT"] }
    this.pools.forEach(pool => {
      pool.pairs.forEach(pair => {
        console.log(`Subscribing to Uniswap ${pool.name} for pair ${pair}`);
        // Simulate sending a subscription message
        // this.ws?.send(JSON.stringify({ type: 'subscribe', channel: `price_${pair}` }));
      });
    });
  }

  private processMessage(data: any): void {
    // This is a placeholder for actual message processing.
    // Assuming data contains price updates for a pair.
    if (data.type === 'price_update' && data.dex === 'Uniswap') {
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
      console.error('Max Uniswap WS reconnect attempts reached. Giving up.');
      this.emit('error', new Error('Max reconnect attempts reached for Uniswap WS.'));
    }
  }

  public stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    console.log('UniswapAdapter stopped.');
  }
}

// Example Usage (for local testing)
// const uniswapAdapter = new UniswapAdapter('wss://some-uniswap-ws-endpoint.com');

// uniswapAdapter.on('priceUpdate', (update: PriceUpdate) => {
//   console.log(`Received price update: ${update.dex} ${update.pair} = ${update.price}`);
// });

// const dummyPools: PoolConfig[] = [
//   { name: 'Uniswap', endpoint: 'https://api.uniswap.org', pairs: ['ETH-USDT', 'WBTC-ETH'] },
//   { name: 'Sushiswap', endpoint: 'https://api.sushiswap.org', pairs: ['LINK-ETH'] }
// ];

// uniswapAdapter.start(dummyPools);

// setTimeout(() => {
//   uniswapAdapter.stop();
// }, 60000); // Stop after 1 minute

