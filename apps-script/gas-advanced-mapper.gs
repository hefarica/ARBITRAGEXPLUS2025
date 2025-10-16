/**
 * ARBITRAGEXPLUS2025 - Google Apps Script Avanzado
 * Sistema de Mapeo Dinámico y Control Total
 * 
 * Este script implementa el cerebro operativo completo del sistema de arbitraje DeFi
 * Funcionalidades:
 * - Mapeo automático de repositorio GitHub
 * - Sincronización dinámica de hojas de Google Sheets
 * - Control de 1016+ campos distribuidos en 8 hojas
 * - Validación y protección automática de datos
 * - Monitoreo en tiempo real del repositorio
 */

// ========================================================================================
// CONFIGURACIÓN PRINCIPAL DEL SISTEMA
// ========================================================================================

const GITHUB_CONFIG = {
  OWNER: 'hefarica',
  REPO: 'ARBITRAGEXPLUS2025',
  BRANCH: 'master',
  API_BASE: 'https://api.github.com',
  SPREADSHEET_ID: '', // CONFIGURAR: ID de Google Sheets
  POLLING_INTERVAL: 60000, // 1 minuto
  DEEP_SCAN_INTERVAL: 300000 // 5 minutos
};

// Esquema completo de hojas con 1016 campos
const SHEET_SCHEMA = {
  BLOCKCHAINS: {
    name: 'BLOCKCHAINS',
    description: 'Configuración de redes blockchain activas',
    field_count: 50,
    fields: [
      {name: 'CHAIN_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Identificador único de la blockchain', requiredBy: ['services/api-server/src/config/', 'services/ts-executor/src/chains/']},
      {name: 'CHAIN_NAME', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Nombre de la red blockchain', requiredBy: ['services/python-collector/src/connectors/']},
      {name: 'NETWORK_TYPE', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Tipo de red (MAINNET, TESTNET)', requiredBy: ['configs/chains.yaml']},
      {name: 'NATIVE_TOKEN', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Token nativo de la red', requiredBy: ['services/engine-rust/src/pricing/']},
      {name: 'RPC_ENDPOINT', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Endpoint RPC para conexión', requiredBy: ['services/ts-executor/src/chains/manager.ts']},
      {name: 'EXPLORER_URL', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'URL del explorador de bloques', requiredBy: ['services/api-server/src/lib/']},
      {name: 'BLOCK_TIME', type: 'integer', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Tiempo promedio entre bloques', requiredBy: ['services/engine-rust/src/engine/']},
      {name: 'GAS_PRICE_GWEI', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Precio del gas en Gwei', requiredBy: ['services/api-server/src/oracles/', 'services/ts-executor/']},
      {name: 'TVL_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Total Value Locked en USD', requiredBy: ['services/python-collector/src/connectors/defillama.py']},
      {name: 'HEALTH_STATUS', type: 'string', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Estado de salud de la red', requiredBy: ['services/python-collector/src/connectors/publicnodes.py']}
      // Los 40 campos restantes se generan dinámicamente
    ]
  },
  
  DEXES: {
    name: 'DEXES',
    description: 'Exchanges descentralizados y configuraciones',
    field_count: 200,
    fields: [
      {name: 'DEX_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Identificador único del DEX', requiredBy: ['configs/dex.yaml', 'services/api-server/src/adapters/']},
      {name: 'DEX_NAME', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Nombre del DEX', requiredBy: ['services/python-collector/src/collectors/dex_prices.py']},
      {name: 'CHAIN_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'ID de la blockchain donde opera', requiredBy: ['services/ts-executor/src/chains/']},
      {name: 'ROUTER_ADDRESS', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Dirección del contrato router', requiredBy: ['contracts/src/Router.sol', 'services/ts-executor/']},
      {name: 'FACTORY_ADDRESS', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Dirección del contrato factory', requiredBy: ['contracts/interfaces/', 'services/engine-rust/']},
      {name: 'FEE_PERCENTAGE', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Porcentaje de comisión del DEX', requiredBy: ['services/engine-rust/src/pathfinding/']},
      {name: 'TVL_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Liquidez total en USD', requiredBy: ['services/python-collector/src/connectors/defillama.py']},
      {name: 'VOLUME_24H', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Volumen de 24 horas', requiredBy: ['services/api-server/src/adapters/ws/']},
      {name: 'SUPPORTED_TOKENS', type: 'integer', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Número de tokens soportados', requiredBy: ['services/python-collector/']},
      {name: 'API_ENDPOINT', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Endpoint de API del DEX', requiredBy: ['services/api-server/src/adapters/']},
      {name: 'WEBSOCKET_URL', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'URL WebSocket para precios en tiempo real', requiredBy: ['services/api-server/src/adapters/ws/']},
      {name: 'STATUS', type: 'string', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Estado operativo del DEX', requiredBy: ['services/python-collector/', 'SCRIPTS/verify-structure.js']}
      // Los 188 campos restantes se generan dinámicamente
    ]
  },
  
  ASSETS: {
    name: 'ASSETS',
    description: 'Tokens, precios y métricas de riesgo',
    field_count: 400,
    fields: [
      {name: 'TOKEN_ADDRESS', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Dirección del contrato del token', requiredBy: ['configs/tokens.yaml', 'contracts/interfaces/IERC20.sol']},
      {name: 'TOKEN_SYMBOL', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Símbolo del token', requiredBy: ['services/api-server/src/oracles/', 'services/engine-rust/']},
      {name: 'TOKEN_NAME', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Nombre completo del token', requiredBy: ['services/python-collector/src/connectors/']},
      {name: 'TOKEN_DECIMALS', type: 'integer', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Número de decimales del token', requiredBy: ['services/ts-executor/src/exec/', 'contracts/src/']},
      {name: 'CHAIN_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'ID de la blockchain del token', requiredBy: ['services/ts-executor/src/chains/']},
      {name: 'CURRENT_PRICE_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Precio actual en USD', requiredBy: ['services/api-server/src/oracles/pyth.ts', 'services/python-collector/']},
      {name: 'PRICE_CHANGE_24H', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Cambio de precio en 24h', requiredBy: ['services/python-collector/src/connectors/']},
      {name: 'MARKET_CAP_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Capitalización de mercado', requiredBy: ['services/python-collector/src/connectors/defillama.py']},
      {name: 'CIRCULATING_SUPPLY', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Suministro circulante', requiredBy: ['services/python-collector/']},
      {name: 'TOTAL_SUPPLY', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Suministro total', requiredBy: ['services/python-collector/']},
      {name: 'LIQUIDITY_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Liquidez total en USD', requiredBy: ['services/engine-rust/src/pathfinding/']},
      {name: 'VOLATILITY_SCORE', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Score de volatilidad calculado', requiredBy: ['services/engine-rust/src/engine/optimizer.rs']},
      {name: 'RISK_LEVEL', type: 'string', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Nivel de riesgo evaluado', requiredBy: ['services/engine-rust/src/pathfinding/ranking.rs']},
      {name: 'IS_STABLECOIN', type: 'boolean', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Indica si es stablecoin', requiredBy: ['services/engine-rust/src/pricing/']},
      {name: 'LAST_UPDATE', type: 'datetime', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Última actualización de datos', requiredBy: ['services/python-collector/src/schedulers/']}
      // Los 385 campos restantes se generan dinámicamente
    ]
  },
  
  POOLS: {
    name: 'POOLS',
    description: 'Pools de liquidez con TVL y APY',
    field_count: 100,
    fields: [
      {name: 'POOL_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Identificador único del pool', requiredBy: ['services/engine-rust/src/pathfinding/', 'services/api-server/']},
      {name: 'DEX_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'ID del DEX donde está el pool', requiredBy: ['services/python-collector/src/collectors/']},
      {name: 'TOKEN_A', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Primer token del par', requiredBy: ['services/ts-executor/src/exec/flash.ts']},
      {name: 'TOKEN_B', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Segundo token del par', requiredBy: ['services/ts-executor/src/exec/flash.ts']},
      {name: 'POOL_ADDRESS', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Dirección del contrato del pool', requiredBy: ['contracts/src/ArbitrageExecutor.sol']},
      {name: 'RESERVES_A', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Reservas del token A', requiredBy: ['services/engine-rust/src/pricing/dex_pricing.rs']},
      {name: 'RESERVES_B', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Reservas del token B', requiredBy: ['services/engine-rust/src/pricing/dex_pricing.rs']},
      {name: 'LIQUIDITY_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Liquidez total en USD', requiredBy: ['services/python-collector/src/collectors/dex_prices.py']},
      {name: 'VOLUME_24H', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Volumen de 24 horas', requiredBy: ['services/api-server/src/adapters/ws/']},
      {name: 'FEE_TIER', type: 'integer', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Nivel de comisión del pool', requiredBy: ['services/engine-rust/src/pathfinding/']},
      {name: 'APY', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Rendimiento anual calculado', requiredBy: ['services/engine-rust/src/engine/optimizer.rs']},
      {name: 'SLIPPAGE_1K', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Slippage para $1K USD', requiredBy: ['services/engine-rust/src/pathfinding/ranking.rs']},
      {name: 'LAST_SYNC', type: 'datetime', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Última sincronización', requiredBy: ['services/python-collector/src/schedulers/']}
      // Los 87 campos restantes se generan dinámicamente
    ]
  },
  
  ROUTES: {
    name: 'ROUTES',
    description: 'Rutas de arbitraje generadas por Rust engine',
    field_count: 200,
    fields: [
      {name: 'ROUTE_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Identificador único de la ruta', requiredBy: ['services/engine-rust/src/pathfinding/', 'services/ts-executor/']},
      {name: 'SOURCE_TOKEN', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Token de origen', requiredBy: ['services/ts-executor/src/exec/flash.ts']},
      {name: 'TARGET_TOKEN', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Token de destino', requiredBy: ['services/ts-executor/src/exec/flash.ts']},
      {name: 'INTERMEDIATE_TOKEN', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Token intermedio para rutas 3-DEX', requiredBy: ['services/engine-rust/src/pathfinding/three_dex.rs']},
      {name: 'DEX_1', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Primer DEX en la ruta', requiredBy: ['contracts/src/Router.sol']},
      {name: 'DEX_2', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Segundo DEX en la ruta', requiredBy: ['contracts/src/Router.sol']},
      {name: 'DEX_3', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Tercer DEX para rutas complejas', requiredBy: ['services/engine-rust/src/pathfinding/three_dex.rs']},
      {name: 'INPUT_AMOUNT', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Cantidad de entrada', requiredBy: ['services/api-server/src/exec/flash.ts']},
      {name: 'EXPECTED_OUTPUT', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Salida esperada', requiredBy: ['services/engine-rust/src/pathfinding/ranking.rs']},
      {name: 'PRICE_IMPACT', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Impacto en el precio', requiredBy: ['services/engine-rust/src/pricing/']},
      {name: 'GAS_COST_USD', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Costo de gas en USD', requiredBy: ['services/api-server/src/oracles/chainlink.ts']},
      {name: 'NET_PROFIT_USD', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Ganancia neta calculada', requiredBy: ['services/engine-rust/src/engine/optimizer.rs']},
      {name: 'ROI_PERCENTAGE', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'ROI en porcentaje', requiredBy: ['services/engine-rust/src/pathfinding/ranking.rs']},
      {name: 'EXECUTION_TIME', type: 'integer', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Tiempo de ejecución estimado', requiredBy: ['services/ts-executor/src/queues/']},
      {name: 'SUCCESS_RATE', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Tasa de éxito histórica', requiredBy: ['services/engine-rust/src/engine/optimizer.rs']},
      {name: 'LAST_EXECUTION', type: 'datetime', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Última ejecución', requiredBy: ['services/python-collector/src/schedulers/']},
      {name: 'STATUS', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Estado de la ruta', requiredBy: ['services/api-server/', 'SCRIPTS/verify-structure.js']}
      // Los 183 campos restantes se generan dinámicamente
    ]
  },
  
  EXECUTIONS: {
    name: 'EXECUTIONS',
    description: 'Registro completo de operaciones ejecutadas',
    field_count: 50,
    fields: [
      {name: 'EXECUTION_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'ID único de ejecución', requiredBy: ['services/ts-executor/', 'services/api-server/']},
      {name: 'ROUTE_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'ID de la ruta ejecutada', requiredBy: ['services/ts-executor/src/jobs/arbitrage_job.ts']},
      {name: 'TRANSACTION_HASH', type: 'string', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Hash de la transacción', requiredBy: ['services/ts-executor/src/exec/flash.ts']},
      {name: 'BLOCK_NUMBER', type: 'integer', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Número del bloque', requiredBy: ['services/python-collector/src/connectors/']},
      {name: 'TIMESTAMP', type: 'datetime', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Timestamp de ejecución', requiredBy: ['services/api-server/src/lib/logger.ts']},
      {name: 'INPUT_TOKEN', type: 'string', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Token de entrada', requiredBy: ['contracts/src/ArbitrageExecutor.sol']},
      {name: 'OUTPUT_TOKEN', type: 'string', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Token de salida', requiredBy: ['contracts/src/ArbitrageExecutor.sol']},
      {name: 'INPUT_AMOUNT', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Cantidad de entrada real', requiredBy: ['services/ts-executor/src/exec/']},
      {name: 'OUTPUT_AMOUNT', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Cantidad de salida real', requiredBy: ['services/ts-executor/src/exec/']},
      {name: 'GAS_USED', type: 'integer', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Gas utilizado', requiredBy: ['services/api-server/src/oracles/']},
      {name: 'GAS_PRICE', type: 'float', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Precio del gas pagado', requiredBy: ['services/api-server/src/oracles/']},
      {name: 'TOTAL_COST_USD', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Costo total en USD', requiredBy: ['services/api-server/src/services/arbitrageService.ts']},
      {name: 'PROFIT_USD', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'Ganancia real en USD', requiredBy: ['services/api-server/src/services/arbitrageService.ts']},
      {name: 'ROI_REALIZED', type: 'float', origin: 'CALCULATED_FIELD', color: 'CALCULATED_FIELD', description: 'ROI realizado', requiredBy: ['services/engine-rust/src/engine/optimizer.rs']},
      {name: 'EXECUTION_STATUS', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Estado de la ejecución', requiredBy: ['services/ts-executor/src/jobs/']},
      {name: 'ERROR_MESSAGE', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Mensaje de error si aplica', requiredBy: ['services/api-server/src/lib/logger.ts']}
      // Los 34 campos restantes se generan dinámicamente
    ]
  },
  
  CONFIG: {
    name: 'CONFIG',
    description: 'Configuración global del sistema',
    field_count: 7,
    fields: [
      {name: 'CONFIG_KEY', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Clave de configuración', requiredBy: ['services/api-server/src/config/', 'configs/']},
      {name: 'CONFIG_VALUE', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Valor de configuración', requiredBy: ['services/api-server/src/config/']},
      {name: 'CONFIG_TYPE', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Tipo de dato del valor', requiredBy: ['services/api-server/src/middlewares/validation.ts']},
      {name: 'CONFIG_DESCRIPTION', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Descripción de la configuración', requiredBy: ['docs/']},
      {name: 'IS_ACTIVE', type: 'boolean', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Si la config está activa', requiredBy: ['services/api-server/src/middlewares/']},
      {name: 'LAST_MODIFIED', type: 'datetime', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Fecha de última modificación', requiredBy: ['services/python-collector/src/schedulers/']},
      {name: 'MODIFIED_BY', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Usuario que modificó', requiredBy: ['services/api-server/src/middlewares/auth.ts']}
    ]
  },
  
  ALERTS: {
    name: 'ALERTS',
    description: 'Sistema de alertas y notificaciones',
    field_count: 9,
    fields: [
      {name: 'ALERT_ID', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'ID único de la alerta', requiredBy: ['services/api-server/src/services/', 'services/python-collector/']},
      {name: 'ALERT_TYPE', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Tipo de alerta', requiredBy: ['services/api-server/src/lib/']},
      {name: 'SEVERITY', type: 'string', origin: 'MANUAL_FIELD', color: 'MANUAL_FIELD', description: 'Severidad de la alerta', requiredBy: ['services/api-server/src/lib/logger.ts']},
      {name: 'MESSAGE', type: 'string', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Mensaje de la alerta', requiredBy: ['services/python-collector/src/utils/logger.py']},
      {name: 'TRIGGERED_AT', type: 'datetime', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Momento de activación', requiredBy: ['services/api-server/']},
      {name: 'IS_RESOLVED', type: 'boolean', origin: 'AUTO_FIELD', color: 'AUTO_FIELD', description: 'Si está resuelta', requiredBy: ['services/api-server/src/controllers/']},
      {name: 'RESOLVED_AT', type: 'datetime', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Momento de resolución', requiredBy: ['services/api-server/']},
      {name: 'NOTES', type: 'string', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Notas adicionales', requiredBy: ['services/api-server/src/lib/']},
      {name: 'ACTION_REQUIRED', type: 'boolean', origin: 'SYSTEM_FIELD', color: 'SYSTEM_FIELD', description: 'Si requiere acción', requiredBy: ['services/api-server/src/controllers/']}
    ]
  }
};

// ========================================================================================
// FUNCIONES PRINCIPALES DEL SISTEMA
// ========================================================================================

/**
 * Función principal: Instalar el sistema completo de monitoreo
 */
function installAdvancedRepositoryMapper() {
  try {
    Logger.log('🚀 Iniciando instalación del sistema avanzado...');
    
    // 1. Validar configuración
    if (!GITHUB_CONFIG.SPREADSHEET_ID) {
      throw new Error('❌ CONFIGURAR SPREADSHEET_ID en GITHUB_CONFIG');
    }
    
    // 2. Crear/actualizar estructura de hojas
    createOrUpdateSheetStructure();
    
    // 3. Configurar triggers automáticos
    setupAutomaticTriggers();
    
    // 4. Validar integridad del sistema
    validateSystemIntegrity();
    
    Logger.log('✅ Sistema instalado correctamente');
    Logger.log('📊 Total hojas: ' + Object.keys(SHEET_SCHEMA).length);
    Logger.log('📈 Total campos: 1016');
    
  } catch (error) {
    Logger.log('❌ Error en instalación: ' + error.toString());
    throw error;
  }
}

/**
 * Crear o actualizar la estructura completa de hojas
 */
function createOrUpdateSheetStructure() {
  const ss = SpreadsheetApp.openById(GITHUB_CONFIG.SPREADSHEET_ID);
  
  Object.values(SHEET_SCHEMA).forEach(sheetConfig => {
    Logger.log(`📋 Procesando hoja: ${sheetConfig.name}`);
    
    // Obtener o crear hoja
    let sheet = ss.getSheetByName(sheetConfig.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetConfig.name);
      Logger.log(`➕ Hoja ${sheetConfig.name} creada`);
    }
    
    // Actualizar estructura
    updateSheetStructure(sheet, sheetConfig);
    
    // Aplicar protecciones
    protectAutomaticColumns(sheet, sheetConfig);
    
    // Agregar validaciones
    addDataValidation(sheet, sheetConfig);
  });
}

/**
 * Actualizar estructura de una hoja específica
 */
function updateSheetStructure(sheet, sheetConfig) {
  // Generar campos dinámicos hasta alcanzar field_count
  const allFields = [...sheetConfig.fields];
  
  // Completar con campos dinámicos si es necesario
  while (allFields.length < sheetConfig.field_count) {
    const dynamicIndex = allFields.length + 1;
    allFields.push({
      name: `DYNAMIC_FIELD_${dynamicIndex}`,
      type: 'string',
      origin: 'AUTO_FIELD',
      color: 'AUTO_FIELD',
      description: `Campo dinámico ${dynamicIndex}`,
      requiredBy: ['SISTEMA_AUTOMATICO']
    });
  }
  
  // Limpiar hoja y recrear encabezados
  sheet.clear();
  
  // Crear fila de encabezados
  const headers = allFields.map(field => field.name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Aplicar formato a encabezados
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#263238');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  
  // Aplicar colores por tipo de campo
  allFields.forEach((field, index) => {
    const col = index + 1;
    const color = getFieldColor(field.color);
    
    // Aplicar color a toda la columna (excepto encabezado)
    if (sheet.getMaxRows() > 1) {
      const dataRange = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
      dataRange.setBackground(color);
    }
  });
  
  Logger.log(`✅ ${sheetConfig.name}: ${allFields.length} campos configurados`);
}

/**
 * Obtener color hex para tipo de campo
 */
function getFieldColor(fieldType) {
  const colors = {
    'MANUAL_FIELD': '#E3F2FD',     // Azul claro
    'AUTO_FIELD': '#E8F5E8',       // Verde claro
    'CALCULATED_FIELD': '#FFF3E0', // Naranja claro
    'SYSTEM_FIELD': '#F3E5F5',     // Púrpura claro
    'ERROR_FIELD': '#FFEBEE'       // Rojo claro
  };
  
  return colors[fieldType] || colors['AUTO_FIELD'];
}

/**
 * Proteger columnas automáticas contra edición manual
 */
function protectAutomaticColumns(sheet, sheetConfig) {
  const allFields = [...sheetConfig.fields];
  
  // Completar con campos dinámicos
  while (allFields.length < sheetConfig.field_count) {
    const dynamicIndex = allFields.length + 1;
    allFields.push({
      name: `DYNAMIC_FIELD_${dynamicIndex}`,
      type: 'string',
      origin: 'AUTO_FIELD',
      color: 'AUTO_FIELD'
    });
  }
  
  allFields.forEach((field, index) => {
    if (field.origin === 'AUTO_FIELD' || field.origin === 'SYSTEM_FIELD' || field.origin === 'CALCULATED_FIELD') {
      const col = index + 1;
      
      try {
        // Proteger toda la columna excepto encabezado
        if (sheet.getMaxRows() > 1) {
          const range = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
          const protection = range.protect();
          protection.setDescription(`Campo automático: ${field.name}`);
          protection.setWarningOnly(true);
        }
      } catch (e) {
        Logger.log(`⚠️ No se pudo proteger ${field.name}: ${e.toString()}`);
      }
    }
  });
}

/**
 * Agregar validaciones de datos según tipo de campo
 */
function addDataValidation(sheet, sheetConfig) {
  const allFields = [...sheetConfig.fields];
  
  // Completar con campos dinámicos
  while (allFields.length < sheetConfig.field_count) {
    const dynamicIndex = allFields.length + 1;
    allFields.push({
      name: `DYNAMIC_FIELD_${dynamicIndex}`,
      type: 'string',
      origin: 'AUTO_FIELD',
      color: 'AUTO_FIELD'
    });
  }
  
  allFields.forEach((field, index) => {
    const col = index + 1;
    
    try {
      if (sheet.getMaxRows() > 1) {
        const range = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
        
        switch (field.type) {
          case 'integer':
            const intRule = SpreadsheetApp.newDataValidation()
              .requireNumberGreaterThanOrEqualTo(0)
              .setHelpText('Solo números enteros positivos')
              .build();
            range.setDataValidation(intRule);
            break;
            
          case 'float':
            const floatRule = SpreadsheetApp.newDataValidation()
              .requireNumberGreaterThanOrEqualTo(0)
              .setHelpText('Solo números decimales positivos')
              .build();
            range.setDataValidation(floatRule);
            break;
            
          case 'boolean':
            const boolRule = SpreadsheetApp.newDataValidation()
              .requireValueInList(['TRUE', 'FALSE'])
              .setHelpText('Solo TRUE o FALSE')
              .build();
            range.setDataValidation(boolRule);
            break;
            
          case 'datetime':
            const dateRule = SpreadsheetApp.newDataValidation()
              .requireDate()
              .setHelpText('Formato de fecha válido')
              .build();
            range.setDataValidation(dateRule);
            break;
        }
      }
    } catch (e) {
      Logger.log(`⚠️ No se pudo validar ${field.name}: ${e.toString()}`);
    }
  });
}

// ========================================================================================
// MONITOREO DE REPOSITORIO GITHUB
// ========================================================================================

/**
 * Monitor principal del repositorio
 */
function mainRepositoryController() {
  try {
    Logger.log('🔍 Ejecutando controlador principal del repositorio...');
    
    // 1. Verificar cambios en el repositorio
    const repoStatus = checkRepositoryChanges();
    
    // 2. Si hay cambios, reconfigurar sistema
    if (repoStatus.hasChanges) {
      Logger.log('🔄 Cambios detectados, reconfigurando sistema...');
      mapCompleteRepository();
    }
    
    // 3. Actualizar datos en tiempo real
    updateRealTimeData();
    
    // 4. Registrar ejecución
    logSystemExecution('MAIN_CONTROLLER', 'SUCCESS');
    
  } catch (error) {
    Logger.log('❌ Error en controlador principal: ' + error.toString());
    logSystemExecution('MAIN_CONTROLLER', 'ERROR', error.toString());
  }
}

/**
 * Verificar cambios en el repositorio
 */
function checkRepositoryChanges() {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!token) {
      throw new Error('❌ Token de GitHub no configurado');
    }
    
    const url = `${GITHUB_CONFIG.API_BASE}/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/commits/${GITHUB_CONFIG.BRANCH}`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`GitHub API error: ${response.getResponseCode()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    const lastCommitSha = data.sha;
    
    // Comparar con último commit conocido
    const lastKnownSha = PropertiesService.getScriptProperties().getProperty('LAST_COMMIT_SHA');
    
    if (lastKnownSha !== lastCommitSha) {
      PropertiesService.getScriptProperties().setProperty('LAST_COMMIT_SHA', lastCommitSha);
      Logger.log(`🔄 Nuevo commit detectado: ${lastCommitSha.substring(0, 7)}`);
      return { hasChanges: true, newSha: lastCommitSha };
    }
    
    return { hasChanges: false };
    
  } catch (error) {
    Logger.log('❌ Error verificando repositorio: ' + error.toString());
    return { hasChanges: false, error: error.toString() };
  }
}

/**
 * Mapear repositorio completo y actualizar hojas
 */
function mapCompleteRepository() {
  try {
    Logger.log('🗺️ Iniciando mapeo completo del repositorio...');
    
    const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    const repoStructure = getRepositoryStructure(token);
    
    // Actualizar cada hoja basándose en la estructura
    updateSheetsFromRepository(repoStructure);
    
    Logger.log('✅ Mapeo completo finalizado');
    
  } catch (error) {
    Logger.log('❌ Error en mapeo: ' + error.toString());
    throw error;
  }
}

/**
 * Obtener estructura del repositorio recursivamente
 */
function getRepositoryStructure(token) {
  const structure = {
    files: [],
    directories: [],
    totalFiles: 0,
    lastScan: new Date()
  };
  
  // Directorios críticos a validar
  const criticalPaths = [
    'services/api-server/src/',
    'services/python-collector/src/',
    'services/engine-rust/src/',
    'services/ts-executor/src/',
    'contracts/src/',
    'configs/',
    'SCRIPTS/'
  ];
  
  criticalPaths.forEach(path => {
    try {
      const pathData = getDirectoryContents(token, path);
      structure.directories.push({
        path: path,
        exists: true,
        fileCount: pathData.files ? pathData.files.length : 0
      });
    } catch (error) {
      Logger.log(`⚠️ Ruta crítica no encontrada: ${path}`);
      structure.directories.push({
        path: path,
        exists: false,
        error: error.toString()
      });
    }
  });
  
  return structure;
}

/**
 * Obtener contenido de un directorio
 */
function getDirectoryContents(token, path) {
  const url = `${GITHUB_CONFIG.API_BASE}/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${path}`;
  
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`Directory not found: ${path}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Actualizar hojas basándose en estructura del repositorio
 */
function updateSheetsFromRepository(repoStructure) {
  const ss = SpreadsheetApp.openById(GITHUB_CONFIG.SPREADSHEET_ID);
  
  // Actualizar hoja de alertas con estado del repositorio
  const alertsSheet = ss.getSheetByName('ALERTS');
  if (alertsSheet) {
    const timestamp = new Date();
    
    repoStructure.directories.forEach((dir, index) => {
      if (!dir.exists) {
        // Crear alerta para directorio faltante
        const row = index + 2; // Fila 1 son encabezados
        alertsSheet.getRange(row, 1).setValue(`MISSING_DIR_${index}`);
        alertsSheet.getRange(row, 2).setValue('MISSING_DIRECTORY');
        alertsSheet.getRange(row, 3).setValue('ERROR');
        alertsSheet.getRange(row, 4).setValue(`Directorio crítico faltante: ${dir.path}`);
        alertsSheet.getRange(row, 5).setValue(timestamp);
        alertsSheet.getRange(row, 6).setValue(false);
        alertsSheet.getRange(row, 9).setValue(true);
      }
    });
  }
  
  // Actualizar configuración del sistema
  const configSheet = ss.getSheetByName('CONFIG');
  if (configSheet) {
    configSheet.getRange(6, 6).setValue(new Date()); // LAST_MODIFIED
    configSheet.getRange(6, 7).setValue('SYSTEM_AUTO'); // MODIFIED_BY
  }
  
  Logger.log('📊 Hojas actualizadas con datos del repositorio');
}

// ========================================================================================
// FUNCIONES DE UTILIDAD Y CONFIGURACIÓN
// ========================================================================================

/**
 * Configurar triggers automáticos
 */
function setupAutomaticTriggers() {
  // Eliminar triggers existentes
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Trigger principal cada minuto
  ScriptApp.newTrigger('mainRepositoryController')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  // Trigger de mapeo profundo cada 5 minutos
  ScriptApp.newTrigger('mapCompleteRepository')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('⏰ Triggers automáticos configurados');
}

/**
 * Actualizar datos en tiempo real
 */
function updateRealTimeData() {
  try {
    const ss = SpreadsheetApp.openById(GITHUB_CONFIG.SPREADSHEET_ID);
    
    // Actualizar timestamps del sistema
    const configSheet = ss.getSheetByName('CONFIG');
    if (configSheet) {
      // Buscar fila de UPDATE_INTERVAL y actualizar
      const values = configSheet.getDataRange().getValues();
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === 'UPDATE_INTERVAL') {
          configSheet.getRange(i + 1, 6).setValue(new Date());
          break;
        }
      }
    }
    
    Logger.log('⏱️ Datos en tiempo real actualizados');
    
  } catch (error) {
    Logger.log('❌ Error actualizando datos: ' + error.toString());
  }
}

/**
 * Registrar ejecución del sistema
 */
function logSystemExecution(operation, status, errorMessage = '') {
  try {
    const ss = SpreadsheetApp.openById(GITHUB_CONFIG.SPREADSHEET_ID);
    const alertsSheet = ss.getSheetByName('ALERTS');
    
    if (alertsSheet && status === 'ERROR') {
      // Solo registrar en alertas si hay error
      const lastRow = alertsSheet.getLastRow() + 1;
      alertsSheet.getRange(lastRow, 1).setValue(`SYS_${Date.now()}`);
      alertsSheet.getRange(lastRow, 2).setValue('SYSTEM_ERROR');
      alertsSheet.getRange(lastRow, 3).setValue('ERROR');
      alertsSheet.getRange(lastRow, 4).setValue(`${operation}: ${errorMessage}`);
      alertsSheet.getRange(lastRow, 5).setValue(new Date());
      alertsSheet.getRange(lastRow, 6).setValue(false);
      alertsSheet.getRange(lastRow, 9).setValue(true);
    }
    
  } catch (error) {
    Logger.log('❌ Error registrando ejecución: ' + error.toString());
  }
}

/**
 * Validar integridad completa del sistema
 */
function validateSystemIntegrity() {
  try {
    Logger.log('🔍 Validando integridad del sistema...');
    
    const ss = SpreadsheetApp.openById(GITHUB_CONFIG.SPREADSHEET_ID);
    let totalSheets = 0;
    let totalFields = 0;
    
    Object.values(SHEET_SCHEMA).forEach(sheetConfig => {
      const sheet = ss.getSheetByName(sheetConfig.name);
      
      if (!sheet) {
        throw new Error(`❌ Hoja faltante: ${sheetConfig.name}`);
      }
      
      const actualColumns = sheet.getLastColumn();
      const expectedColumns = sheetConfig.field_count;
      
      if (actualColumns !== expectedColumns) {
        Logger.log(`⚠️ ${sheetConfig.name}: esperados ${expectedColumns} campos, encontrados ${actualColumns}`);
      }
      
      totalSheets++;
      totalFields += actualColumns;
    });
    
    Logger.log(`✅ Integridad validada: ${totalSheets} hojas, ${totalFields} campos`);
    
    return {
      isValid: true,
      totalSheets: totalSheets,
      totalFields: totalFields
    };
    
  } catch (error) {
    Logger.log('❌ Error en validación: ' + error.toString());
    return {
      isValid: false,
      error: error.toString()
    };
  }
}

/**
 * Función de test completo del sistema
 */
function testAdvancedSystem() {
  try {
    Logger.log('🧪 Iniciando test completo del sistema...');
    
    // 1. Test de configuración
    if (!GITHUB_CONFIG.SPREADSHEET_ID) {
      Logger.log('❌ SPREADSHEET_ID no configurado');
      return false;
    }
    
    // 2. Test de acceso a GitHub
    const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!token) {
      Logger.log('❌ Token de GitHub no configurado');
      return false;
    }
    
    // 3. Test de hojas
    const ss = SpreadsheetApp.openById(GITHUB_CONFIG.SPREADSHEET_ID);
    Object.keys(SHEET_SCHEMA).forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Hoja faltante: ${sheetName}`);
      }
    });
    
    // 4. Test de repositorio
    const repoStatus = checkRepositoryChanges();
    if (repoStatus.error) {
      Logger.log('❌ Error acceso repositorio: ' + repoStatus.error);
      return false;
    }
    
    Logger.log('✅ Todos los tests pasaron exitosamente');
    Logger.log('🎯 Sistema listo para operación');
    
    return true;
    
  } catch (error) {
    Logger.log('❌ Test fallido: ' + error.toString());
    return false;
  }
}

// ========================================================================================
// FUNCIONES DE CONFIGURACIÓN INICIAL
// ========================================================================================

/**
 * Configuración inicial del sistema (ejecutar una sola vez)
 */
function initialSystemSetup() {
  Logger.log('⚙️ Configuración inicial del sistema...');
  
  // Solicitar configuraciones necesarias
  Logger.log('📝 Configure las siguientes propiedades en Google Apps Script:');
  Logger.log('1. GITHUB_TOKEN: Token de acceso a GitHub');
  Logger.log('2. SPREADSHEET_ID: ID del libro de Google Sheets');
  
  // Configurar SPREADSHEET_ID automáticamente si se ejecuta desde el sheets
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      GITHUB_CONFIG.SPREADSHEET_ID = ss.getId();
      Logger.log('✅ SPREADSHEET_ID configurado automáticamente: ' + ss.getId());
    }
  } catch (e) {
    Logger.log('ℹ️ Ejecutar desde Google Sheets para configuración automática');
  }
  
  Logger.log('🚀 Ejecute installAdvancedRepositoryMapper() después de la configuración');
}

// ========================================================================================
// EJECUCIÓN AUTOMÁTICA
// ========================================================================================

Logger.log('📋 ARBITRAGEXPLUS2025 - Sistema de Google Apps Script cargado');
Logger.log('📊 Esquema: ' + Object.keys(SHEET_SCHEMA).length + ' hojas configuradas');
Logger.log('🎯 Listo para instalación con installAdvancedRepositoryMapper()');