/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/test/setup.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

/**
 * Jest Setup File
 * 
 * Configuración global para todos los tests
 */

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Solo errores en tests

// Mock de servicios externos
jest.mock('../src/config/redis', () => ({
  redisService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    isReady: true,
  },
}));

jest.mock('../src/config/database', () => ({
  databaseService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isReady: true,
  },
}));

// Mock de SheetsService
jest.mock('../src/services/sheetsService', () => ({
  SheetsService: jest.fn().mockImplementation(() => ({
    getDEXes: jest.fn().mockResolvedValue([
      {
        DEX_ID: 'uniswap-v3-eth',
        DEX_NAME: 'Uniswap V3',
        DEX_TYPE: 'uniswap',
        CHAIN_ID: '1',
        VERSION: 'v3',
        ROUTER_ADDRESS: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        FACTORY_ADDRESS: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        IS_ACTIVE: 'TRUE',
      },
    ]),
    getAssets: jest.fn().mockResolvedValue([
      {
        TOKEN_SYMBOL: 'ETH',
        TOKEN_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        CHAIN_ID: '1',
        DECIMALS: '18',
        IS_ACTIVE: 'TRUE',
      },
      {
        TOKEN_SYMBOL: 'USDC',
        TOKEN_ADDRESS: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        CHAIN_ID: '1',
        DECIMALS: '6',
        IS_ACTIVE: 'TRUE',
      },
    ]),
    getPools: jest.fn().mockResolvedValue([
      {
        POOL_ID: 'uniswap-v3-eth-usdc',
        DEX_ID: 'uniswap-v3-eth',
        POOL_ADDRESS: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
        TOKEN_A: 'ETH',
        TOKEN_B: 'USDC',
        TOKEN_A_SYMBOL: 'ETH',
        TOKEN_B_SYMBOL: 'USDC',
        FEE_BPS: '30',
        IS_ACTIVE: 'TRUE',
      },
    ]),
    recordExecution: jest.fn().mockResolvedValue(undefined),
    recordAlert: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Configurar timeouts globales
jest.setTimeout(30000);

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});

// Limpiar todos los mocks al final
afterAll(() => {
  jest.restoreAllMocks();
});

console.log('✅ Jest setup complete');

