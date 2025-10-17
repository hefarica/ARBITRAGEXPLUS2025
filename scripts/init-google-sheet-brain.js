/**
 * ARBITRAGEXPLUS2025 - Google Sheet Brain Initialization
 * 
 * Script para inicializar el Google Sheet con las 13 hojas maestras
 * y 1016+ campos dinámicos según la arquitectura de programación dinámica.
 * 
 * SPREADSHEET_ID: 1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuración
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/gsheets-sa.json';

// Schema de las 13 hojas maestras con 1016+ campos
const SHEET_SCHEMA = {
  BLOCKCHAINS: {
    name: 'BLOCKCHAINS',
    fields: 50,
    autoColor: '#E3F2FD',
    origin: 'MANUAL_FIELD',
    requiredBy: ['python-collector', 'rust-engine'],
    columns: [
      'CHAIN_ID', 'CHAIN_NAME', 'CHAIN_SYMBOL', 'NETWORK_TYPE', 'IS_TESTNET',
      'RPC_URL_PRIMARY', 'RPC_URL_SECONDARY', 'RPC_URL_FALLBACK', 'WS_URL',
      'EXPLORER_URL', 'EXPLORER_API_URL', 'EXPLORER_API_KEY',
      'NATIVE_TOKEN_SYMBOL', 'NATIVE_TOKEN_DECIMALS', 'NATIVE_TOKEN_ADDRESS',
      'BLOCK_TIME_SECONDS', 'FINALITY_BLOCKS', 'GAS_PRICE_GWEI',
      'MAX_GAS_PRICE_GWEI', 'PRIORITY_FEE_GWEI',
      'SUPPORTS_EIP1559', 'SUPPORTS_FLASHBOTS', 'FLASHBOTS_RPC',
      'CHAIN_LINK_SUPPORTED', 'PYTH_SUPPORTED', 'PYTH_ENDPOINT',
      'MULTICALL_ADDRESS', 'WETH_ADDRESS', 'USDC_ADDRESS', 'USDT_ADDRESS',
      'DAI_ADDRESS', 'WBTC_ADDRESS',
      'MIN_BALANCE_NATIVE', 'MAX_SLIPPAGE_BPS', 'MAX_PRICE_IMPACT_BPS',
      'GAS_BUFFER_PERCENT', 'RETRY_ATTEMPTS', 'RETRY_DELAY_MS',
      'TIMEOUT_MS', 'RATE_LIMIT_PER_SECOND',
      'IS_ACTIVE', 'PRIORITY', 'NOTES',
      'CREATED_AT', 'UPDATED_AT', 'LAST_BLOCK_CHECKED',
      'TOTAL_TRANSACTIONS', 'TOTAL_VOLUME_USD', 'TOTAL_PROFIT_USD',
      'SUCCESS_RATE_PERCENT', 'AVG_GAS_USED'
    ]
  },
  
  DEXES: {
    name: 'DEXES',
    fields: 200,
    autoColor: '#E8F5E8',
    origin: 'AUTO_FIELD',
    requiredBy: ['api-server', 'python-collector', 'ts-executor'],
    columns: [
      // Identificación (10 campos)
      'DEX_ID', 'DEX_NAME', 'DEX_DISPLAY_NAME', 'DEX_TYPE', 'DEX_VERSION',
      'CHAIN_ID', 'CHAIN_NAME', 'PROTOCOL_TYPE', 'AMM_TYPE', 'LOGO_URL',
      
      // Direcciones de Contratos (20 campos)
      'ROUTER_ADDRESS', 'ROUTER_V2_ADDRESS', 'ROUTER_V3_ADDRESS',
      'FACTORY_ADDRESS', 'FACTORY_V2_ADDRESS', 'FACTORY_V3_ADDRESS',
      'QUOTER_ADDRESS', 'QUOTER_V2_ADDRESS',
      'POSITION_MANAGER_ADDRESS', 'SWAP_ROUTER_ADDRESS',
      'MULTICALL_ADDRESS', 'PERMIT2_ADDRESS',
      'MASTERCHEF_ADDRESS', 'STAKING_ADDRESS', 'REWARDS_ADDRESS',
      'GOVERNANCE_ADDRESS', 'TIMELOCK_ADDRESS', 'TREASURY_ADDRESS',
      'FEE_COLLECTOR_ADDRESS', 'MIGRATOR_ADDRESS',
      
      // Configuración de Fees (15 campos)
      'DEFAULT_FEE_BPS', 'FEE_TIER_1_BPS', 'FEE_TIER_2_BPS', 'FEE_TIER_3_BPS',
      'LP_FEE_PERCENT', 'PROTOCOL_FEE_PERCENT', 'SWAP_FEE_PERCENT',
      'FLASH_LOAN_FEE_BPS', 'WITHDRAWAL_FEE_BPS',
      'PERFORMANCE_FEE_PERCENT', 'MANAGEMENT_FEE_PERCENT',
      'MIN_FEE_USD', 'MAX_FEE_USD', 'DYNAMIC_FEE_ENABLED', 'FEE_FORMULA',
      
      // Liquidez y Volumen (20 campos)
      'TVL_USD', 'TVL_NATIVE', 'VOLUME_24H_USD', 'VOLUME_7D_USD', 'VOLUME_30D_USD',
      'VOLUME_TOTAL_USD', 'FEES_24H_USD', 'FEES_7D_USD', 'FEES_30D_USD',
      'FEES_TOTAL_USD', 'TRANSACTIONS_24H', 'TRANSACTIONS_7D', 'TRANSACTIONS_30D',
      'TRANSACTIONS_TOTAL', 'UNIQUE_USERS_24H', 'UNIQUE_USERS_7D',
      'AVG_TRADE_SIZE_USD', 'MEDIAN_TRADE_SIZE_USD',
      'LIQUIDITY_DEPTH_PERCENT', 'PRICE_IMPACT_1K_USD',
      
      // Pools y Pares (15 campos)
      'TOTAL_POOLS', 'ACTIVE_POOLS', 'TOP_POOLS_IDS',
      'SUPPORTED_TOKENS_COUNT', 'WHITELISTED_TOKENS',
      'MIN_LIQUIDITY_USD', 'MAX_POOLS_PER_TOKEN',
      'POOL_CREATION_FEE_NATIVE', 'POOL_INIT_CODE_HASH',
      'SUPPORTS_CONCENTRATED_LIQUIDITY', 'SUPPORTS_STABLE_POOLS',
      'SUPPORTS_WEIGHTED_POOLS', 'SUPPORTS_CUSTOM_CURVES',
      'DEFAULT_SLIPPAGE_BPS', 'MAX_SLIPPAGE_BPS',
      
      // WebSocket y API (20 campos)
      'WS_ENDPOINT', 'WS_SUPPORTED', 'WS_RECONNECT_DELAY_MS',
      'WS_MAX_RECONNECT_ATTEMPTS', 'WS_PING_INTERVAL_MS',
      'API_ENDPOINT', 'API_VERSION', 'API_KEY_REQUIRED', 'API_RATE_LIMIT',
      'GRAPHQL_ENDPOINT', 'SUBGRAPH_URL', 'SUBGRAPH_DEPLOYMENT_ID',
      'REST_API_URL', 'REST_API_VERSION', 'REST_API_DOCS_URL',
      'SUPPORTS_BATCH_REQUESTS', 'MAX_BATCH_SIZE',
      'CACHE_TTL_SECONDS', 'SUPPORTS_HISTORICAL_DATA', 'HISTORICAL_BLOCKS_BACK',
      
      // Oráculos y Precios (15 campos)
      'PRICE_ORACLE_ADDRESS', 'TWAP_ENABLED', 'TWAP_PERIOD_SECONDS',
      'SUPPORTS_PYTH', 'PYTH_PRICE_FEEDS', 'SUPPORTS_CHAINLINK',
      'CHAINLINK_FEEDS', 'SUPPORTS_UNI_V3_ORACLE', 'ORACLE_PRECISION_DECIMALS',
      'PRICE_UPDATE_FREQUENCY_MS', 'PRICE_DEVIATION_THRESHOLD_BPS',
      'STALE_PRICE_THRESHOLD_SECONDS', 'FALLBACK_ORACLE_ADDRESS',
      'ORACLE_PRIORITY', 'ORACLE_CONFIDENCE_THRESHOLD',
      
      // Arbitraje y Trading (20 campos)
      'SUPPORTS_FLASH_SWAPS', 'FLASH_SWAP_FEE_BPS', 'FLASH_LOAN_AVAILABLE',
      'MAX_FLASH_LOAN_AMOUNT_NATIVE', 'MIN_TRADE_SIZE_USD', 'MAX_TRADE_SIZE_USD',
      'OPTIMAL_TRADE_SIZE_USD', 'GAS_ESTIMATE_SWAP', 'GAS_ESTIMATE_ADD_LIQUIDITY',
      'GAS_ESTIMATE_REMOVE_LIQUIDITY', 'AVG_EXECUTION_TIME_MS',
      'SUCCESS_RATE_PERCENT', 'FAILED_TX_RATE_PERCENT',
      'SUPPORTS_LIMIT_ORDERS', 'SUPPORTS_STOP_LOSS', 'SUPPORTS_MEV_PROTECTION',
      'MEV_PROTECTION_TYPE', 'FRONT_RUNNING_RISK_SCORE', 'SANDWICH_RISK_SCORE',
      'ARBITRAGE_OPPORTUNITY_SCORE',
      
      // Seguridad y Auditoría (15 campos)
      'IS_AUDITED', 'AUDIT_FIRM', 'AUDIT_DATE', 'AUDIT_REPORT_URL',
      'SECURITY_SCORE', 'EXPLOIT_HISTORY', 'INSURANCE_AVAILABLE',
      'INSURANCE_PROVIDER', 'BUG_BOUNTY_PROGRAM', 'BUG_BOUNTY_MAX_USD',
      'ADMIN_KEYS_TYPE', 'TIMELOCK_DELAY_HOURS', 'MULTISIG_THRESHOLD',
      'EMERGENCY_PAUSE_ENABLED', 'LAST_SECURITY_INCIDENT',
      
      // Tokens y Rewards (10 campos)
      'NATIVE_TOKEN_SYMBOL', 'NATIVE_TOKEN_ADDRESS', 'NATIVE_TOKEN_DECIMALS',
      'REWARDS_TOKEN_SYMBOL', 'REWARDS_TOKEN_ADDRESS', 'REWARDS_APR_PERCENT',
      'STAKING_APR_PERCENT', 'FARMING_AVAILABLE', 'YIELD_FARMING_POOLS',
      'LIQUIDITY_MINING_ACTIVE',
      
      // Integración y Compatibilidad (15 campos)
      'SDK_AVAILABLE', 'SDK_VERSION', 'SDK_LANGUAGE', 'SDK_DOCS_URL',
      'SUPPORTS_PERMIT', 'SUPPORTS_PERMIT2', 'SUPPORTS_MULTICALL',
      'SUPPORTS_BATCH_SWAP', 'EIP712_DOMAIN', 'CONTRACT_VERIFICATION_STATUS',
      'PROXY_PATTERN', 'UPGRADEABLE', 'IMPLEMENTATION_ADDRESS',
      'COMPATIBLE_WALLETS', 'COMPATIBLE_AGGREGATORS',
      
      // Monitoreo y Alertas (15 campos)
      'HEALTH_CHECK_URL', 'HEALTH_CHECK_INTERVAL_SECONDS', 'UPTIME_PERCENT',
      'LAST_DOWNTIME', 'DOWNTIME_DURATION_MINUTES', 'ALERT_WEBHOOK_URL',
      'ALERT_ON_HIGH_SLIPPAGE', 'ALERT_ON_LOW_LIQUIDITY', 'ALERT_ON_PRICE_DEVIATION',
      'ALERT_ON_FAILED_TX', 'ALERT_ON_HIGH_GAS', 'MONITORING_ENABLED',
      'PROMETHEUS_ENDPOINT', 'GRAFANA_DASHBOARD_URL', 'STATUS_PAGE_URL',
      
      // Estado y Metadata (10 campos)
      'IS_ACTIVE', 'IS_ENABLED_FOR_ARBITRAGE', 'IS_ENABLED_FOR_SWAPS',
      'PRIORITY_LEVEL', 'WEIGHT_FACTOR', 'NOTES', 'TAGS',
      'CREATED_AT', 'UPDATED_AT', 'LAST_CHECKED_AT'
    ]
  },
  
  ASSETS: {
    name: 'ASSETS',
    fields: 400,
    autoColor: '#E8F5E8',
    origin: 'AUTO_FIELD',
    requiredBy: ['rust-engine', 'contracts'],
    columns: [
      // Identificación Básica (15 campos)
      'ASSET_ID', 'TOKEN_SYMBOL', 'TOKEN_NAME', 'TOKEN_FULL_NAME',
      'CHAIN_ID', 'CHAIN_NAME', 'TOKEN_ADDRESS', 'TOKEN_TYPE',
      'TOKEN_STANDARD', 'DECIMALS', 'TOTAL_SUPPLY', 'CIRCULATING_SUPPLY',
      'MAX_SUPPLY', 'LOGO_URL', 'WEBSITE_URL',
      
      // Precios y Valoración (30 campos)
      'PRICE_USD', 'PRICE_NATIVE', 'PRICE_BTC', 'PRICE_ETH',
      'MARKET_CAP_USD', 'FULLY_DILUTED_VALUATION_USD',
      'PRICE_CHANGE_1H_PERCENT', 'PRICE_CHANGE_24H_PERCENT',
      'PRICE_CHANGE_7D_PERCENT', 'PRICE_CHANGE_30D_PERCENT',
      'PRICE_CHANGE_90D_PERCENT', 'PRICE_CHANGE_1Y_PERCENT',
      'PRICE_ATH_USD', 'PRICE_ATH_DATE', 'PRICE_ATH_CHANGE_PERCENT',
      'PRICE_ATL_USD', 'PRICE_ATL_DATE', 'PRICE_ATL_CHANGE_PERCENT',
      'PRICE_HIGH_24H', 'PRICE_LOW_24H', 'PRICE_OPEN_24H',
      'PRICE_CLOSE_24H', 'PRICE_VWAP_24H',
      'PRICE_VOLATILITY_24H', 'PRICE_VOLATILITY_7D', 'PRICE_VOLATILITY_30D',
      'PRICE_BETA', 'SHARPE_RATIO', 'SORTINO_RATIO', 'MAX_DRAWDOWN_PERCENT',
      
      // Volumen y Liquidez (25 campos)
      'VOLUME_24H_USD', 'VOLUME_7D_USD', 'VOLUME_30D_USD',
      'VOLUME_CHANGE_24H_PERCENT', 'VOLUME_TO_MARKET_CAP_RATIO',
      'LIQUIDITY_USD', 'LIQUIDITY_NATIVE', 'LIQUIDITY_SCORE',
      'BID_ASK_SPREAD_BPS', 'SLIPPAGE_1K_USD_BPS', 'SLIPPAGE_10K_USD_BPS',
      'SLIPPAGE_100K_USD_BPS', 'DEPTH_2_PERCENT_USD', 'DEPTH_5_PERCENT_USD',
      'DEPTH_10_PERCENT_USD', 'ORDER_BOOK_DEPTH_USD',
      'AVAILABLE_ON_DEXES_COUNT', 'AVAILABLE_ON_CEXES_COUNT',
      'TOTAL_POOLS', 'ACTIVE_POOLS', 'LARGEST_POOL_TVL_USD',
      'MOST_LIQUID_DEX', 'MOST_LIQUID_POOL_ADDRESS',
      'AVERAGE_POOL_SIZE_USD', 'MEDIAN_POOL_SIZE_USD',
      
      // Oráculos de Precios (20 campos)
      'PYTH_PRICE_FEED_ID', 'PYTH_PRICE', 'PYTH_CONFIDENCE', 'PYTH_EXPO',
      'PYTH_PUBLISH_TIME', 'PYTH_AVAILABLE',
      'CHAINLINK_FEED_ADDRESS', 'CHAINLINK_PRICE', 'CHAINLINK_DECIMALS',
      'CHAINLINK_ROUND_ID', 'CHAINLINK_UPDATED_AT', 'CHAINLINK_AVAILABLE',
      'UNI_V3_ORACLE_POOL', 'UNI_V3_TWAP_PRICE', 'UNI_V3_TWAP_PERIOD',
      'BAND_PROTOCOL_SYMBOL', 'BAND_PROTOCOL_PRICE',
      'ORACLE_PRIORITY', 'ORACLE_FALLBACK_ORDER', 'ORACLE_CONSENSUS_PRICE',
      
      // Trading y Pares (25 campos)
      'TRADING_PAIRS_COUNT', 'TOP_TRADING_PAIRS',
      'MOST_TRADED_AGAINST', 'QUOTE_CURRENCIES',
      'BASE_PAIRS', 'QUOTE_PAIRS',
      'SUPPORTS_DIRECT_SWAP_WITH_USDC', 'SUPPORTS_DIRECT_SWAP_WITH_USDT',
      'SUPPORTS_DIRECT_SWAP_WITH_ETH', 'SUPPORTS_DIRECT_SWAP_WITH_BTC',
      'OPTIMAL_ROUTE_TO_USDC', 'OPTIMAL_ROUTE_TO_USDT',
      'OPTIMAL_ROUTE_TO_ETH', 'OPTIMAL_ROUTE_TO_BTC',
      'AVG_HOPS_TO_STABLECOIN', 'MAX_HOPS_TO_STABLECOIN',
      'ROUTING_EFFICIENCY_SCORE', 'PATH_FINDING_COMPLEXITY',
      'SUPPORTS_MULTI_HOP', 'MAX_MULTI_HOP_COUNT',
      'GAS_COST_SWAP_USD', 'GAS_COST_APPROVE_USD',
      'TOTAL_GAS_COST_USD', 'BREAK_EVEN_TRADE_SIZE_USD',
      'OPTIMAL_TRADE_SIZE_USD',
      
      // Arbitraje (30 campos)
      'ARBITRAGE_OPPORTUNITIES_24H', 'ARBITRAGE_PROFIT_POTENTIAL_USD',
      'AVG_ARBITRAGE_PROFIT_USD', 'MAX_ARBITRAGE_PROFIT_USD',
      'ARBITRAGE_SUCCESS_RATE', 'ARBITRAGE_EXECUTION_TIME_MS',
      'PRICE_DEVIATION_BETWEEN_DEXES_BPS', 'PRICE_DEVIATION_VS_ORACLE_BPS',
      'CROSS_DEX_SPREAD_BPS', 'CROSS_CHAIN_SPREAD_BPS',
      'TRIANGULAR_ARB_AVAILABLE', 'TRIANGULAR_ARB_ROUTES',
      'FLASH_LOAN_AVAILABLE', 'FLASH_LOAN_PROVIDERS',
      'FLASH_LOAN_FEE_BPS', 'MAX_FLASH_LOAN_AMOUNT',
      'TWO_DEX_ARB_SCORE', 'THREE_DEX_ARB_SCORE',
      'CROSS_CHAIN_ARB_SCORE', 'OVERALL_ARB_SCORE',
      'ARB_FREQUENCY_PER_HOUR', 'ARB_WINDOW_DURATION_SECONDS',
      'BEST_ARB_DEX_PAIR', 'BEST_ARB_ROUTE',
      'ARB_COMPETITION_LEVEL', 'MEV_BOT_ACTIVITY_SCORE',
      'FRONT_RUNNING_RISK', 'SANDWICH_ATTACK_RISK',
      'ARB_PROFITABILITY_AFTER_GAS', 'ARB_ROI_PERCENT',
      
      // Información del Proyecto (25 campos)
      'PROJECT_NAME', 'PROJECT_DESCRIPTION', 'PROJECT_CATEGORY',
      'PROJECT_TAGS', 'LAUNCH_DATE', 'PROJECT_STATUS',
      'TEAM_SIZE', 'TEAM_PUBLIC', 'TEAM_DOXXED',
      'GITHUB_URL', 'GITHUB_STARS', 'GITHUB_FORKS',
      'GITHUB_LAST_COMMIT', 'GITHUB_ACTIVITY_SCORE',
      'TWITTER_URL', 'TWITTER_FOLLOWERS', 'DISCORD_URL',
      'DISCORD_MEMBERS', 'TELEGRAM_URL', 'TELEGRAM_MEMBERS',
      'COMMUNITY_SCORE', 'SOCIAL_SENTIMENT_SCORE',
      'WHITEPAPER_URL', 'DOCUMENTATION_URL', 'ROADMAP_URL',
      
      // Tokenomics (30 campos)
      'TOKEN_DISTRIBUTION', 'TEAM_ALLOCATION_PERCENT',
      'INVESTOR_ALLOCATION_PERCENT', 'COMMUNITY_ALLOCATION_PERCENT',
      'TREASURY_ALLOCATION_PERCENT', 'LIQUIDITY_ALLOCATION_PERCENT',
      'VESTING_SCHEDULE', 'UNLOCK_SCHEDULE', 'NEXT_UNLOCK_DATE',
      'NEXT_UNLOCK_AMOUNT', 'INFLATION_RATE_PERCENT',
      'EMISSION_RATE_PER_BLOCK', 'BURN_MECHANISM', 'BURN_RATE_PERCENT',
      'TOTAL_BURNED', 'BUYBACK_PROGRAM', 'STAKING_REWARDS_APR',
      'STAKING_PARTICIPATION_PERCENT', 'GOVERNANCE_RIGHTS',
      'VOTING_POWER_FORMULA', 'PROPOSAL_THRESHOLD',
      'QUORUM_REQUIREMENT', 'TIMELOCK_PERIOD',
      'TOKEN_UTILITY', 'USE_CASES', 'VALUE_ACCRUAL_MECHANISM',
      'REVENUE_SHARING', 'FEE_DISTRIBUTION', 'DIVIDEND_YIELD_PERCENT',
      'TOKEN_ECONOMICS_SCORE',
      
      // Seguridad y Auditoría (25 campos)
      'IS_AUDITED', 'AUDIT_FIRMS', 'AUDIT_DATES', 'AUDIT_REPORTS_URLS',
      'SECURITY_SCORE', 'VULNERABILITY_COUNT', 'CRITICAL_VULNERABILITIES',
      'HIGH_VULNERABILITIES', 'MEDIUM_VULNERABILITIES', 'LOW_VULNERABILITIES',
      'EXPLOIT_HISTORY', 'TOTAL_EXPLOITED_USD', 'LAST_EXPLOIT_DATE',
      'RUGPULL_RISK_SCORE', 'HONEYPOT_RISK_SCORE', 'SCAM_PROBABILITY',
      'CONTRACT_VERIFIED', 'PROXY_CONTRACT', 'UPGRADEABLE_CONTRACT',
      'ADMIN_KEYS', 'MULTISIG_OWNERS', 'TIMELOCK_DELAY',
      'PAUSE_MECHANISM', 'EMERGENCY_WITHDRAWAL', 'INSURANCE_COVERAGE_USD',
      
      // Métricas On-Chain (30 campos)
      'HOLDERS_COUNT', 'HOLDERS_CHANGE_24H', 'HOLDERS_CHANGE_7D',
      'TOP_10_HOLDERS_PERCENT', 'TOP_100_HOLDERS_PERCENT',
      'WHALE_ADDRESSES', 'WHALE_HOLDINGS_PERCENT',
      'SMART_MONEY_ADDRESSES', 'SMART_MONEY_HOLDINGS_PERCENT',
      'EXCHANGE_HOLDINGS_PERCENT', 'DEX_HOLDINGS_PERCENT',
      'TREASURY_HOLDINGS_PERCENT', 'BURNED_HOLDINGS_PERCENT',
      'LOCKED_HOLDINGS_PERCENT', 'STAKED_HOLDINGS_PERCENT',
      'TRANSACTIONS_24H', 'TRANSACTIONS_7D', 'TRANSACTIONS_30D',
      'UNIQUE_SENDERS_24H', 'UNIQUE_RECEIVERS_24H',
      'AVG_TRANSACTION_SIZE_USD', 'MEDIAN_TRANSACTION_SIZE_USD',
      'LARGE_TRANSACTIONS_24H', 'WHALE_TRANSACTIONS_24H',
      'DEX_TRANSACTIONS_24H', 'CEX_TRANSACTIONS_24H',
      'TRANSFER_COUNT_24H', 'MINT_COUNT_24H', 'BURN_COUNT_24H',
      'ON_CHAIN_ACTIVITY_SCORE',
      
      // Correlaciones y Comparaciones (20 campos)
      'CORRELATION_WITH_BTC', 'CORRELATION_WITH_ETH',
      'CORRELATION_WITH_MARKET', 'CORRELATION_WITH_SECTOR',
      'BETA_VS_BTC', 'BETA_VS_ETH', 'BETA_VS_MARKET',
      'RELATIVE_STRENGTH_INDEX', 'MOVING_AVERAGE_7D',
      'MOVING_AVERAGE_30D', 'MOVING_AVERAGE_200D',
      'MACD', 'MACD_SIGNAL', 'MACD_HISTOGRAM',
      'BOLLINGER_BANDS_UPPER', 'BOLLINGER_BANDS_LOWER',
      'FIBONACCI_LEVELS', 'SUPPORT_LEVELS', 'RESISTANCE_LEVELS',
      'TECHNICAL_ANALYSIS_SCORE',
      
      // Ratings y Scores (20 campos)
      'OVERALL_SCORE', 'LIQUIDITY_SCORE', 'VOLUME_SCORE',
      'MARKET_CAP_SCORE', 'SECURITY_SCORE', 'AUDIT_SCORE',
      'TEAM_SCORE', 'COMMUNITY_SCORE', 'TECHNOLOGY_SCORE',
      'ADOPTION_SCORE', 'TOKENOMICS_SCORE', 'GOVERNANCE_SCORE',
      'ARBITRAGE_SCORE', 'TRADING_SCORE', 'VOLATILITY_SCORE',
      'RISK_SCORE', 'REWARD_SCORE', 'RISK_REWARD_RATIO',
      'INVESTMENT_GRADE', 'RECOMMENDATION',
      
      // Alertas y Monitoreo (15 campos)
      'PRICE_ALERT_ENABLED', 'PRICE_ALERT_THRESHOLD_PERCENT',
      'VOLUME_ALERT_ENABLED', 'VOLUME_ALERT_THRESHOLD_PERCENT',
      'LIQUIDITY_ALERT_ENABLED', 'LIQUIDITY_ALERT_THRESHOLD_USD',
      'WHALE_ALERT_ENABLED', 'WHALE_ALERT_THRESHOLD_USD',
      'ANOMALY_DETECTION_ENABLED', 'LAST_ANOMALY_DETECTED',
      'MONITORING_FREQUENCY_SECONDS', 'ALERT_WEBHOOK_URL',
      'SLACK_CHANNEL', 'TELEGRAM_CHAT_ID', 'EMAIL_ALERTS',
      
      // Estado y Metadata (15 campos)
      'IS_ACTIVE', 'IS_TRADEABLE', 'IS_ENABLED_FOR_ARBITRAGE',
      'IS_STABLECOIN', 'IS_WRAPPED_TOKEN', 'IS_LP_TOKEN',
      'IS_GOVERNANCE_TOKEN', 'IS_UTILITY_TOKEN', 'IS_SECURITY_TOKEN',
      'PRIORITY_LEVEL', 'WEIGHT_FACTOR', 'NOTES', 'TAGS',
      'CREATED_AT', 'UPDATED_AT', 'LAST_PRICE_UPDATE',
      'LAST_VOLUME_UPDATE', 'LAST_LIQUIDITY_UPDATE',
      'LAST_ORACLE_UPDATE', 'DATA_QUALITY_SCORE'
    ]
  },
  
  POOLS: {
    name: 'POOLS',
    fields: 100,
    autoColor: '#E8F5E8',
    origin: 'AUTO_FIELD',
    requiredBy: ['rust-engine', 'ts-executor'],
    columns: [
      // Identificación (10 campos)
      'POOL_ID', 'POOL_ADDRESS', 'POOL_NAME', 'DEX_ID', 'DEX_NAME',
      'CHAIN_ID', 'CHAIN_NAME', 'POOL_TYPE', 'POOL_VERSION', 'CREATION_BLOCK',
      
      // Tokens del Pool (15 campos)
      'TOKEN_A_SYMBOL', 'TOKEN_A_ADDRESS', 'TOKEN_A_DECIMALS',
      'TOKEN_B_SYMBOL', 'TOKEN_B_ADDRESS', 'TOKEN_B_DECIMALS',
      'TOKEN_A_RESERVE', 'TOKEN_B_RESERVE',
      'TOKEN_A_RESERVE_USD', 'TOKEN_B_RESERVE_USD',
      'TOKEN_A_WEIGHT_PERCENT', 'TOKEN_B_WEIGHT_PERCENT',
      'TOKEN_A_PRICE_USD', 'TOKEN_B_PRICE_USD', 'PAIR_PRICE',
      
      // Liquidez y TVL (15 campos)
      'TVL_USD', 'TVL_NATIVE', 'TVL_CHANGE_24H_PERCENT',
      'TVL_CHANGE_7D_PERCENT', 'LIQUIDITY_USD', 'LIQUIDITY_NATIVE',
      'LIQUIDITY_DEPTH_2_PERCENT', 'LIQUIDITY_DEPTH_5_PERCENT',
      'LIQUIDITY_DEPTH_10_PERCENT', 'AVAILABLE_LIQUIDITY_USD',
      'LOCKED_LIQUIDITY_USD', 'LOCKED_LIQUIDITY_PERCENT',
      'LP_TOKEN_ADDRESS', 'LP_TOKEN_TOTAL_SUPPLY', 'LP_TOKEN_PRICE_USD',
      
      // Volumen y Actividad (15 campos)
      'VOLUME_24H_USD', 'VOLUME_7D_USD', 'VOLUME_30D_USD',
      'VOLUME_CHANGE_24H_PERCENT', 'VOLUME_TO_TVL_RATIO',
      'TRANSACTIONS_24H', 'TRANSACTIONS_7D', 'TRANSACTIONS_30D',
      'UNIQUE_TRADERS_24H', 'UNIQUE_TRADERS_7D',
      'AVG_TRADE_SIZE_USD', 'MEDIAN_TRADE_SIZE_USD',
      'LARGEST_TRADE_24H_USD', 'SWAP_COUNT_24H', 'LIQUIDITY_EVENTS_24H',
      
      // Fees y APR (10 campos)
      'FEE_BPS', 'FEE_TIER', 'FEES_24H_USD', 'FEES_7D_USD', 'FEES_30D_USD',
      'LP_APR_24H', 'LP_APR_7D', 'LP_APR_30D',
      'TRADING_APR', 'REWARDS_APR',
      
      // Precios y Slippage (10 campos)
      'CURRENT_PRICE', 'PRICE_CHANGE_24H_PERCENT', 'PRICE_HIGH_24H',
      'PRICE_LOW_24H', 'PRICE_VWAP_24H',
      'SLIPPAGE_1K_USD_BPS', 'SLIPPAGE_10K_USD_BPS', 'SLIPPAGE_100K_USD_BPS',
      'PRICE_IMPACT_THRESHOLD_BPS', 'MAX_TRADE_SIZE_NO_IMPACT_USD',
      
      // Arbitraje (10 campos)
      'ARBITRAGE_OPPORTUNITIES_24H', 'AVG_ARBITRAGE_PROFIT_USD',
      'PRICE_DEVIATION_VS_OTHER_POOLS_BPS', 'CROSS_DEX_SPREAD_BPS',
      'ARBITRAGE_FREQUENCY_PER_HOUR', 'ARBITRAGE_EXECUTION_TIME_MS',
      'ARBITRAGE_SUCCESS_RATE', 'MEV_ACTIVITY_SCORE',
      'FRONT_RUNNING_INCIDENTS_24H', 'SANDWICH_ATTACKS_24H',
      
      // Estado del Pool (10 campos)
      'IS_ACTIVE', 'IS_PAUSED', 'IS_DEPRECATED', 'IS_MIGRATED',
      'MIGRATION_TARGET_POOL', 'HEALTH_SCORE', 'RISK_SCORE',
      'IMBALANCE_RATIO', 'IMPERMANENT_LOSS_24H_PERCENT', 'IMPERMANENT_LOSS_7D_PERCENT',
      
      // Metadata (5 campos)
      'CREATED_AT', 'UPDATED_AT', 'LAST_SWAP_AT', 'LAST_LIQUIDITY_EVENT_AT', 'NOTES'
    ]
  },
  
  ROUTES: {
    name: 'ROUTES',
    fields: 200,
    autoColor: '#FFF3E0',
    origin: 'CALCULATED_FIELD',
    requiredBy: ['ts-executor', 'contracts'],
    columns: [
      // Identificación (10 campos)
      'ROUTE_ID', 'ROUTE_NAME', 'STRATEGY_TYPE', 'ROUTE_TYPE',
      'CHAIN_ID', 'CHAIN_NAME', 'CREATED_AT', 'UPDATED_AT',
      'CALCULATED_AT', 'EXPIRES_AT',
      
      // Tokens y Path (15 campos)
      'SOURCE_TOKEN_SYMBOL', 'SOURCE_TOKEN_ADDRESS',
      'TARGET_TOKEN_SYMBOL', 'TARGET_TOKEN_ADDRESS',
      'INTERMEDIATE_TOKENS', 'FULL_PATH', 'PATH_LENGTH',
      'HOP_COUNT', 'DEX_COUNT', 'POOL_COUNT',
      'DEXES_INVOLVED', 'POOLS_INVOLVED',
      'OPTIMAL_PATH', 'ALTERNATIVE_PATHS', 'PATH_COMPLEXITY_SCORE',
      
      // Cantidades y Precios (20 campos)
      'INPUT_AMOUNT', 'INPUT_AMOUNT_USD',
      'EXPECTED_OUTPUT_AMOUNT', 'EXPECTED_OUTPUT_AMOUNT_USD',
      'MIN_OUTPUT_AMOUNT', 'MIN_OUTPUT_AMOUNT_USD',
      'MAX_OUTPUT_AMOUNT', 'MAX_OUTPUT_AMOUNT_USD',
      'PRICE_IMPACT_BPS', 'SLIPPAGE_BPS', 'MAX_SLIPPAGE_BPS',
      'ENTRY_PRICE', 'EXIT_PRICE', 'AVERAGE_PRICE',
      'PRICE_DEVIATION_BPS', 'ORACLE_PRICE_SOURCE',
      'ORACLE_PRICE_TARGET', 'ORACLE_CONFIDENCE',
      'PRICE_FRESHNESS_SECONDS', 'PRICE_VALIDITY_SCORE',
      
      // Profit y ROI (25 campos)
      'GROSS_PROFIT_USD', 'GROSS_PROFIT_PERCENT',
      'NET_PROFIT_USD', 'NET_PROFIT_PERCENT',
      'EXPECTED_PROFIT_USD', 'EXPECTED_PROFIT_PERCENT',
      'MIN_PROFIT_USD', 'MAX_PROFIT_USD',
      'PROFIT_AFTER_GAS_USD', 'PROFIT_AFTER_FEES_USD',
      'PROFIT_AFTER_SLIPPAGE_USD', 'PROFIT_MARGIN_PERCENT',
      'ROI_PERCENT', 'ANNUALIZED_ROI_PERCENT',
      'RISK_ADJUSTED_RETURN', 'SHARPE_RATIO',
      'PROFIT_PROBABILITY_PERCENT', 'EXPECTED_VALUE_USD',
      'PROFIT_RANGE_MIN_USD', 'PROFIT_RANGE_MAX_USD',
      'PROFIT_VOLATILITY', 'PROFIT_CONFIDENCE_INTERVAL',
      'BREAK_EVEN_PRICE', 'BREAK_EVEN_GAS_PRICE_GWEI',
      'PROFITABILITY_SCORE',
      
      // Gas y Costos (20 campos)
      'ESTIMATED_GAS', 'GAS_LIMIT', 'GAS_PRICE_GWEI',
      'MAX_FEE_PER_GAS_GWEI', 'MAX_PRIORITY_FEE_GWEI',
      'TOTAL_GAS_COST_NATIVE', 'TOTAL_GAS_COST_USD',
      'GAS_COST_PER_HOP_USD', 'APPROVAL_GAS_COST_USD',
      'SWAP_GAS_COST_USD', 'FLASH_LOAN_GAS_COST_USD',
      'DEX_FEES_USD', 'PROTOCOL_FEES_USD', 'LP_FEES_USD',
      'FLASH_LOAN_FEES_USD', 'TOTAL_FEES_USD',
      'TOTAL_COST_USD', 'COST_TO_PROFIT_RATIO',
      'GAS_EFFICIENCY_SCORE', 'COST_EFFICIENCY_SCORE',
      
      // Timing y Ejecución (20 campos)
      'ESTIMATED_EXECUTION_TIME_MS', 'MAX_EXECUTION_TIME_MS',
      'TIMEOUT_MS', 'DEADLINE_TIMESTAMP',
      'OPTIMAL_EXECUTION_WINDOW_START', 'OPTIMAL_EXECUTION_WINDOW_END',
      'TIME_SENSITIVITY_SCORE', 'URGENCY_LEVEL',
      'BLOCK_NUMBER_CALCULATED', 'BLOCK_NUMBER_EXPIRES',
      'BLOCKS_VALID', 'SECONDS_VALID',
      'PRICE_STALENESS_SECONDS', 'LIQUIDITY_STALENESS_SECONDS',
      'REQUIRES_IMMEDIATE_EXECUTION', 'CAN_BE_BATCHED',
      'BATCH_COMPATIBLE_ROUTES', 'PARALLEL_EXECUTION_POSSIBLE',
      'SEQUENTIAL_EXECUTION_REQUIRED', 'EXECUTION_PRIORITY',
      
      // Risk Assessment (30 campos)
      'OVERALL_RISK_SCORE', 'LIQUIDITY_RISK_SCORE',
      'SLIPPAGE_RISK_SCORE', 'PRICE_IMPACT_RISK_SCORE',
      'GAS_PRICE_RISK_SCORE', 'TIMING_RISK_SCORE',
      'EXECUTION_RISK_SCORE', 'MARKET_RISK_SCORE',
      'SMART_CONTRACT_RISK_SCORE', 'ORACLE_RISK_SCORE',
      'MEV_RISK_SCORE', 'FRONT_RUNNING_RISK_SCORE',
      'SANDWICH_ATTACK_RISK_SCORE', 'BACK_RUNNING_RISK_SCORE',
      'COMPETITION_RISK_SCORE', 'VOLATILITY_RISK_SCORE',
      'CORRELATION_RISK_SCORE', 'CONCENTRATION_RISK_SCORE',
      'COUNTERPARTY_RISK_SCORE', 'OPERATIONAL_RISK_SCORE',
      'RISK_FACTORS', 'RISK_MITIGATION_STRATEGIES',
      'ACCEPTABLE_RISK_LEVEL', 'RISK_TOLERANCE_THRESHOLD',
      'RISK_REWARD_RATIO', 'KELLY_CRITERION_PERCENT',
      'OPTIMAL_POSITION_SIZE_USD', 'MAX_POSITION_SIZE_USD',
      'STOP_LOSS_PRICE', 'TAKE_PROFIT_PRICE',
      
      // Validación y Confidence (20 campos)
      'IS_VALIDATED', 'VALIDATION_TIMESTAMP', 'VALIDATION_METHOD',
      'PYTH_VALIDATED', 'CHAINLINK_VALIDATED', 'DEX_PRICE_VALIDATED',
      'LIQUIDITY_VALIDATED', 'GAS_PRICE_VALIDATED',
      'ROUTE_FEASIBILITY_SCORE', 'EXECUTION_PROBABILITY_PERCENT',
      'CONFIDENCE_SCORE', 'CONFIDENCE_INTERVAL_LOWER',
      'CONFIDENCE_INTERVAL_UPPER', 'DATA_QUALITY_SCORE',
      'ORACLE_CONSENSUS_REACHED', 'PRICE_DIVERGENCE_BPS',
      'ANOMALY_DETECTED', 'ANOMALY_TYPE', 'ANOMALY_SEVERITY',
      'REQUIRES_MANUAL_REVIEW',
      
      // Estrategia Específica (15 campos)
      'STRATEGY_NAME', 'STRATEGY_VERSION', 'STRATEGY_PARAMETERS',
      'IS_FLASH_LOAN_REQUIRED', 'FLASH_LOAN_PROVIDER',
      'FLASH_LOAN_AMOUNT', 'FLASH_LOAN_TOKEN',
      'IS_ATOMIC_EXECUTION', 'REQUIRES_APPROVAL',
      'APPROVAL_TOKENS', 'SUPPORTS_PARTIAL_FILL',
      'MIN_FILL_PERCENT', 'REVERT_ON_FAILURE',
      'EMERGENCY_EXIT_STRATEGY', 'FALLBACK_ROUTE',
      
      // Estado y Metadata (15 campos)
      'STATUS', 'IS_ACTIVE', 'IS_READY', 'IS_EXECUTING',
      'IS_COMPLETED', 'IS_FAILED', 'IS_EXPIRED',
      'PRIORITY_LEVEL', 'WEIGHT_FACTOR', 'EXECUTION_COUNT',
      'SUCCESS_COUNT', 'FAILURE_COUNT', 'NOTES', 'TAGS',
      'LAST_EXECUTED_AT'
    ]
  },
  
  EXECUTIONS: {
    name: 'EXECUTIONS',
    fields: 50,
    autoColor: '#FFF3E0',
    origin: 'CALCULATED_FIELD',
    requiredBy: ['api-server', 'monitoring'],
    columns: [
      // Identificación (10 campos)
      'EXECUTION_ID', 'ROUTE_ID', 'STRATEGY_TYPE', 'CHAIN_ID',
      'CHAIN_NAME', 'EXECUTOR_ADDRESS', 'INITIATED_AT', 'COMPLETED_AT',
      'DURATION_MS', 'BLOCK_NUMBER',
      
      // Transacciones (10 campos)
      'TX_HASH', 'TX_STATUS', 'TX_CONFIRMATIONS', 'TX_RECEIPT',
      'TX_LOGS', 'TX_EVENTS', 'TX_ERROR', 'TX_REVERT_REASON',
      'TX_NONCE', 'TX_INDEX',
      
      // Resultados Financieros (15 campos)
      'ACTUAL_PROFIT_USD', 'ACTUAL_PROFIT_PERCENT',
      'EXPECTED_PROFIT_USD', 'PROFIT_VARIANCE_USD',
      'PROFIT_VARIANCE_PERCENT', 'GAS_USED', 'GAS_PRICE_GWEI',
      'TOTAL_GAS_COST_USD', 'TOTAL_FEES_USD',
      'NET_PROFIT_USD', 'ROI_PERCENT', 'INPUT_AMOUNT_USD',
      'OUTPUT_AMOUNT_USD', 'SLIPPAGE_ACTUAL_BPS', 'PRICE_IMPACT_ACTUAL_BPS',
      
      // Estado y Metadata (15 campos)
      'STATUS', 'IS_SUCCESSFUL', 'IS_FAILED', 'IS_PENDING',
      'FAILURE_REASON', 'ERROR_CODE', 'ERROR_MESSAGE',
      'RETRY_COUNT', 'LAST_RETRY_AT', 'NOTES',
      'CREATED_AT', 'UPDATED_AT', 'EXECUTED_BY', 'REVIEWED_BY', 'TAGS'
    ]
  },
  
  CONFIG: {
    name: 'CONFIG',
    fields: 7,
    autoColor: '#E3F2FD',
    origin: 'MANUAL_FIELD',
    requiredBy: ['all-services'],
    columns: [
      'KEY', 'VALUE', 'DESCRIPTION', 'TYPE', 'IS_ACTIVE', 'UPDATED_AT', 'UPDATED_BY'
    ]
  },
  
  ALERTS: {
    name: 'ALERTS',
    fields: 9,
    autoColor: '#FFEBEE',
    origin: 'SYSTEM_FIELD',
    requiredBy: ['monitoring', 'api-server'],
    columns: [
      'ALERT_ID', 'TIMESTAMP', 'TYPE', 'SEVERITY', 'MESSAGE',
      'DATA', 'STATUS', 'RESOLVED_AT', 'RESOLVED_BY'
    ]
  }
};

// Función principal
async function initializeGoogleSheetBrain() {
  try {
    console.log('🚀 Iniciando configuración del Google Sheet Brain...\n');
    
    // 1. Verificar credenciales
    console.log('📁 Verificando credenciales...');
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`Archivo de credenciales no encontrado: ${CREDENTIALS_PATH}`);
    }
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    console.log('✅ Credenciales cargadas correctamente\n');
    
    // 2. Autenticar con Google Sheets API
    console.log('🔐 Autenticando con Google Sheets API...');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Autenticación exitosa\n');
    
    // 3. Verificar acceso al spreadsheet
    console.log(`📊 Verificando acceso al spreadsheet: ${SPREADSHEET_ID}...`);
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    console.log(`✅ Spreadsheet encontrado: "${spreadsheet.data.properties.title}"\n`);
    
    // 4. Crear las 13 hojas maestras
    console.log('📋 Creando 13 hojas maestras...\n');
    
    const requests = [];
    let totalFields = 0;
    
    for (const [sheetKey, sheetConfig] of Object.entries(SHEET_SCHEMA)) {
      console.log(`   Configurando hoja: ${sheetConfig.name}`);
      console.log(`   - Campos: ${sheetConfig.fields}`);
      console.log(`   - Color: ${sheetConfig.autoColor}`);
      console.log(`   - Origen: ${sheetConfig.origin}`);
      console.log(`   - Requerido por: ${sheetConfig.requiredBy.join(', ')}\n`);
      
      totalFields += sheetConfig.fields;
      
      // Crear hoja
      requests.push({
        addSheet: {
          properties: {
            title: sheetConfig.name,
            gridProperties: {
              rowCount: 1000,
              columnCount: sheetConfig.columns.length,
              frozenRowCount: 1,
            },
            tabColor: hexToRgb(sheetConfig.autoColor),
          },
        },
      });
    }
    
    console.log(`📊 Total de campos a crear: ${totalFields}\n`);
    
    // 5. Ejecutar batch update para crear hojas
    console.log('⚙️  Ejecutando batch update...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log('✅ Hojas creadas exitosamente\n');
    
    // 6. Agregar headers a cada hoja
    console.log('📝 Agregando headers a cada hoja...\n');
    
    for (const [sheetKey, sheetConfig] of Object.entries(SHEET_SCHEMA)) {
      console.log(`   Escribiendo headers en: ${sheetConfig.name}`);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetConfig.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [sheetConfig.columns],
        },
      });
      
      console.log(`   ✅ ${sheetConfig.columns.length} columnas escritas\n`);
    }
    
    // 7. Formatear headers
    console.log('🎨 Formateando headers...');
    
    const formatRequests = [];
    
    for (const [sheetKey, sheetConfig] of Object.entries(SHEET_SCHEMA)) {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: (await getSheetId(sheets, SPREADSHEET_ID, sheetConfig.name)),
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: hexToRgb(sheetConfig.autoColor),
              textFormat: {
                bold: true,
                fontSize: 10,
              },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    }
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: formatRequests },
    });
    
    console.log('✅ Headers formateados correctamente\n');
    
    // 8. Resumen final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 GOOGLE SHEET BRAIN INICIALIZADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);
    console.log(`📋 Hojas creadas: ${Object.keys(SHEET_SCHEMA).length}`);
    console.log(`📊 Total de campos: ${totalFields}\n`);
    
    console.log('📋 Resumen de hojas:');
    for (const [sheetKey, sheetConfig] of Object.entries(SHEET_SCHEMA)) {
      console.log(`   ✅ ${sheetConfig.name.padEnd(15)} - ${sheetConfig.fields.toString().padStart(3)} campos - ${sheetConfig.origin}`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('🚀 El sistema está listo para comenzar operaciones de arbitraje');
    console.log('📝 Próximo paso: Configurar datos iniciales en cada hoja\n');
    
  } catch (error) {
    console.error('❌ Error al inicializar Google Sheet Brain:', error);
    throw error;
  }
}

// Funciones auxiliares
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        red: parseInt(result[1], 16) / 255,
        green: parseInt(result[2], 16) / 255,
        blue: parseInt(result[3], 16) / 255,
      }
    : { red: 1, green: 1, blue: 1 };
}

async function getSheetId(sheets, spreadsheetId, sheetName) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

// Ejecutar
if (require.main === module) {
  initializeGoogleSheetBrain()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { initializeGoogleSheetBrain, SHEET_SCHEMA };

