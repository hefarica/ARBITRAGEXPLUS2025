/**
 * ARBITRAGEXPLUS2025 - TypeScript Type Definitions
 * 
 * Definiciones de tipos centralizadas para todo el sistema de arbitraje DeFi.
 * Incluye tipos para blockchain, DEXes, rutas, ejecuciones, métricas y más.
 */

// ==================================================================================
// BASIC PRIMITIVE TYPES
// ==================================================================================

export type Address = `0x${string}`;
export type Hash = `0x${string}`;
export type ChainId = number;
export type TokenSymbol = string;
export type BigNumberish = string | number | bigint;

// ==================================================================================
// BLOCKCHAIN & NETWORK TYPES
// ==================================================================================

export interface ChainConfig {
  chainId: ChainId;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: TokenSymbol;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  gasPrice?: {
    standard: number;
    fast: number;
    instant: number;
  };
}

export interface NetworkStatus {
  chainId: ChainId;
  blockNumber: number;
  gasPrice: number;
  isHealthy: boolean;
  latency: number;
  lastUpdated: Date;
}

// ==================================================================================
// TOKEN & ASSET TYPES
// ==================================================================================

export interface Token {
  address: Address;
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  chainId: ChainId;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, any>;
}

export interface TokenBalance {
  token: Token;
  balance: BigNumberish;
  balanceFormatted: string;
  valueUSD?: number;
  lastUpdated: Date;
}

export interface PriceData {
  symbol: TokenSymbol;
  address: Address;
  chainId: ChainId;
  price: number;
  priceUSD: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: Date;
  source: string;
}

export interface OHLCVData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ==================================================================================
// DEX & LIQUIDITY TYPES
// ==================================================================================

export interface DEXInfo {
  id: string;
  name: string;
  chainId: ChainId;
  routerAddress: Address;
  factoryAddress: Address;
  version: string;
  fee: number; // Base fee in basis points
  type: 'AMM' | 'OrderBook' | 'Hybrid';
  isActive: boolean;
  website?: string;
  documentation?: string;
}

export interface Pool {
  id: string;
  address: Address;
  dexId: string;
  chainId: ChainId;
  token0: Token;
  token1: Token;
  fee: number;
  liquidity: BigNumberish;
  liquidityUSD: number;
  volume24h: number;
  volumeUSD24h: number;
  feeTier: number;
  tick?: number;
  sqrtPrice?: BigNumberish;
  reserves?: {
    reserve0: BigNumberish;
    reserve1: BigNumberish;
  };
  apy?: number;
  lastUpdated: Date;
}

export interface LiquidityPosition {
  id: string;
  poolId: string;
  owner: Address;
  liquidity: BigNumberish;
  token0Amount: BigNumberish;
  token1Amount: BigNumberish;
  valueUSD: number;
  feesEarned: number;
  impermanentLoss: number;
  entryPrice: number;
  currentPrice: number;
  createdAt: Date;
}

// ==================================================================================
// ARBITRAGE ROUTE TYPES
// ==================================================================================

export type ArbitrageStrategy = 
  | '2dex'           // Simple DEX-to-DEX arbitrage
  | '3dex'           // Three-DEX arbitrage
  | 'triangular'     // Triangular arbitrage on same DEX
  | 'flash_loan'     // Flash loan arbitrage
  | 'cross_chain';   // Cross-chain arbitrage

export interface ArbitrageRoute {
  id: string;
  strategy: ArbitrageStrategy;
  sourceToken: Token;
  targetToken: Token;
  intermediateTokens?: Token[];
  
  // Path information
  path: {
    dexId: string;
    poolId: string;
    token0: Address;
    token1: Address;
    fee: number;
  }[];
  
  // Profitability
  inputAmount: BigNumberish;
  expectedOutputAmount: BigNumberish;
  minOutputAmount: BigNumberish;
  profitAmount: BigNumberish;
  profitUSD: number;
  profitPercent: number;
  
  // Execution parameters
  maxSlippage: number;
  gasEstimate: number;
  gasCostUSD: number;
  deadline: Date;
  
  // Metadata
  confidence: number; // 0-1 confidence score
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  createdAt: Date;
  lastValidated: Date;
  
  // Execution constraints
  minLiquidityUSD: number;
  maxGasPriceGwei: number;
  requiredConfirmations: number;
}

export interface RouteValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gasEstimate: number;
  priceImpact: number;
  liquidityCheck: boolean;
  slippageCheck: boolean;
  profitabilityCheck: boolean;
  validatedAt: Date;
}

// ==================================================================================
// EXECUTION TYPES
// ==================================================================================

export interface ExecutionRequest {
  routeId: string;
  amountIn: BigNumberish;
  minAmountOut: BigNumberish;
  maxSlippage: number;
  gasLimit?: number;
  gasPrice?: number;
  deadline?: Date;
  simulate?: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ExecutionResult {
  id: string;
  routeId: string;
  transactionHash?: Hash;
  blockNumber?: number;
  success: boolean;
  
  // Amounts
  amountIn: BigNumberish;
  amountOut: BigNumberish;
  expectedAmountOut: BigNumberish;
  slippageActual: number;
  
  // Profitability
  profitAmount: BigNumberish;
  profitUSD: number;
  profitPercent: number;
  
  // Gas & Fees
  gasUsed: number;
  gasPrice: number;
  gasCostUSD: number;
  totalFees: number;
  
  // Timing
  executedAt: Date;
  confirmedAt?: Date;
  executionTime: number; // milliseconds
  
  // Status & Error handling
  status: 'pending' | 'success' | 'failed' | 'timeout' | 'reverted';
  errorMessage?: string;
  failureReason?: string;
  
  // MEV & Competition
  mevDetected: boolean;
  competingTransactions: number;
  blockPosition: number;
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageProfit: number;
  totalProfitUSD: number;
  averageGasCost: number;
  totalGasCostUSD: number;
  averageExecutionTime: number;
  profitLossRatio: number;
  timeframe: string;
}

// ==================================================================================
// PRICE & MARKET DATA TYPES
// ==================================================================================

export interface PriceComparison {
  token: Token;
  prices: {
    dexId: string;
    price: number;
    priceUSD: number;
    liquidity: number;
    lastUpdated: Date;
  }[];
  bestPrice: {
    dexId: string;
    price: number;
    spread: number;
  };
  worstPrice: {
    dexId: string;
    price: number;
    spread: number;
  };
  arbitrageOpportunities?: ArbitrageOpportunity[];
}

export interface ArbitrageOpportunity {
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  profitPotential: number;
  liquidityAvailable: number;
  confidence: number;
  estimatedGas: number;
}

export interface MarketDepth {
  bids: { price: number; quantity: number; total: number }[];
  asks: { price: number; quantity: number; total: number }[];
  spread: number;
  midPrice: number;
  lastUpdated: Date;
}

export interface LiquidityAnalysis {
  token: Token;
  totalLiquidity: number;
  liquidityUSD: number;
  priceImpact: {
    '1k': number;    // Price impact for $1k trade
    '10k': number;   // Price impact for $10k trade
    '100k': number;  // Price impact for $100k trade
    '1m': number;    // Price impact for $1M trade
  };
  slippageEstimates: {
    amount: number;
    slippage: number;
    priceImpact: number;
  }[];
  liquidityDistribution: {
    dexId: string;
    liquidity: number;
    percentage: number;
  }[];
}

// ==================================================================================
// RISK & ANALYTICS TYPES
// ==================================================================================

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    liquidity: number;      // 0-10 score
    volatility: number;     // 0-10 score
    slippage: number;       // 0-10 score
    competition: number;    // 0-10 score
    technical: number;      // 0-10 score
    regulatory: number;     // 0-10 score
  };
  recommendations: string[];
  maxRecommendedSize: number;
  confidenceLevel: number;
  lastAssessed: Date;
}

export interface PerformanceMetrics {
  timeframe: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  averageReturn: number;
  volatility: number;
  calmarRatio: number;
  
  // Profitability
  totalProfitUSD: number;
  totalLossUSD: number;
  netProfitUSD: number;
  averageProfitPerTrade: number;
  
  // Execution metrics
  averageExecutionTime: number;
  failureRate: number;
  averageGasCost: number;
  
  // Risk metrics
  valueAtRisk: number;
  expectedShortfall: number;
  maxPositionSize: number;
  
  updatedAt: Date;
}

export interface ProfitabilityAnalysis {
  route: ArbitrageRoute;
  expectedProfit: number;
  worstCaseProfit: number;
  bestCaseProfit: number;
  probability: {
    success: number;
    breakeven: number;
    loss: number;
  };
  sensitivityAnalysis: {
    gasPrice: { change: number; impact: number }[];
    slippage: { change: number; impact: number }[];
    volume: { change: number; impact: number }[];
  };
  historicalPerformance?: {
    executions: number;
    successRate: number;
    averageProfit: number;
  };
}

// ==================================================================================
// ALERT & MONITORING TYPES
// ==================================================================================

export interface Alert {
  id: string;
  type: 'price' | 'execution' | 'system' | 'risk' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  
  // Context
  component?: string;
  routeId?: string;
  executionId?: string;
  tokenSymbol?: string;
  chainId?: ChainId;
  
  // Alert conditions
  condition?: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
    threshold: number;
    actualValue: number;
  };
  
  // Status
  status: 'new' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  
  // Actions
  actions?: {
    webhook?: string;
    email?: string[];
    slack?: string;
    autoResolve?: boolean;
  };
  
  metadata?: Record<string, any>;
}

export interface PriceAlert {
  id: string;
  userId?: string;
  token: Token;
  condition: 'above' | 'below' | 'change_percent';
  threshold: number;
  currentValue: number;
  
  // Notification settings
  channels: {
    email?: boolean;
    webhook?: string;
    slack?: boolean;
  };
  
  // Status
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: Date;
  createdAt: Date;
  
  metadata?: Record<string, any>;
}

// ==================================================================================
// SYSTEM & HEALTH TYPES
// ==================================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceStatus {
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface ComponentHealth {
  status: HealthStatus;
  details: Record<string, any>;
  lastChecked: string;
}

export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: string;
  };
  cpu: {
    user: number;
    system: number;
    usage: string;
  };
  eventLoop: {
    lag: number;
  };
  gc?: {
    collections: string;
    duration: string;
  };
}

// ==================================================================================
// API RESPONSE TYPES
// ==================================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    version: string;
    requestId?: string;
    pagination?: {
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
  };
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  cursor?: string;
}

export interface FilterOptions {
  chainId?: ChainId;
  dexId?: string;
  tokenSymbol?: string;
  strategy?: ArbitrageStrategy;
  minProfit?: number;
  maxRisk?: string;
  timeframe?: string;
  isActive?: boolean;
}

// ==================================================================================
// GOOGLE SHEETS INTEGRATION TYPES
// ==================================================================================

export interface SheetRow {
  [key: string]: string | number | boolean | Date | null | undefined;
}

export interface SheetRange {
  sheet: string;
  range: string;
  values: any[][];
}

export interface SheetUpdate {
  sheet: string;
  range: string;
  values: any[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: {
    name: string;
    id: number;
    rowCount: number;
    columnCount: number;
  }[];
  lastModified: Date;
}

// ==================================================================================
// WEBSOCKET & REAL-TIME TYPES
// ==================================================================================

export interface WebSocketMessage {
  type: string;
  channel: string;
  data: any;
  timestamp: Date;
  id?: string;
}

export interface SubscriptionRequest {
  channel: string;
  params?: Record<string, any>;
}

export interface StreamData {
  type: 'price_update' | 'route_update' | 'execution_update' | 'alert';
  data: any;
  timestamp: Date;
}

// ==================================================================================
// CONFIGURATION TYPES
// ==================================================================================

export interface ArbitrageConfig {
  minProfitUSD: number;
  maxSlippage: number;
  maxGasPrice: number;
  defaultDeadline: number;
  strategies: {
    [K in ArbitrageStrategy]: boolean;
  };
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    blacklistedTokens: string[];
  };
  execution: {
    autoExecute: boolean;
    simulationMode: boolean;
    confirmationBlocks: number;
  };
}

// ==================================================================================
// UTILITY TYPES
// ==================================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Timestamp = number; // Unix timestamp in milliseconds

export type Duration = number; // Duration in milliseconds

// ==================================================================================
// ENUM TYPES
// ==================================================================================

export enum ChainIds {
  ETHEREUM = 1,
  POLYGON = 137,
  BSC = 56,
  AVALANCHE = 43114,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  FANTOM = 250,
  HARMONY = 1666600000
}

export enum TokenStandards {
  ERC20 = 'ERC-20',
  ERC721 = 'ERC-721',
  ERC1155 = 'ERC-1155'
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REVERTED = 'reverted',
  TIMEOUT = 'timeout'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ==================================================================================
// TYPE GUARDS
// ==================================================================================

export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidHash(hash: string): hash is Hash {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function isValidChainId(chainId: number): chainId is ChainId {
  return Number.isInteger(chainId) && chainId > 0;
}

export function isArbitrageStrategy(strategy: string): strategy is ArbitrageStrategy {
  return ['2dex', '3dex', 'triangular', 'flash_loan', 'cross_chain'].includes(strategy);
}

// ==================================================================================
// EXPORT ALL TYPES
// ==================================================================================

export type {
  // Re-export all interfaces and types for convenience
  ChainConfig,
  NetworkStatus,
  Token,
  TokenBalance,
  PriceData,
  OHLCVData,
  DEXInfo,
  Pool,
  LiquidityPosition,
  ArbitrageRoute,
  RouteValidation,
  ExecutionRequest,
  ExecutionResult,
  ExecutionMetrics,
  PriceComparison,
  ArbitrageOpportunity,
  MarketDepth,
  LiquidityAnalysis,
  RiskAssessment,
  PerformanceMetrics,
  ProfitabilityAnalysis,
  Alert,
  PriceAlert,
  ComponentHealth,
  SystemMetrics,
  APIResponse,
  PaginationOptions,
  FilterOptions,
  SheetRow,
  SheetRange,
  SheetUpdate,
  SheetMetadata,
  WebSocketMessage,
  SubscriptionRequest,
  StreamData,
  ArbitrageConfig
};