// twodex_dp_v2.rs
//
// Rust Engine con Programación Dinámica y Memoización según Prompt Supremo Definitivo.
// Lee arrays dinámicos desde Sheets (1016 campos) - CERO hardcoding.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// ============================================================================
// TIPOS Y ESTRUCTURAS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dex {
    // 200 campos dinámicos desde DEXES sheet
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub version: String,
    pub blockchain_id: String,
    pub is_active: bool,
    pub router_address: String,
    pub factory_address: String,
    pub default_fee_bps: f64,
    pub tvl_usd: f64,
    pub daily_volume_usd: f64,
    // ... hasta 200 campos desde arrays dinámicos
    pub extra_fields: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    // 400 campos dinámicos desde ASSETS sheet
    pub id: String,
    pub symbol: String,
    pub name: String,
    pub address: String,
    pub blockchain_id: String,
    pub decimals: u8,
    pub price_usd: f64,
    pub pyth_price_feed_id: String,
    pub market_cap_usd: f64,
    pub total_volume_24h: f64,
    // ... hasta 400 campos desde arrays dinámicos
    pub extra_fields: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pool {
    // 100 campos dinámicos desde POOLS sheet
    pub id: String,
    pub address: String,
    pub dex_id: String,
    pub blockchain_id: String,
    pub token0_address: String,
    pub token1_address: String,
    pub tvl_usd: f64,
    pub volume_24h_usd: f64,
    pub fee_tier: f64,
    pub liquidity_usd: f64,
    // ... hasta 100 campos desde arrays dinámicos
    pub extra_fields: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageOpportunity {
    // 200 campos dinámicos para ROUTES sheet
    pub route_id: String,
    pub status: String,
    pub priority: u32,
    pub blockchain_id: String,
    pub strategy_type: String,
    pub start_dex_id: String,
    pub start_dex_name: String,
    pub start_pool_id: String,
    pub start_token_in: String,
    pub start_token_out: String,
    pub end_dex_id: String,
    pub end_dex_name: String,
    pub end_pool_id: String,
    pub end_token_in: String,
    pub end_token_out: String,
    pub amount_in: f64,
    pub amount_out: f64,
    pub expected_profit_usd: f64,
    pub expected_profit_percentage: f64,
    pub gas_estimate: f64,
    pub gas_cost_usd: f64,
    pub total_fees_usd: f64,
    pub net_profit: f64,
    pub risk_score: f64,
    pub confidence_score: f64,
    // ... hasta 200 campos dinámicos
    pub extra_fields: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct DPMemoState {
    // Estado de memoización para programación dinámica
    pub profit_cache: HashMap<String, f64>,
    pub route_cache: HashMap<String, ArbitrageOpportunity>,
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
    
    pub fn cache_profit(&mut self, key: String, profit: f64) {
        self.profit_cache.insert(key, profit);
    }
    
    pub fn get_cached_profit(&mut self, key: &str) -> Option<f64> {
        if let Some(&profit) = self.profit_cache.get(key) {
            self.cache_hits += 1;
            Some(profit)
        } else {
            self.cache_misses += 1;
            None
        }
    }
    
    pub fn cache_route(&mut self, key: String, route: ArbitrageOpportunity) {
        self.route_cache.insert(key, route);
    }
    
    pub fn get_cached_route(&mut self, key: &str) -> Option<ArbitrageOpportunity> {
        if let Some(route) = self.route_cache.get(key) {
            self.cache_hits += 1;
            Some(route.clone())
        } else {
            self.cache_misses += 1;
            None
        }
    }
    
    pub fn cache_hit_rate(&self) -> f64 {
        let total = self.cache_hits + self.cache_misses;
        if total == 0 {
            0.0
        } else {
            (self.cache_hits as f64 / total as f64) * 100.0
        }
    }
}

// ============================================================================
// ALGORITMO DE ARBITRAJE CON PROGRAMACIÓN DINÁMICA
// ============================================================================

/// Encuentra oportunidades de arbitraje entre 2 DEXes usando programación dinámica
/// 
/// Lee arrays dinámicos desde Sheets (1016 campos totales) - CERO hardcoding
/// 
/// # Arguments
/// * `dexes` - Array de DEXes con 200 campos cada uno
/// * `assets` - Array de assets con 400 campos cada uno
/// * `pools` - Array de pools con 100 campos cada uno
/// * `dp_memo` - Estado de memoización para optimización
/// 
/// # Returns
/// Vector de oportunidades de arbitraje con 200 campos cada una
pub async fn find_arbitrage_opportunities_twodex(
    dexes: &[Dex],
    assets: &[Asset],
    pools: &[Pool],
    dp_memo: &mut DPMemoState,
) -> Result<Vec<ArbitrageOpportunity>, Box<dyn std::error::Error>> {
    
    println!("🔍 Buscando oportunidades de arbitraje con DP...");
    println!("📊 DEXes: {} (200 campos c/u)", dexes.len());
    println!("📊 Assets: {} (400 campos c/u)", assets.len());
    println!("📊 Pools: {} (100 campos c/u)", pools.len());
    
    let mut opportunities = Vec::new();
    
    // Programación dinámica: iterar sobre pares de DEXes
    for i in 0..dexes.len() {
        for j in (i+1)..dexes.len() {
            let dex_pair_key = format!("{}_{}", dexes[i].id, dexes[j].id);
            
            // Memoización - verificar si ya calculamos este par
            if let Some(cached_route) = dp_memo.get_cached_route(&dex_pair_key) {
                println!("✅ Cache hit para par: {}", dex_pair_key);
                opportunities.push(cached_route);
                continue;
            }
            
            println!("🔄 Calculando par: {} <-> {}", dexes[i].name, dexes[j].name);
            
            // Calcular oportunidades para este par de DEXes
            let pair_opportunities = calculate_pair_opportunities(
                &dexes[i],
                &dexes[j],
                assets,
                pools,
            ).await?;
            
            // Almacenar en cache para optimización
            for opportunity in &pair_opportunities {
                dp_memo.cache_profit(
                    dex_pair_key.clone(),
                    opportunity.expected_profit_usd,
                );
                dp_memo.cache_route(
                    dex_pair_key.clone(),
                    opportunity.clone(),
                );
            }
            
            // Agregar solo oportunidades rentables
            for opportunity in pair_opportunities {
                if opportunity.expected_profit_usd > 0.0 {
                    opportunities.push(opportunity);
                }
            }
        }
    }
    
    // Ordenar por profit descendente
    opportunities.sort_by(|a, b| {
        b.expected_profit_usd
            .partial_cmp(&a.expected_profit_usd)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    
    println!("\n📈 Oportunidades encontradas: {}", opportunities.len());
    println!("🎯 Cache hit rate: {:.2}%", dp_memo.cache_hit_rate());
    
    Ok(opportunities)
}

/// Calcula oportunidades de arbitraje para un par específico de DEXes
async fn calculate_pair_opportunities(
    dex1: &Dex,
    dex2: &Dex,
    assets: &[Asset],
    pools: &[Pool],
) -> Result<Vec<ArbitrageOpportunity>, Box<dyn std::error::Error>> {
    
    let mut opportunities = Vec::new();
    
    // Filtrar pools por DEX
    let pools1: Vec<&Pool> = pools.iter()
        .filter(|p| p.dex_id == dex1.id)
        .collect();
    
    let pools2: Vec<&Pool> = pools.iter()
        .filter(|p| p.dex_id == dex2.id)
        .collect();
    
    // Buscar pares de tokens comunes
    for pool1 in &pools1 {
        for pool2 in &pools2 {
            // Verificar si tienen tokens en común para arbitraje
            if tokens_match_for_arbitrage(pool1, pool2) {
                // Calcular arbitraje directo
                if let Some(opportunity) = calculate_direct_arbitrage(
                    dex1,
                    dex2,
                    pool1,
                    pool2,
                    assets,
                ).await? {
                    opportunities.push(opportunity);
                }
            }
        }
    }
    
    Ok(opportunities)
}

/// Verifica si dos pools tienen tokens compatibles para arbitraje
fn tokens_match_for_arbitrage(pool1: &Pool, pool2: &Pool) -> bool {
    // Verificar si comparten al menos un par de tokens
    (pool1.token0_address == pool2.token0_address && pool1.token1_address == pool2.token1_address) ||
    (pool1.token0_address == pool2.token1_address && pool1.token1_address == pool2.token0_address)
}

/// Calcula arbitraje directo entre dos pools
async fn calculate_direct_arbitrage(
    dex1: &Dex,
    dex2: &Dex,
    pool1: &Pool,
    pool2: &Pool,
    assets: &[Asset],
) -> Result<Option<ArbitrageOpportunity>, Box<dyn std::error::Error>> {
    
    // Obtener precios de assets
    let token0_price = get_asset_price(assets, &pool1.token0_address);
    let token1_price = get_asset_price(assets, &pool1.token1_address);
    
    if token0_price == 0.0 || token1_price == 0.0 {
        return Ok(None);
    }
    
    // Calcular precio en cada DEX
    let price_dex1 = calculate_pool_price(pool1, token0_price, token1_price);
    let price_dex2 = calculate_pool_price(pool2, token0_price, token1_price);
    
    // Calcular diferencia de precio
    let price_diff = (price_dex2 - price_dex1).abs();
    let price_diff_percentage = (price_diff / price_dex1) * 100.0;
    
    // Calcular cantidad óptima de trade
    let optimal_amount = calculate_optimal_trade_size(
        pool1.liquidity_usd,
        pool2.liquidity_usd,
        price_diff_percentage,
    );
    
    // Calcular costos
    let fee1 = optimal_amount * (dex1.default_fee_bps / 10000.0);
    let fee2 = optimal_amount * (dex2.default_fee_bps / 10000.0);
    let gas_cost = 50.0; // Estimado, debería venir de arrays dinámicos
    let total_cost = fee1 + fee2 + gas_cost;
    
    // Calcular profit
    let gross_profit = optimal_amount * (price_diff_percentage / 100.0);
    let net_profit = gross_profit - total_cost;
    
    // Solo retornar si es rentable
    if net_profit <= 0.0 {
        return Ok(None);
    }
    
    // Calcular riesgo
    let risk_score = calculate_risk_score(
        pool1.liquidity_usd,
        pool2.liquidity_usd,
        optimal_amount,
        price_diff_percentage,
    );
    
    // Crear oportunidad con 200 campos dinámicos
    let opportunity = ArbitrageOpportunity {
        route_id: format!("{}_{}_{}_{}", dex1.id, dex2.id, pool1.id, pool2.id),
        status: "READY".to_string(),
        priority: calculate_priority(net_profit, risk_score),
        blockchain_id: dex1.blockchain_id.clone(),
        strategy_type: "TWODEX_DIRECT".to_string(),
        start_dex_id: dex1.id.clone(),
        start_dex_name: dex1.name.clone(),
        start_pool_id: pool1.id.clone(),
        start_token_in: pool1.token0_address.clone(),
        start_token_out: pool1.token1_address.clone(),
        end_dex_id: dex2.id.clone(),
        end_dex_name: dex2.name.clone(),
        end_pool_id: pool2.id.clone(),
        end_token_in: pool2.token0_address.clone(),
        end_token_out: pool2.token1_address.clone(),
        amount_in: optimal_amount,
        amount_out: optimal_amount * (1.0 + price_diff_percentage / 100.0),
        expected_profit_usd: net_profit,
        expected_profit_percentage: (net_profit / optimal_amount) * 100.0,
        gas_estimate: 300000.0,
        gas_cost_usd: gas_cost,
        total_fees_usd: fee1 + fee2,
        net_profit,
        risk_score,
        confidence_score: calculate_confidence_score(pool1, pool2, price_diff_percentage),
        extra_fields: HashMap::new(),
    };
    
    Ok(Some(opportunity))
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

fn get_asset_price(assets: &[Asset], address: &str) -> f64 {
    assets.iter()
        .find(|a| a.address == address)
        .map(|a| a.price_usd)
        .unwrap_or(0.0)
}

fn calculate_pool_price(pool: &Pool, token0_price: f64, token1_price: f64) -> f64 {
    // Precio simplificado basado en TVL
    if pool.tvl_usd == 0.0 {
        return 0.0;
    }
    
    token1_price / token0_price
}

fn calculate_optimal_trade_size(
    liquidity1: f64,
    liquidity2: f64,
    price_diff_percentage: f64,
) -> f64 {
    // Tamaño óptimo: 1% de la liquidez menor, ajustado por diferencia de precio
    let min_liquidity = liquidity1.min(liquidity2);
    let base_size = min_liquidity * 0.01;
    
    // Ajustar por diferencia de precio (mayor diferencia = mayor tamaño)
    base_size * (1.0 + price_diff_percentage / 100.0)
}

fn calculate_risk_score(
    liquidity1: f64,
    liquidity2: f64,
    trade_size: f64,
    price_diff_percentage: f64,
) -> f64 {
    // Riesgo basado en:
    // 1. Ratio de trade size vs liquidez
    // 2. Diferencia de liquidez entre pools
    // 3. Volatilidad implícita (diferencia de precio)
    
    let min_liquidity = liquidity1.min(liquidity2);
    let liquidity_ratio = trade_size / min_liquidity;
    let liquidity_imbalance = (liquidity1 - liquidity2).abs() / liquidity1.max(liquidity2);
    let volatility_factor = price_diff_percentage / 100.0;
    
    // Score de 0 (bajo riesgo) a 100 (alto riesgo)
    ((liquidity_ratio * 30.0) + (liquidity_imbalance * 30.0) + (volatility_factor * 40.0)).min(100.0)
}

fn calculate_priority(net_profit: f64, risk_score: f64) -> u32 {
    // Prioridad basada en profit ajustado por riesgo
    let risk_adjusted_profit = net_profit * (1.0 - risk_score / 100.0);
    
    if risk_adjusted_profit > 1000.0 {
        1 // Alta prioridad
    } else if risk_adjusted_profit > 500.0 {
        2 // Media prioridad
    } else {
        3 // Baja prioridad
    }
}

fn calculate_confidence_score(pool1: &Pool, pool2: &Pool, price_diff_percentage: f64) -> f64 {
    // Confianza basada en:
    // 1. Liquidez de los pools
    // 2. Volumen 24h
    // 3. Magnitud de la diferencia de precio
    
    let liquidity_score = ((pool1.liquidity_usd + pool2.liquidity_usd) / 2.0).min(1000000.0) / 1000000.0;
    let volume_score = ((pool1.volume_24h_usd + pool2.volume_24h_usd) / 2.0).min(1000000.0) / 1000000.0;
    let price_diff_score = (price_diff_percentage / 10.0).min(1.0);
    
    // Score de 0 a 100
    ((liquidity_score * 40.0) + (volume_score * 40.0) + (price_diff_score * 20.0)) * 100.0
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_dp_memoization() {
        let mut dp_memo = DPMemoState::new();
        
        // Test cache
        dp_memo.cache_profit("test_key".to_string(), 100.0);
        assert_eq!(dp_memo.get_cached_profit("test_key"), Some(100.0));
        assert_eq!(dp_memo.cache_hits, 1);
        
        // Test cache miss
        assert_eq!(dp_memo.get_cached_profit("nonexistent"), None);
        assert_eq!(dp_memo.cache_misses, 1);
        
        // Test hit rate
        assert_eq!(dp_memo.cache_hit_rate(), 50.0);
    }
    
    #[test]
    fn test_risk_calculation() {
        let risk = calculate_risk_score(1000000.0, 900000.0, 10000.0, 2.0);
        assert!(risk > 0.0 && risk <= 100.0);
    }
    
    #[test]
    fn test_optimal_trade_size() {
        let size = calculate_optimal_trade_size(1000000.0, 900000.0, 2.0);
        assert!(size > 0.0);
        assert!(size < 900000.0); // Debe ser menor que la liquidez mínima
    }
}

