// types.rs
//
// Tipos y estructuras para el Rust Engine con programación dinámica
// Implementación según Prompt Supremo Definitivo - FASE 3

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Blockchain con todos los campos dinámicos (49 campos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blockchain {
    pub blockchain_id: String,
    pub name: String,
    pub chain_id: u64,
    pub is_active: bool,
    pub native_token: String,
    pub rpc_url_1: String,
    pub rpc_url_2: Option<String>,
    pub rpc_url_3: Option<String>,
    pub wss_url: Option<String>,
    pub explorer_url: String,
    pub block_time_ms: u64,
    pub gas_price_gwei: f64,
    pub max_gas_price: f64,
    pub min_gas_price: f64,
    pub eip1559_supported: bool,
    pub base_fee: Option<f64>,
    pub priority_fee: Option<f64>,
    pub gas_limit: u64,
    pub multicall_address: Option<String>,
    pub weth_address: String,
    pub usdc_address: Option<String>,
    pub usdt_address: Option<String>,
    pub dai_address: Option<String>,
    // Metadata adicional como HashMap para flexibilidad
    #[serde(flatten)]
    pub extra_fields: HashMap<String, serde_json::Value>,
}

/// DEX con todos los campos dinámicos (171 campos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dex {
    pub dex_id: String,
    pub name: String,
    pub protocol: String,
    pub version: String,
    pub blockchain_id: String,
    pub is_active: bool,
    pub category: String,
    pub dex_type: String,
    pub router_address: String,
    pub factory_address: String,
    pub quoter_address: Option<String>,
    pub default_fee_bps: u32,
    pub fee_tier_1: Option<u32>,
    pub fee_tier_2: Option<u32>,
    pub fee_tier_3: Option<u32>,
    pub tvl_usd: f64,
    pub daily_volume_usd: f64,
    pub supports_flash_loans: bool,
    pub supports_multi_hop: bool,
    pub max_hops: u32,
    pub min_liquidity_usd: f64,
    pub max_slippage_bps: u32,
    pub default_slippage_bps: u32,
    pub gas_estimate_swap: u64,
    pub subgraph_url: Option<String>,
    pub api_url: Option<String>,
    pub wss_url: Option<String>,
    // Metadata adicional
    #[serde(flatten)]
    pub extra_fields: HashMap<String, serde_json::Value>,
}

/// Asset con todos los campos dinámicos (326 campos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub asset_id: String,
    pub symbol: String,
    pub name: String,
    pub blockchain_id: String,
    pub contract_address: String,
    pub is_active: bool,
    pub is_native: bool,
    pub is_wrapped: bool,
    pub is_stable: bool,
    pub decimals: u8,
    pub price_usd: f64,
    pub market_cap_usd: f64,
    pub volume_24h_usd: f64,
    pub pyth_price_feed_id: Option<String>,
    pub pyth_price: Option<f64>,
    pub pyth_confidence: Option<f64>,
    pub chainlink_feed_address: Option<String>,
    pub total_liquidity_usd: f64,
    pub available_on_dexes: Vec<String>,
    pub primary_dex: Option<String>,
    pub arbitrage_enabled: bool,
    pub min_arbitrage_profit_usd: f64,
    pub volatility_24h: f64,
    pub correlation_eth: Option<f64>,
    pub correlation_btc: Option<f64>,
    // Metadata adicional
    #[serde(flatten)]
    pub extra_fields: HashMap<String, serde_json::Value>,
}

/// Pool con todos los campos dinámicos (94 campos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pool {
    pub pool_id: String,
    pub dex_id: String,
    pub blockchain_id: String,
    pub pool_address: String,
    pub is_active: bool,
    pub token0_id: String,
    pub token1_id: String,
    pub token0_address: String,
    pub token1_address: String,
    pub token0_symbol: String,
    pub token1_symbol: String,
    pub token0_decimals: u8,
    pub token1_decimals: u8,
    pub reserve0: String,
    pub reserve1: String,
    pub reserve0_usd: f64,
    pub reserve1_usd: f64,
    pub total_liquidity_usd: f64,
    pub fee_tier: u32,
    pub fee_bps: u32,
    pub volume_24h_usd: f64,
    pub apy: f64,
    pub price_token0: f64,
    pub price_token1: f64,
    pub price_impact_1k: f64,
    pub price_impact_10k: f64,
    pub slippage_bps: u32,
    pub arbitrage_enabled: bool,
    pub flash_loan_enabled: bool,
    pub health_score: f64,
    pub risk_score: f64,
    // Metadata adicional
    #[serde(flatten)]
    pub extra_fields: HashMap<String, serde_json::Value>,
}

/// Oportunidad de arbitraje con todos los campos dinámicos (172 campos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageOpportunity {
    pub route_id: String,
    pub status: String,
    pub is_active: bool,
    pub is_profitable: bool,
    pub route_type: String,
    pub strategy: String,
    pub complexity: u32,
    pub hop_count: u32,
    pub dex_count: u32,
    pub blockchain_id: String,
    
    // Ruta detallada
    pub dex_1_id: String,
    pub dex_2_id: Option<String>,
    pub dex_3_id: Option<String>,
    pub pool_1_id: String,
    pub pool_2_id: Option<String>,
    pub pool_3_id: Option<String>,
    pub token_in_id: String,
    pub token_out_id: String,
    pub token_intermediate_1: Option<String>,
    
    // Cantidades y precios
    pub amount_in: f64,
    pub amount_out: f64,
    pub amount_in_usd: f64,
    pub amount_out_usd: f64,
    pub price_in: f64,
    pub price_out: f64,
    pub price_impact_bps: u32,
    pub slippage_bps: u32,
    pub expected_price: f64,
    
    // Profit y costos
    pub expected_profit_usd: f64,
    pub expected_profit_bps: u32,
    pub expected_profit_percentage: f64,
    pub min_profit_usd: f64,
    pub max_profit_usd: f64,
    pub gas_cost_usd: f64,
    pub gas_cost_gwei: f64,
    pub gas_limit: u64,
    pub protocol_fees_usd: f64,
    pub swap_fees_usd: f64,
    pub flash_loan_fees_usd: f64,
    pub total_costs_usd: f64,
    pub net_profit_usd: f64,
    pub roi_percentage: f64,
    
    // Liquidez y capacidad
    pub required_liquidity_usd: f64,
    pub available_liquidity_usd: f64,
    pub liquidity_utilization: f64,
    pub max_trade_size_usd: f64,
    pub optimal_trade_size_usd: f64,
    pub min_trade_size_usd: f64,
    
    // Timing
    pub discovery_timestamp: i64,
    pub expiry_timestamp: i64,
    pub execution_deadline: i64,
    pub time_to_expiry_ms: i64,
    pub estimated_execution_time_ms: i64,
    
    // Flash loan
    pub flash_loan_required: bool,
    pub flash_loan_provider: Option<String>,
    pub flash_loan_amount_usd: f64,
    pub flash_loan_fee_bps: u32,
    pub flash_loan_fee_usd: f64,
    
    // Riesgo
    pub risk_score: f64,
    pub confidence_score: f64,
    pub stability_score: f64,
    pub execution_probability: f64,
    pub slippage_risk: f64,
    pub liquidity_risk: f64,
    pub timing_risk: f64,
    pub mev_risk: f64,
    
    // Optimización
    pub optimization_score: f64,
    pub route_efficiency: f64,
    pub gas_efficiency: f64,
    pub capital_efficiency: f64,
    pub is_optimal_route: bool,
    
    // Priorización
    pub priority: u32,
    pub weight: f64,
    pub rank: u32,
    
    // Timestamps
    pub created_at: String,
    pub updated_at: String,
    
    // Metadata adicional
    #[serde(flatten)]
    pub extra_fields: HashMap<String, serde_json::Value>,
}

/// Estado de memoización para programación dinámica
#[derive(Debug, Clone)]
pub struct DPMemoState {
    /// Cache de resultados: (dex_pair_key) -> expected_profit
    pub profit_cache: HashMap<String, f64>,
    
    /// Cache de rutas: (dex_pair_key) -> ArbitrageOpportunity
    pub route_cache: HashMap<String, ArbitrageOpportunity>,
    
    /// Contador de hits/misses para estadísticas
    pub cache_hits: u64,
    pub cache_misses: u64,
}

impl DPMemoState {
    pub fn new() -> Self {
        Self {
            profit_cache: HashMap::new(),
            route_cache: HashMap::new(),
            cache_hits: 0,
            cache_misses: 0,
        }
    }
    
    pub fn get_cached_profit(&mut self, key: &str) -> Option<f64> {
        if let Some(profit) = self.profit_cache.get(key) {
            self.cache_hits += 1;
            Some(*profit)
        } else {
            self.cache_misses += 1;
            None
        }
    }
    
    pub fn cache_profit(&mut self, key: String, profit: f64) {
        self.profit_cache.insert(key, profit);
    }
    
    pub fn get_cached_route(&mut self, key: &str) -> Option<&ArbitrageOpportunity> {
        if let Some(route) = self.route_cache.get(key) {
            self.cache_hits += 1;
            Some(route)
        } else {
            self.cache_misses += 1;
            None
        }
    }
    
    pub fn cache_route(&mut self, key: String, route: ArbitrageOpportunity) {
        self.route_cache.insert(key, route);
    }
    
    pub fn get_hit_rate(&self) -> f64 {
        let total = self.cache_hits + self.cache_misses;
        if total == 0 {
            0.0
        } else {
            (self.cache_hits as f64) / (total as f64)
        }
    }
}

/// Resultado de error para el engine
#[derive(Debug)]
pub enum ArbitrageError {
    SheetsError(String),
    CalculationError(String),
    ValidationError(String),
    NetworkError(String),
}

impl std::fmt::Display for ArbitrageError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            ArbitrageError::SheetsError(msg) => write!(f, "Sheets Error: {}", msg),
            ArbitrageError::CalculationError(msg) => write!(f, "Calculation Error: {}", msg),
            ArbitrageError::ValidationError(msg) => write!(f, "Validation Error: {}", msg),
            ArbitrageError::NetworkError(msg) => write!(f, "Network Error: {}", msg),
        }
    }
}

impl std::error::Error for ArbitrageError {}

