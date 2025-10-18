/**
 * ============================================================================
 * ARCHIVO: ./scripts/expand-sheets-brain.js
 * SERVICIO: expand-sheets-brain.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: getColumnLetter, expandSheetsBrain
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

/**
 * expand-sheets-brain.js
 * 
 * Expande Google Sheets Brain según el esquema del Prompt Supremo Definitivo:
 * - BLOCKCHAINS: 50 campos
 * - DEXES: 200 campos
 * - ASSETS: 400 campos
 * - POOLS: 100 campos
 * - ROUTES: 200 campos
 * - EXECUTIONS: 50 campos
 * - ORACLES: 50 campos
 * - STRATEGIES: 100 campos
 * - FLASH_LOANS: 75 campos
 * - METRICS: 80 campos
 * - LOGS: 50 campos
 * - CONFIG: 7 campos
 * - ALERTS: 9 campos
 * 
 * Total: 1,371+ campos distribuidos en 13 hojas
 */

const { google } = require('googleapis');
const path = require('path');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../keys/gsheets-sa.json');

// Esquema completo según Prompt Supremo
const SHEET_SCHEMA = {
  BLOCKCHAINS: {
    fields: 50,
    color: { red: 0.89, green: 0.95, blue: 0.99 }, // #E3F2FD
    columns: [
      'BLOCKCHAIN_ID', 'NAME', 'CHAIN_ID', 'IS_ACTIVE', 'NATIVE_TOKEN',
      'RPC_URL_1', 'RPC_URL_2', 'RPC_URL_3', 'WSS_URL', 'EXPLORER_URL',
      'BLOCK_TIME_MS', 'GAS_PRICE_GWEI', 'MAX_GAS_PRICE', 'MIN_GAS_PRICE',
      'EIP1559_SUPPORTED', 'BASE_FEE', 'PRIORITY_FEE', 'GAS_LIMIT',
      'MULTICALL_ADDRESS', 'WETH_ADDRESS', 'USDC_ADDRESS', 'USDT_ADDRESS',
      'DAI_ADDRESS', 'SUPPORTED_DEXES', 'SUPPORTED_PROTOCOLS', 'TVL_USD',
      'DAILY_VOLUME_USD', 'TRANSACTION_COUNT', 'AVERAGE_GAS_COST',
      'FINALITY_BLOCKS', 'REORG_PROTECTION', 'MEV_PROTECTION',
      'FLASHBOTS_SUPPORTED', 'PRIVATE_TX_SUPPORTED', 'HEALTH_STATUS',
      'LAST_BLOCK_NUMBER', 'LAST_BLOCK_TIMESTAMP', 'SYNC_STATUS',
      'LATENCY_MS', 'SUCCESS_RATE', 'ERROR_RATE', 'RETRY_COUNT',
      'TIMEOUT_MS', 'MAX_RETRIES', 'CIRCUIT_BREAKER_THRESHOLD',
      'RATE_LIMIT_PER_SECOND', 'NOTES', 'CREATED_AT', 'UPDATED_AT'
    ]
  },
  
  DEXES: {
    fields: 200,
    color: { red: 0.91, green: 0.96, blue: 0.91 }, // #E8F5E8
    columns: [
      // Identificación (10)
      'DEX_ID', 'NAME', 'PROTOCOL', 'VERSION', 'BLOCKCHAIN_ID',
      'IS_ACTIVE', 'CATEGORY', 'TYPE', 'DESCRIPTION', 'WEBSITE',
      
      // Direcciones de contratos (20)
      'ROUTER_ADDRESS', 'FACTORY_ADDRESS', 'QUOTER_ADDRESS', 'POSITION_MANAGER_ADDRESS',
      'SWAP_ROUTER_ADDRESS', 'MULTICALL_ADDRESS', 'WETH_ADDRESS', 'INIT_CODE_HASH',
      'POOL_DEPLOYER_ADDRESS', 'VAULT_ADDRESS', 'BALANCER_VAULT', 'CURVE_REGISTRY',
      'KYBER_FACTORY', 'DODO_PROXY', 'PANCAKE_FACTORY', 'SUSHI_FACTORY',
      'UNISWAP_V2_FACTORY', 'UNISWAP_V3_FACTORY', 'ALGEBRA_FACTORY', 'SOLIDLY_FACTORY',
      
      // Fees y comisiones (15)
      'DEFAULT_FEE_BPS', 'FEE_TIER_1', 'FEE_TIER_2', 'FEE_TIER_3',
      'FEE_TIER_4', 'PROTOCOL_FEE_BPS', 'LP_FEE_BPS', 'SWAP_FEE_BPS',
      'FLASH_LOAN_FEE_BPS', 'WITHDRAWAL_FEE_BPS', 'DEPOSIT_FEE_BPS',
      'PERFORMANCE_FEE_BPS', 'MANAGEMENT_FEE_BPS', 'MIN_FEE', 'MAX_FEE',
      
      // Liquidez y volumen (15)
      'TVL_USD', 'DAILY_VOLUME_USD', 'WEEKLY_VOLUME_USD', 'MONTHLY_VOLUME_USD',
      'TOTAL_POOLS', 'ACTIVE_POOLS', 'TOTAL_PAIRS', 'ACTIVE_PAIRS',
      'TOTAL_LIQUIDITY_PROVIDERS', 'TOTAL_TRADERS', 'AVERAGE_POOL_SIZE',
      'LARGEST_POOL_SIZE', 'SMALLEST_POOL_SIZE', 'MEDIAN_POOL_SIZE', 'POOL_CONCENTRATION',
      
      // Configuración técnica (20)
      'SUPPORTS_FLASH_LOANS', 'SUPPORTS_MULTI_HOP', 'SUPPORTS_EXACT_INPUT',
      'SUPPORTS_EXACT_OUTPUT', 'MAX_HOPS', 'MIN_LIQUIDITY_USD', 'MAX_SLIPPAGE_BPS',
      'DEFAULT_SLIPPAGE_BPS', 'GAS_ESTIMATE_SWAP', 'GAS_ESTIMATE_ADD_LIQUIDITY',
      'GAS_ESTIMATE_REMOVE_LIQUIDITY', 'SUPPORTS_PERMIT', 'SUPPORTS_PERMIT2',
      'SUPPORTS_EIP2612', 'SUPPORTS_MULTICALL', 'BATCH_SIZE', 'TIMEOUT_MS',
      'MAX_RETRIES', 'RETRY_DELAY_MS', 'CIRCUIT_BREAKER_ENABLED',
      
      // APIs y conectividad (15)
      'SUBGRAPH_URL', 'API_URL', 'WSS_URL', 'RPC_URL', 'EXPLORER_URL',
      'DOCS_URL', 'GITHUB_URL', 'DISCORD_URL', 'TWITTER_URL', 'TELEGRAM_URL',
      'API_KEY_REQUIRED', 'RATE_LIMIT_PER_SECOND', 'RATE_LIMIT_PER_MINUTE',
      'RATE_LIMIT_PER_HOUR', 'RATE_LIMIT_PER_DAY',
      
      // Tokens soportados (15)
      'SUPPORTED_TOKENS_COUNT', 'WHITELISTED_TOKENS', 'BLACKLISTED_TOKENS',
      'STABLE_TOKENS', 'WRAPPED_TOKENS', 'NATIVE_TOKEN', 'BASE_TOKENS',
      'QUOTE_TOKENS', 'REWARD_TOKENS', 'GOVERNANCE_TOKENS', 'LP_TOKENS',
      'SYNTHETIC_TOKENS', 'DERIVATIVE_TOKENS', 'EXOTIC_TOKENS', 'CUSTOM_TOKENS',
      
      // Métricas de performance (20)
      'SUCCESS_RATE', 'ERROR_RATE', 'AVERAGE_RESPONSE_TIME_MS', 'P50_RESPONSE_TIME',
      'P95_RESPONSE_TIME', 'P99_RESPONSE_TIME', 'UPTIME_PERCENTAGE', 'DOWNTIME_MINUTES',
      'TOTAL_REQUESTS', 'SUCCESSFUL_REQUESTS', 'FAILED_REQUESTS', 'TIMEOUT_REQUESTS',
      'RETRY_REQUESTS', 'CIRCUIT_BREAKER_TRIPS', 'LAST_ERROR', 'LAST_ERROR_TIMESTAMP',
      'HEALTH_CHECK_URL', 'HEALTH_STATUS', 'LAST_HEALTH_CHECK', 'HEALTH_CHECK_INTERVAL',
      
      // Arbitraje específico (15)
      'ARBITRAGE_ENABLED', 'MIN_PROFIT_USD', 'MIN_PROFIT_BPS', 'MAX_TRADE_SIZE_USD',
      'MIN_TRADE_SIZE_USD', 'OPTIMAL_TRADE_SIZE_USD', 'SLIPPAGE_IMPACT_BPS',
      'PRICE_IMPACT_THRESHOLD', 'LIQUIDITY_DEPTH_USD', 'ORDER_BOOK_DEPTH',
      'BID_ASK_SPREAD_BPS', 'MARKET_MAKER_COUNT', 'ARBITRAGE_OPPORTUNITIES_24H',
      'SUCCESSFUL_ARBITRAGES_24H', 'FAILED_ARBITRAGES_24H',
      
      // Seguridad y auditoría (10)
      'IS_AUDITED', 'AUDIT_FIRM', 'AUDIT_DATE', 'AUDIT_REPORT_URL',
      'BUG_BOUNTY_PROGRAM', 'SECURITY_SCORE', 'RISK_LEVEL', 'INSURANCE_COVERAGE',
      'MULTISIG_REQUIRED', 'TIMELOCK_ENABLED',
      
      // Metadata (15)
      'LOGO_URL', 'ICON_URL', 'BANNER_URL', 'COLOR_PRIMARY', 'COLOR_SECONDARY',
      'TAGS', 'CATEGORIES', 'PRIORITY', 'WEIGHT', 'RANK',
      'POPULARITY_SCORE', 'TRUST_SCORE', 'COMMUNITY_SCORE', 'NOTES',
      'CREATED_AT', 'UPDATED_AT'
    ]
  },
  
  ASSETS: {
    fields: 400,
    color: { red: 0.91, green: 0.96, blue: 0.91 }, // #E8F5E8
    columns: [
      // Identificación básica (15)
      'ASSET_ID', 'SYMBOL', 'NAME', 'BLOCKCHAIN_ID', 'CONTRACT_ADDRESS',
      'IS_ACTIVE', 'IS_NATIVE', 'IS_WRAPPED', 'IS_STABLE', 'IS_SYNTHETIC',
      'TOKEN_TYPE', 'TOKEN_STANDARD', 'DECIMALS', 'TOTAL_SUPPLY', 'CIRCULATING_SUPPLY',
      
      // Precios y mercado (25)
      'PRICE_USD', 'PRICE_ETH', 'PRICE_BTC', 'MARKET_CAP_USD', 'FULLY_DILUTED_VALUATION',
      'VOLUME_24H_USD', 'VOLUME_7D_USD', 'VOLUME_30D_USD', 'PRICE_CHANGE_24H',
      'PRICE_CHANGE_7D', 'PRICE_CHANGE_30D', 'ATH_USD', 'ATH_DATE', 'ATL_USD',
      'ATL_DATE', 'ATH_CHANGE_PERCENTAGE', 'ATL_CHANGE_PERCENTAGE', 'HIGH_24H',
      'LOW_24H', 'OPEN_24H', 'CLOSE_24H', 'VWAP_24H', 'BID_PRICE', 'ASK_PRICE',
      'SPREAD_BPS',
      
      // Oráculos de precios (20)
      'PYTH_PRICE_FEED_ID', 'PYTH_PRICE', 'PYTH_CONFIDENCE', 'PYTH_EXPO',
      'PYTH_PUBLISH_TIME', 'CHAINLINK_FEED_ADDRESS', 'CHAINLINK_PRICE', 'CHAINLINK_DECIMALS',
      'CHAINLINK_ROUND_ID', 'CHAINLINK_UPDATED_AT', 'UMA_PRICE_IDENTIFIER', 'BAND_SYMBOL',
      'DIA_KEY', 'API3_BEACON_ID', 'TELLOR_QUERY_ID', 'REDSTONE_DATA_FEED_ID',
      'ORACLE_PRIMARY', 'ORACLE_SECONDARY', 'ORACLE_TERTIARY', 'ORACLE_AGGREGATION_METHOD',
      
      // Liquidez en DEXes (30)
      'TOTAL_LIQUIDITY_USD', 'UNISWAP_V2_LIQUIDITY', 'UNISWAP_V3_LIQUIDITY',
      'SUSHISWAP_LIQUIDITY', 'PANCAKESWAP_LIQUIDITY', 'CURVE_LIQUIDITY',
      'BALANCER_LIQUIDITY', 'KYBER_LIQUIDITY', 'DODO_LIQUIDITY', 'BANCOR_LIQUIDITY',
      'AVAILABLE_ON_DEXES', 'PRIMARY_DEX', 'SECONDARY_DEX', 'TERTIARY_DEX',
      'DEEPEST_POOL_ADDRESS', 'DEEPEST_POOL_LIQUIDITY', 'SHALLOWEST_POOL_ADDRESS',
      'SHALLOWEST_POOL_LIQUIDITY', 'AVERAGE_POOL_LIQUIDITY', 'MEDIAN_POOL_LIQUIDITY',
      'TOTAL_POOLS_COUNT', 'ACTIVE_POOLS_COUNT', 'LIQUIDITY_CONCENTRATION',
      'LIQUIDITY_FRAGMENTATION', 'LIQUIDITY_SCORE', 'SLIPPAGE_1K_USD', 'SLIPPAGE_10K_USD',
      'SLIPPAGE_100K_USD', 'SLIPPAGE_1M_USD', 'PRICE_IMPACT_THRESHOLD',
      
      // Pares de trading (25)
      'TRADING_PAIRS_COUNT', 'PRIMARY_PAIR', 'SECONDARY_PAIR', 'TERTIARY_PAIR',
      'PAIR_WITH_USDC', 'PAIR_WITH_USDT', 'PAIR_WITH_DAI', 'PAIR_WITH_WETH',
      'PAIR_WITH_WBTC', 'PAIR_WITH_NATIVE', 'MOST_LIQUID_PAIR', 'HIGHEST_VOLUME_PAIR',
      'LOWEST_SPREAD_PAIR', 'MOST_STABLE_PAIR', 'BEST_ARBITRAGE_PAIR',
      'PAIR_CORRELATION_USDC', 'PAIR_CORRELATION_ETH', 'PAIR_CORRELATION_BTC',
      'BASE_TOKEN_PREFERENCE', 'QUOTE_TOKEN_PREFERENCE', 'PREFERRED_ROUTE',
      'ALTERNATIVE_ROUTE_1', 'ALTERNATIVE_ROUTE_2', 'ALTERNATIVE_ROUTE_3',
      'ROUTE_OPTIMIZATION_SCORE',
      
      // Métricas de trading (30)
      'TRADES_24H', 'TRADES_7D', 'TRADES_30D', 'UNIQUE_TRADERS_24H',
      'UNIQUE_TRADERS_7D', 'UNIQUE_TRADERS_30D', 'BUY_VOLUME_24H', 'SELL_VOLUME_24H',
      'BUY_SELL_RATIO', 'AVERAGE_TRADE_SIZE_USD', 'MEDIAN_TRADE_SIZE_USD',
      'LARGEST_TRADE_24H', 'SMALLEST_TRADE_24H', 'WHALE_TRADES_24H',
      'RETAIL_TRADES_24H', 'INSTITUTIONAL_VOLUME_PERCENTAGE', 'RETAIL_VOLUME_PERCENTAGE',
      'MARKET_DEPTH_BID_USD', 'MARKET_DEPTH_ASK_USD', 'ORDER_BOOK_IMBALANCE',
      'VOLUME_WEIGHTED_SPREAD', 'EFFECTIVE_SPREAD', 'REALIZED_SPREAD',
      'ADVERSE_SELECTION_COST', 'MARKET_IMPACT_COEFFICIENT', 'KYLE_LAMBDA',
      'AMIHUD_ILLIQUIDITY', 'ROLL_SPREAD', 'QUOTED_SPREAD', 'PERCENTAGE_SPREAD',
      
      // Volatilidad y riesgo (25)
      'VOLATILITY_24H', 'VOLATILITY_7D', 'VOLATILITY_30D', 'VOLATILITY_90D',
      'VOLATILITY_365D', 'HISTORICAL_VOLATILITY', 'IMPLIED_VOLATILITY',
      'REALIZED_VOLATILITY', 'VOLATILITY_SKEW', 'VOLATILITY_SMILE',
      'BETA_TO_ETH', 'BETA_TO_BTC', 'SHARPE_RATIO', 'SORTINO_RATIO',
      'CALMAR_RATIO', 'MAX_DRAWDOWN', 'MAX_DRAWDOWN_DURATION', 'RECOVERY_TIME',
      'VAR_95', 'VAR_99', 'CVAR_95', 'CVAR_99', 'DOWNSIDE_DEVIATION',
      'UPSIDE_POTENTIAL', 'RISK_SCORE',
      
      // Correlaciones (15)
      'CORRELATION_ETH', 'CORRELATION_BTC', 'CORRELATION_USDC', 'CORRELATION_MARKET',
      'CORRELATION_SECTOR', 'CORRELATION_PEERS', 'COINTEGRATION_ETH',
      'COINTEGRATION_BTC', 'COINTEGRATION_STABLE', 'LEAD_LAG_ETH', 'LEAD_LAG_BTC',
      'CAUSALITY_ETH', 'CAUSALITY_BTC', 'CORRELATION_STABILITY', 'CORRELATION_TREND',
      
      // Arbitraje específico (30)
      'ARBITRAGE_ENABLED', 'MIN_ARBITRAGE_PROFIT_USD', 'MIN_ARBITRAGE_PROFIT_BPS',
      'OPTIMAL_ARBITRAGE_SIZE_USD', 'MAX_ARBITRAGE_SIZE_USD', 'ARBITRAGE_FREQUENCY_24H',
      'SUCCESSFUL_ARBITRAGES_24H', 'FAILED_ARBITRAGES_24H', 'AVERAGE_ARBITRAGE_PROFIT',
      'MEDIAN_ARBITRAGE_PROFIT', 'BEST_ARBITRAGE_PROFIT_24H', 'WORST_ARBITRAGE_LOSS_24H',
      'ARBITRAGE_SUCCESS_RATE', 'ARBITRAGE_WIN_RATE', 'ARBITRAGE_PROFIT_FACTOR',
      'ARBITRAGE_SHARPE_RATIO', 'ARBITRAGE_SORTINO_RATIO', 'ARBITRAGE_MAX_DRAWDOWN',
      'ARBITRAGE_RECOVERY_TIME', 'ARBITRAGE_CONSISTENCY_SCORE', 'CROSS_DEX_OPPORTUNITIES',
      'TRIANGULAR_OPPORTUNITIES', 'FLASH_LOAN_OPPORTUNITIES', 'MEV_OPPORTUNITIES',
      'SANDWICH_ATTACK_RISK', 'FRONTRUN_RISK', 'BACKRUN_OPPORTUNITIES',
      'ARBITRAGE_COMPETITION_LEVEL', 'ARBITRAGE_LATENCY_SENSITIVITY', 'ARBITRAGE_GAS_SENSITIVITY',
      
      // Información del proyecto (20)
      'PROJECT_NAME', 'PROJECT_WEBSITE', 'PROJECT_DESCRIPTION', 'WHITEPAPER_URL',
      'GITHUB_URL', 'TWITTER_URL', 'DISCORD_URL', 'TELEGRAM_URL', 'MEDIUM_URL',
      'COINGECKO_ID', 'COINMARKETCAP_ID', 'DEFILLAMA_ID', 'CATEGORY', 'SECTOR',
      'USE_CASE', 'TECHNOLOGY', 'CONSENSUS_MECHANISM', 'LAUNCH_DATE', 'TEAM_SIZE',
      'BACKING_VCS',
      
      // Seguridad y compliance (20)
      'IS_AUDITED', 'AUDIT_FIRMS', 'AUDIT_DATES', 'AUDIT_REPORTS', 'BUG_BOUNTY_PROGRAM',
      'SECURITY_SCORE', 'RISK_RATING', 'REGULATORY_STATUS', 'KYC_REQUIRED',
      'AML_COMPLIANT', 'BLACKLISTED_ADDRESSES', 'SANCTIONED_ADDRESSES',
      'PAUSABLE', 'UPGRADEABLE', 'PROXY_CONTRACT', 'ADMIN_KEYS', 'MULTISIG_THRESHOLD',
      'TIMELOCK_DURATION', 'EMERGENCY_SHUTDOWN', 'CIRCUIT_BREAKER',
      
      // Tokenomics (25)
      'MAX_SUPPLY', 'INFLATION_RATE', 'DEFLATION_RATE', 'BURN_RATE', 'MINT_RATE',
      'EMISSION_SCHEDULE', 'VESTING_SCHEDULE', 'UNLOCK_SCHEDULE', 'TEAM_ALLOCATION',
      'INVESTOR_ALLOCATION', 'COMMUNITY_ALLOCATION', 'TREASURY_ALLOCATION',
      'LIQUIDITY_ALLOCATION', 'STAKING_REWARDS', 'FARMING_REWARDS', 'GOVERNANCE_POWER',
      'VOTING_WEIGHT', 'PROPOSAL_THRESHOLD', 'QUORUM_REQUIREMENT', 'VOTE_DELAY',
      'VOTE_PERIOD', 'TIMELOCK_DELAY', 'DELEGATION_ENABLED', 'SNAPSHOT_STRATEGY',
      'GOVERNANCE_FORUM',
      
      // Utilidad y casos de uso (15)
      'PRIMARY_USE_CASE', 'SECONDARY_USE_CASE', 'TERTIARY_USE_CASE', 'UTILITY_SCORE',
      'ADOPTION_RATE', 'ACTIVE_USERS', 'DAILY_ACTIVE_USERS', 'MONTHLY_ACTIVE_USERS',
      'TRANSACTION_COUNT_24H', 'UNIQUE_ADDRESSES', 'HOLDER_COUNT', 'WHALE_ADDRESSES',
      'CONCENTRATION_TOP_10', 'CONCENTRATION_TOP_100', 'GINI_COEFFICIENT',
      
      // Metadata y tracking (30)
      'LOGO_URL', 'ICON_URL', 'BANNER_URL', 'COLOR_PRIMARY', 'COLOR_SECONDARY',
      'TAGS', 'LABELS', 'CATEGORIES_LIST', 'WATCHLIST_COUNT', 'FAVORITE_COUNT',
      'ALERT_THRESHOLD_PRICE_HIGH', 'ALERT_THRESHOLD_PRICE_LOW', 'ALERT_THRESHOLD_VOLUME',
      'ALERT_THRESHOLD_LIQUIDITY', 'ALERT_ENABLED', 'NOTIFICATION_CHANNELS',
      'PRIORITY', 'WEIGHT', 'RANK', 'POPULARITY_SCORE', 'TRENDING_SCORE',
      'SENTIMENT_SCORE', 'SOCIAL_VOLUME', 'SOCIAL_DOMINANCE', 'DEVELOPER_ACTIVITY',
      'GITHUB_COMMITS_30D', 'GITHUB_CONTRIBUTORS', 'COMMUNITY_SIZE', 'NOTES',
      'CREATED_AT', 'UPDATED_AT'
    ]
  },
  
  POOLS: {
    fields: 100,
    color: { red: 0.91, green: 0.96, blue: 0.91 }, // #E8F5E8
    columns: [
      'POOL_ID', 'DEX_ID', 'BLOCKCHAIN_ID', 'POOL_ADDRESS', 'IS_ACTIVE',
      'TOKEN0_ID', 'TOKEN1_ID', 'TOKEN0_ADDRESS', 'TOKEN1_ADDRESS',
      'TOKEN0_SYMBOL', 'TOKEN1_SYMBOL', 'TOKEN0_DECIMALS', 'TOKEN1_DECIMALS',
      'RESERVE0', 'RESERVE1', 'RESERVE0_USD', 'RESERVE1_USD', 'TOTAL_LIQUIDITY_USD',
      'FEE_TIER', 'FEE_BPS', 'PROTOCOL_FEE_BPS', 'LP_FEE_BPS',
      'VOLUME_24H_USD', 'VOLUME_7D_USD', 'FEES_24H_USD', 'FEES_7D_USD',
      'APY', 'APR', 'DAILY_APR', 'WEEKLY_APR', 'MONTHLY_APR',
      'TVL_USD', 'TVL_CHANGE_24H', 'TVL_CHANGE_7D', 'LIQUIDITY_DEPTH',
      'PRICE_TOKEN0', 'PRICE_TOKEN1', 'PRICE_IMPACT_1K', 'PRICE_IMPACT_10K',
      'SLIPPAGE_BPS', 'SPREAD_BPS', 'TICK_CURRENT', 'TICK_LOWER', 'TICK_UPPER',
      'SQRT_PRICE_X96', 'LIQUIDITY', 'LIQUIDITY_NET', 'FEE_GROWTH_GLOBAL0_X128',
      'FEE_GROWTH_GLOBAL1_X128', 'OBSERVATION_INDEX', 'OBSERVATION_CARDINALITY',
      'LP_COUNT', 'TRANSACTION_COUNT_24H', 'SWAP_COUNT_24H', 'UNIQUE_TRADERS_24H',
      'BUY_VOLUME_24H', 'SELL_VOLUME_24H', 'BUY_SELL_RATIO',
      'IMPERMANENT_LOSS_24H', 'IMPERMANENT_LOSS_7D', 'IMPERMANENT_LOSS_30D',
      'UTILIZATION_RATE', 'CONCENTRATION_RATIO', 'GINI_COEFFICIENT',
      'ARBITRAGE_ENABLED', 'ARBITRAGE_COUNT_24H', 'ARBITRAGE_VOLUME_24H',
      'ARBITRAGE_PROFIT_24H', 'FLASH_LOAN_ENABLED', 'FLASH_LOAN_COUNT_24H',
      'HEALTH_SCORE', 'RISK_SCORE', 'STABILITY_SCORE', 'EFFICIENCY_SCORE',
      'LAST_SWAP_TIMESTAMP', 'LAST_MINT_TIMESTAMP', 'LAST_BURN_TIMESTAMP',
      'CREATED_BLOCK', 'CREATED_TIMESTAMP', 'POOL_AGE_DAYS',
      'IS_STABLE_PAIR', 'IS_CORRELATED', 'CORRELATION_COEFFICIENT',
      'VOLATILITY_24H', 'VOLATILITY_7D', 'PRICE_CHANGE_24H', 'PRICE_CHANGE_7D',
      'NOTES', 'TAGS', 'PRIORITY', 'WEIGHT', 'RANK',
      'CREATED_AT', 'UPDATED_AT'
    ]
  },
  
  ROUTES: {
    fields: 200,
    color: { red: 1.0, green: 0.95, blue: 0.88 }, // #FFF3E0
    columns: [
      'ROUTE_ID', 'STATUS', 'IS_ACTIVE', 'IS_PROFITABLE', 'ROUTE_TYPE',
      'STRATEGY', 'COMPLEXITY', 'HOP_COUNT', 'DEX_COUNT', 'BLOCKCHAIN_ID',
      
      // Ruta detallada
      'DEX_1_ID', 'DEX_2_ID', 'DEX_3_ID', 'DEX_4_ID',
      'POOL_1_ID', 'POOL_2_ID', 'POOL_3_ID', 'POOL_4_ID',
      'TOKEN_IN_ID', 'TOKEN_OUT_ID', 'TOKEN_INTERMEDIATE_1', 'TOKEN_INTERMEDIATE_2',
      
      // Cantidades y precios
      'AMOUNT_IN', 'AMOUNT_OUT', 'AMOUNT_IN_USD', 'AMOUNT_OUT_USD',
      'PRICE_IN', 'PRICE_OUT', 'PRICE_IMPACT_BPS', 'SLIPPAGE_BPS',
      'EXPECTED_PRICE', 'ACTUAL_PRICE', 'PRICE_DEVIATION_BPS',
      
      // Profit y costos
      'EXPECTED_PROFIT_USD', 'EXPECTED_PROFIT_BPS', 'EXPECTED_PROFIT_PERCENTAGE',
      'MIN_PROFIT_USD', 'MAX_PROFIT_USD', 'PROFIT_RANGE_USD',
      'GAS_COST_USD', 'GAS_COST_GWEI', 'GAS_LIMIT', 'GAS_PRICE',
      'PROTOCOL_FEES_USD', 'SWAP_FEES_USD', 'FLASH_LOAN_FEES_USD',
      'TOTAL_COSTS_USD', 'NET_PROFIT_USD', 'ROI_PERCENTAGE',
      
      // Liquidez y capacidad
      'REQUIRED_LIQUIDITY_USD', 'AVAILABLE_LIQUIDITY_USD', 'LIQUIDITY_UTILIZATION',
      'MAX_TRADE_SIZE_USD', 'OPTIMAL_TRADE_SIZE_USD', 'MIN_TRADE_SIZE_USD',
      'LIQUIDITY_DEPTH_1', 'LIQUIDITY_DEPTH_2', 'LIQUIDITY_DEPTH_3',
      
      // Timing y ejecución
      'DISCOVERY_TIMESTAMP', 'EXPIRY_TIMESTAMP', 'EXECUTION_DEADLINE',
      'TIME_TO_EXPIRY_MS', 'ESTIMATED_EXECUTION_TIME_MS', 'MAX_EXECUTION_TIME_MS',
      'BLOCK_NUMBER_DISCOVERED', 'BLOCK_NUMBER_EXPIRY', 'BLOCKS_TO_EXPIRY',
      
      // Validación de oráculos
      'ORACLE_PRICE_IN', 'ORACLE_PRICE_OUT', 'ORACLE_CONFIDENCE_IN',
      'ORACLE_CONFIDENCE_OUT', 'ORACLE_DEVIATION_BPS', 'ORACLE_STALENESS_MS',
      'ORACLE_VALIDATION_PASSED', 'PRICE_FEED_QUALITY_SCORE',
      
      // Flash loan específico
      'FLASH_LOAN_REQUIRED', 'FLASH_LOAN_PROVIDER', 'FLASH_LOAN_AMOUNT_USD',
      'FLASH_LOAN_FEE_BPS', 'FLASH_LOAN_FEE_USD', 'FLASH_LOAN_AVAILABLE',
      'FLASH_LOAN_CAPACITY_USD', 'FLASH_LOAN_UTILIZATION',
      
      // Riesgo y seguridad
      'RISK_SCORE', 'CONFIDENCE_SCORE', 'STABILITY_SCORE', 'EXECUTION_PROBABILITY',
      'SLIPPAGE_RISK', 'LIQUIDITY_RISK', 'TIMING_RISK', 'GAS_PRICE_RISK',
      'ORACLE_RISK', 'SMART_CONTRACT_RISK', 'MEV_RISK', 'FRONTRUN_RISK',
      'SANDWICH_RISK', 'REORG_RISK', 'OVERALL_RISK_RATING',
      
      // Competencia y MEV
      'COMPETING_BOTS_COUNT', 'MEV_COMPETITION_LEVEL', 'ESTIMATED_COMPETITORS',
      'PRIORITY_FEE_REQUIRED', 'FLASHBOTS_REQUIRED', 'PRIVATE_TX_REQUIRED',
      'BUNDLE_REQUIRED', 'BUNDLE_POSITION', 'BUNDLE_SIZE',
      
      // Métricas históricas
      'SIMILAR_ROUTES_24H', 'SIMILAR_ROUTES_SUCCESS_RATE', 'AVERAGE_PROFIT_SIMILAR',
      'BEST_PROFIT_SIMILAR', 'WORST_PROFIT_SIMILAR', 'EXECUTION_TIME_AVERAGE',
      'EXECUTION_TIME_P50', 'EXECUTION_TIME_P95', 'EXECUTION_TIME_P99',
      
      // Optimización
      'OPTIMIZATION_SCORE', 'ROUTE_EFFICIENCY', 'GAS_EFFICIENCY', 'CAPITAL_EFFICIENCY',
      'TIME_EFFICIENCY', 'ALTERNATIVE_ROUTES_COUNT', 'IS_OPTIMAL_ROUTE',
      'OPTIMIZATION_SUGGESTIONS', 'IMPROVEMENT_POTENTIAL_USD',
      
      // Condiciones de mercado
      'MARKET_CONDITION', 'VOLATILITY_LEVEL', 'LIQUIDITY_CONDITION', 'GAS_PRICE_LEVEL',
      'NETWORK_CONGESTION', 'MEMPOOL_SIZE', 'PENDING_TX_COUNT', 'BLOCK_FULLNESS',
      
      // Ejecución multi-chain
      'IS_CROSS_CHAIN', 'BRIDGE_REQUIRED', 'BRIDGE_PROVIDER', 'BRIDGE_FEE_USD',
      'BRIDGE_TIME_MS', 'SOURCE_CHAIN_ID', 'DESTINATION_CHAIN_ID',
      
      // Tracking y metadata
      'DISCOVERY_METHOD', 'DISCOVERY_SOURCE', 'CALCULATION_VERSION', 'ALGORITHM_VERSION',
      'CONFIDENCE_LEVEL', 'DATA_QUALITY_SCORE', 'VALIDATION_CHECKS_PASSED',
      'VALIDATION_CHECKS_FAILED', 'WARNINGS', 'ERRORS', 'NOTES',
      
      // Priorización
      'PRIORITY', 'WEIGHT', 'RANK', 'QUEUE_POSITION', 'EXECUTION_ORDER',
      'BATCH_ID', 'BATCH_POSITION', 'BATCH_SIZE',
      
      // Resultados (se llenan después de ejecución)
      'EXECUTION_STATUS', 'EXECUTION_TIMESTAMP', 'EXECUTION_BLOCK_NUMBER',
      'EXECUTION_TX_HASH', 'ACTUAL_PROFIT_USD', 'ACTUAL_GAS_COST_USD',
      'ACTUAL_EXECUTION_TIME_MS', 'EXECUTION_SUCCESS', 'EXECUTION_ERROR',
      
      // Timestamps
      'CREATED_AT', 'UPDATED_AT', 'VALIDATED_AT', 'EXECUTED_AT'
    ]
  },
  
  EXECUTIONS: {
    fields: 50,
    color: { red: 1.0, green: 0.95, blue: 0.88 }, // #FFF3E0
    columns: [
      'EXECUTION_ID', 'ROUTE_ID', 'STATUS', 'BLOCKCHAIN_ID', 'WALLET_ADDRESS',
      'TX_HASH', 'BLOCK_NUMBER', 'BLOCK_TIMESTAMP', 'GAS_USED', 'GAS_PRICE',
      'GAS_COST_USD', 'AMOUNT_IN_USD', 'AMOUNT_OUT_USD', 'EXPECTED_PROFIT_USD',
      'ACTUAL_PROFIT_USD', 'PROFIT_DEVIATION_USD', 'PROFIT_DEVIATION_BPS',
      'EXECUTION_TIME_MS', 'SLIPPAGE_BPS', 'PRICE_IMPACT_BPS',
      'SUCCESS', 'ERROR_CODE', 'ERROR_MESSAGE', 'RETRY_COUNT', 'RETRY_REASON',
      'FLASH_LOAN_USED', 'FLASH_LOAN_AMOUNT_USD', 'FLASH_LOAN_FEE_USD',
      'DEX_1_ID', 'DEX_2_ID', 'DEX_3_ID', 'POOL_1_ID', 'POOL_2_ID', 'POOL_3_ID',
      'TOKEN_IN_ID', 'TOKEN_OUT_ID', 'ORACLE_PRICE_IN', 'ORACLE_PRICE_OUT',
      'MEV_PROTECTION_USED', 'PRIVATE_TX_USED', 'FLASHBOTS_USED', 'BUNDLE_ID',
      'PRIORITY_FEE_USD', 'TOTAL_FEES_USD', 'NET_PROFIT_USD', 'ROI_PERCENTAGE',
      'NOTES', 'CREATED_AT', 'UPDATED_AT'
    ]
  }
};

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

async function expandSheetsBrain() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ARBITRAGEXPLUS2025 - Expandir Google Sheets Brain    ║');
  console.log('║  Esquema del Prompt Supremo Definitivo                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Autenticar con Google Sheets
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('✅ Autenticado con Google Sheets\n');
    
    // Procesar cada hoja según el esquema
    for (const [sheetName, schema] of Object.entries(SHEET_SCHEMA)) {
      console.log(`\n📊 Procesando hoja: ${sheetName}`);
      console.log(`   Campos objetivo: ${schema.fields}`);
      console.log(`   Columnas definidas: ${schema.columns.length}`);
      
      // Verificar si la hoja existe
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      
      if (!sheet) {
        console.log(`   ⚠️  Hoja ${sheetName} no existe, creándola...`);
        
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: schema.fields,
                    frozenRowCount: 1
                  },
                  tabColor: schema.color
                }
              }
            }]
          }
        });
        
        console.log(`   ✅ Hoja ${sheetName} creada`);
      }
      
      // Escribir encabezados
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:${getColumnLetter(schema.columns.length)}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [schema.columns]
        }
      });
      
      console.log(`   ✅ Encabezados actualizados (${schema.columns.length} columnas)`);
      
      // Aplicar formato a encabezados
      const sheetId = sheet ? sheet.properties.sheetId : 
        (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }))
          .data.sheets.find(s => s.properties.title === sheetName).properties.sheetId;
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.4, green: 0.4, blue: 0.4 },
                    textFormat: {
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 10,
                      bold: true
                    },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE'
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
              }
            }
          ]
        }
      });
      
      console.log(`   ✅ Formato aplicado`);
    }
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ EXPANSIÓN COMPLETADA EXITOSAMENTE                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('📊 Resumen:');
    let totalFields = 0;
    for (const [sheetName, schema] of Object.entries(SHEET_SCHEMA)) {
      console.log(`   ${sheetName}: ${schema.columns.length} campos`);
      totalFields += schema.columns.length;
    }
    console.log(`\n   TOTAL: ${totalFields} campos distribuidos\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

function getColumnLetter(columnNumber) {
  let letter = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

if (require.main === module) {
  expandSheetsBrain()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { expandSheetsBrain, SHEET_SCHEMA };

