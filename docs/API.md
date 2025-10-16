# API Documentation

## Endpoints

### Health Check
- `GET /health` - Check API health status

### Configuration
- `GET /config` - Get system configuration
- `GET /config/blockchains` - Get blockchain configurations
- `GET /config/dexes` - Get DEX configurations
- `GET /config/assets` - Get asset configurations
- `GET /config/pools` - Get pool configurations

### Arbitrage
- `GET /arbitrage/opportunities` - Find arbitrage opportunities
- `POST /arbitrage/execute` - Execute arbitrage operation

### Oracles
- `GET /oracles/prices` - Get oracle prices

### WebSocket
- `WS /ws/prices` - Real-time price updates
