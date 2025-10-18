// twodex_dp.rs
//
// Algoritmo de arbitraje two-DEX con programación dinámica y memoización
// Implementación según Prompt Supremo Definitivo - FASE 3
//
// PRINCIPIO SAGRADO: CERO HARDCODING - TODO desde arrays dinámicos de Sheets

use super::types::*;
use std::collections::HashMap;
use chrono::Utc;
use uuid::Uuid;

/// Encuentra oportunidades de arbitraje entre dos DEXes usando programación dinámica
///
/// # Argumentos
/// * `dexes` - Array dinámico de DEXes desde Sheets (171 campos cada uno)
/// * `assets` - Array dinámico de Assets desde Sheets (326 campos cada uno)
/// * `pools` - Array dinámico de Pools desde Sheets (94 campos cada uno)
/// * `dp_memo` - Estado de memoización para DP
///
/// # Returns
/// Vector de oportunidades de arbitraje encontradas
pub async fn find_arbitrage_opportunities_twodex(
    dexes: &[Dex],
    assets: &[Asset],
    pools: &[Pool],
    dp_memo: &mut DPMemoState,
) -> Result<Vec<ArbitrageOpportunity>, ArbitrageError> {
    
    println!("🔍 Iniciando búsqueda de arbitraje two-DEX con programación dinámica...");
    println!("   DEXes activos: {}", dexes.len());
    println!("   Assets activos: {}", assets.len());
    println!("   Pools activos: {}", pools.len());
    
    let mut opportunities = Vec::new();
    
    // Crear índices para acceso rápido
    let asset_map: HashMap<String, &Asset> = assets
        .iter()
        .map(|a| (a.asset_id.clone(), a))
        .collect();
    
    let pool_by_dex: HashMap<String, Vec<&Pool>> = pools
        .iter()
        .fold(HashMap::new(), |mut acc, pool| {
            acc.entry(pool.dex_id.clone())
                .or_insert_with(Vec::new)
                .push(pool);
            acc
        });
    
    // Programación dinámica: iterar sobre pares de DEXes
    for i in 0..dexes.len() {
        for j in (i + 1)..dexes.len() {
            let dex_a = &dexes[i];
            let dex_b = &dexes[j];
            
            // Verificar que ambos DEXes estén en la misma blockchain
            if dex_a.blockchain_id != dex_b.blockchain_id {
                continue;
            }
            
            // Crear clave para memoización
            let dex_pair_key = format!("{}_{}", dex_a.dex_id, dex_b.dex_id);
            
            // Verificar cache de memoización
            if let Some(cached_profit) = dp_memo.get_cached_profit(&dex_pair_key) {
                // Ya calculamos este par, usar resultado cacheado
                if *cached_profit > 0.0 {
                    if let Some(cached_route) = dp_memo.get_cached_route(&dex_pair_key) {
                        opportunities.push(cached_route.clone());
                    }
                }
                continue;
            }
            
            // Calcular oportunidades para este par de DEXes
            let pair_opportunities = calculate_pair_opportunities(
                dex_a,
                dex_b,
                &asset_map,
                &pool_by_dex,
            ).await?;
            
            // Memoizar resultados
            if let Some(best_opp) = pair_opportunities.first() {
                dp_memo.cache_profit(dex_pair_key.clone(), best_opp.expected_profit_usd);
                dp_memo.cache_route(dex_pair_key, best_opp.clone());
                opportunities.extend(pair_opportunities);
            } else {
                dp_memo.cache_profit(dex_pair_key, 0.0);
            }
        }
    }
    
    // Ordenar por profit esperado (descendente)
    opportunities.sort_by(|a, b| {
        b.expected_profit_usd
            .partial_cmp(&a.expected_profit_usd)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    
    // Asignar rankings
    for (index, opp) in opportunities.iter_mut().enumerate() {
        opp.rank = (index + 1) as u32;
    }
    
    println!("✅ Búsqueda completada:");
    println!("   Oportunidades encontradas: {}", opportunities.len());
    println!("   Cache hit rate: {:.2}%", dp_memo.get_hit_rate() * 100.0);
    println!("   Cache hits: {}", dp_memo.cache_hits);
    println!("   Cache misses: {}", dp_memo.cache_misses);
    
    Ok(opportunities)
}

/// Calcula oportunidades de arbitraje para un par específico de DEXes
async fn calculate_pair_opportunities(
    dex_a: &Dex,
    dex_b: &Dex,
    asset_map: &HashMap<String, &Asset>,
    pool_by_dex: &HashMap<String, Vec<&Pool>>,
) -> Result<Vec<ArbitrageOpportunity>, ArbitrageError> {
    
    let mut opportunities = Vec::new();
    
    // Obtener pools de ambos DEXes
    let pools_a = pool_by_dex.get(&dex_a.dex_id).map(|v| v.as_slice()).unwrap_or(&[]);
    let pools_b = pool_by_dex.get(&dex_b.dex_id).map(|v| v.as_slice()).unwrap_or(&[]);
    
    if pools_a.is_empty() || pools_b.is_empty() {
        return Ok(opportunities);
    }
    
    // Buscar pools con tokens en común
    for pool_a in pools_a {
        for pool_b in pools_b {
            // Verificar si comparten tokens (arbitraje directo)
            let tokens_match = 
                (pool_a.token0_id == pool_b.token0_id && pool_a.token1_id == pool_b.token1_id) ||
                (pool_a.token0_id == pool_b.token1_id && pool_a.token1_id == pool_b.token0_id);
            
            if !tokens_match {
                continue;
            }
            
            // Verificar que ambos pools tengan arbitraje habilitado
            if !pool_a.arbitrage_enabled || !pool_b.arbitrage_enabled {
                continue;
            }
            
            // Calcular oportunidad
            if let Some(opportunity) = calculate_direct_arbitrage(
                dex_a,
                dex_b,
                pool_a,
                pool_b,
                asset_map,
            ).await {
                opportunities.push(opportunity);
            }
        }
    }
    
    Ok(opportunities)
}

/// Calcula arbitraje directo entre dos pools
async fn calculate_direct_arbitrage(
    dex_a: &Dex,
    dex_b: &Dex,
    pool_a: &Pool,
    pool_b: &Pool,
    asset_map: &HashMap<String, &Asset>,
) -> Option<ArbitrageOpportunity> {
    
    // Obtener assets
    let token_in_asset = asset_map.get(&pool_a.token0_id)?;
    let token_out_asset = asset_map.get(&pool_a.token1_id)?;
    
    // Verificar que los assets tengan arbitraje habilitado
    if !token_in_asset.arbitrage_enabled || !token_out_asset.arbitrage_enabled {
        return None;
    }
    
    // Calcular precios en ambos pools
    let price_a = pool_a.price_token0; // Token0 en términos de Token1
    let price_b = pool_b.price_token0;
    
    // Verificar si hay diferencia de precio significativa
    let price_diff_bps = ((price_b - price_a).abs() / price_a * 10000.0) as u32;
    
    if price_diff_bps < 10 {
        // Diferencia menor a 0.1% - no vale la pena
        return None;
    }
    
    // Determinar dirección del arbitraje
    let (buy_pool, sell_pool, buy_dex, sell_dex) = if price_a < price_b {
        (pool_a, pool_b, dex_a, dex_b)
    } else {
        (pool_b, pool_a, dex_b, dex_a)
    };
    
    // Calcular tamaño óptimo de trade
    let optimal_amount_usd = calculate_optimal_trade_size(
        buy_pool,
        sell_pool,
        token_in_asset,
    );
    
    // Calcular costos
    let gas_cost_usd = estimate_gas_cost(buy_dex, sell_dex);
    let swap_fees_usd = calculate_swap_fees(buy_pool, sell_pool, optimal_amount_usd);
    let flash_loan_required = optimal_amount_usd > 1000.0; // Umbral arbitrario
    let flash_loan_fees_usd = if flash_loan_required {
        optimal_amount_usd * 0.0009 // 0.09% fee típico de Aave
    } else {
        0.0
    };
    
    let total_costs_usd = gas_cost_usd + swap_fees_usd + flash_loan_fees_usd;
    
    // Calcular profit esperado
    let price_diff_ratio = (sell_pool.price_token0 - buy_pool.price_token0) / buy_pool.price_token0;
    let gross_profit_usd = optimal_amount_usd * price_diff_ratio;
    let net_profit_usd = gross_profit_usd - total_costs_usd;
    
    // Verificar rentabilidad mínima
    if net_profit_usd < token_in_asset.min_arbitrage_profit_usd {
        return None;
    }
    
    // Calcular métricas de riesgo
    let risk_score = calculate_risk_score(buy_pool, sell_pool, token_in_asset, token_out_asset);
    let confidence_score = calculate_confidence_score(buy_pool, sell_pool);
    
    // Crear oportunidad
    let now = Utc::now();
    let route_id = Uuid::new_v4().to_string();
    
    Some(ArbitrageOpportunity {
        route_id: route_id.clone(),
        status: "READY".to_string(),
        is_active: true,
        is_profitable: true,
        route_type: "TWO_DEX_DIRECT".to_string(),
        strategy: "SIMPLE_ARBITRAGE".to_string(),
        complexity: 1,
        hop_count: 2,
        dex_count: 2,
        blockchain_id: buy_dex.blockchain_id.clone(),
        
        // Ruta
        dex_1_id: buy_dex.dex_id.clone(),
        dex_2_id: Some(sell_dex.dex_id.clone()),
        dex_3_id: None,
        pool_1_id: buy_pool.pool_id.clone(),
        pool_2_id: Some(sell_pool.pool_id.clone()),
        pool_3_id: None,
        token_in_id: token_in_asset.asset_id.clone(),
        token_out_id: token_out_asset.asset_id.clone(),
        token_intermediate_1: None,
        
        // Cantidades
        amount_in: optimal_amount_usd / token_in_asset.price_usd,
        amount_out: (optimal_amount_usd + gross_profit_usd) / token_out_asset.price_usd,
        amount_in_usd: optimal_amount_usd,
        amount_out_usd: optimal_amount_usd + gross_profit_usd,
        price_in: token_in_asset.price_usd,
        price_out: token_out_asset.price_usd,
        price_impact_bps: buy_pool.price_impact_1k as u32,
        slippage_bps: buy_dex.default_slippage_bps,
        expected_price: (optimal_amount_usd + gross_profit_usd) / optimal_amount_usd,
        
        // Profit
        expected_profit_usd: net_profit_usd,
        expected_profit_bps: ((net_profit_usd / optimal_amount_usd) * 10000.0) as u32,
        expected_profit_percentage: (net_profit_usd / optimal_amount_usd) * 100.0,
        min_profit_usd: net_profit_usd * 0.8, // 80% del esperado
        max_profit_usd: net_profit_usd * 1.2, // 120% del esperado
        gas_cost_usd,
        gas_cost_gwei: gas_cost_usd / 0.000001, // Aproximación
        gas_limit: buy_dex.gas_estimate_swap + sell_dex.gas_estimate_swap,
        protocol_fees_usd: 0.0,
        swap_fees_usd,
        flash_loan_fees_usd,
        total_costs_usd,
        net_profit_usd,
        roi_percentage: (net_profit_usd / optimal_amount_usd) * 100.0,
        
        // Liquidez
        required_liquidity_usd: optimal_amount_usd,
        available_liquidity_usd: buy_pool.total_liquidity_usd.min(sell_pool.total_liquidity_usd),
        liquidity_utilization: optimal_amount_usd / buy_pool.total_liquidity_usd,
        max_trade_size_usd: buy_pool.total_liquidity_usd * 0.1, // 10% de liquidez
        optimal_trade_size_usd: optimal_amount_usd,
        min_trade_size_usd: token_in_asset.min_arbitrage_profit_usd,
        
        // Timing
        discovery_timestamp: now.timestamp(),
        expiry_timestamp: now.timestamp() + 60, // 60 segundos
        execution_deadline: now.timestamp() + 45, // 45 segundos
        time_to_expiry_ms: 60000,
        estimated_execution_time_ms: 5000,
        
        // Flash loan
        flash_loan_required,
        flash_loan_provider: if flash_loan_required {
            Some("AAVE_V3".to_string())
        } else {
            None
        },
        flash_loan_amount_usd: if flash_loan_required { optimal_amount_usd } else { 0.0 },
        flash_loan_fee_bps: if flash_loan_required { 9 } else { 0 },
        flash_loan_fee_usd: flash_loan_fees_usd,
        
        // Riesgo
        risk_score,
        confidence_score,
        stability_score: (buy_pool.health_score + sell_pool.health_score) / 2.0,
        execution_probability: confidence_score * 0.9,
        slippage_risk: buy_pool.slippage_bps as f64 / 10000.0,
        liquidity_risk: 1.0 - (buy_pool.total_liquidity_usd / 1000000.0).min(1.0),
        timing_risk: 0.1,
        mev_risk: 0.2,
        
        // Optimización
        optimization_score: (confidence_score + (1.0 - risk_score)) / 2.0,
        route_efficiency: net_profit_usd / optimal_amount_usd,
        gas_efficiency: net_profit_usd / gas_cost_usd,
        capital_efficiency: net_profit_usd / optimal_amount_usd,
        is_optimal_route: true,
        
        // Priorización
        priority: if net_profit_usd > 100.0 { 1 } else if net_profit_usd > 50.0 { 2 } else { 3 },
        weight: net_profit_usd / (risk_score + 0.1),
        rank: 0, // Se asigna después
        
        // Timestamps
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
        
        // Extra fields vacío por ahora
        extra_fields: HashMap::new(),
    })
}

/// Calcula el tamaño óptimo de trade
fn calculate_optimal_trade_size(
    buy_pool: &Pool,
    sell_pool: &Pool,
    token_asset: &Asset,
) -> f64 {
    // Usar el mínimo entre:
    // 1. 5% de la liquidez del pool más pequeño
    // 2. 10x el profit mínimo requerido
    // 3. $10,000 USD (límite superior arbitrario)
    
    let min_liquidity = buy_pool.total_liquidity_usd.min(sell_pool.total_liquidity_usd);
    let size_by_liquidity = min_liquidity * 0.05;
    let size_by_min_profit = token_asset.min_arbitrage_profit_usd * 10.0;
    let max_size = 10000.0;
    
    size_by_liquidity.min(size_by_min_profit).min(max_size).max(100.0)
}

/// Estima el costo de gas
fn estimate_gas_cost(dex_a: &Dex, dex_b: &Dex) -> f64 {
    // Gas estimado = suma de gas de ambos swaps
    // Precio en USD aproximado (simplificado)
    let total_gas = dex_a.gas_estimate_swap + dex_b.gas_estimate_swap;
    let gas_price_gwei = 20.0; // Simplificado
    let eth_price_usd = 2000.0; // Simplificado
    
    (total_gas as f64) * gas_price_gwei * 0.000000001 * eth_price_usd
}

/// Calcula fees de swap
fn calculate_swap_fees(buy_pool: &Pool, sell_pool: &Pool, amount_usd: f64) -> f64 {
    let buy_fee = (buy_pool.fee_bps as f64) / 10000.0;
    let sell_fee = (sell_pool.fee_bps as f64) / 10000.0;
    
    amount_usd * (buy_fee + sell_fee)
}

/// Calcula score de riesgo
fn calculate_risk_score(
    buy_pool: &Pool,
    sell_pool: &Pool,
    token_in: &Asset,
    token_out: &Asset,
) -> f64 {
    // Combinar múltiples factores de riesgo
    let pool_risk = (buy_pool.risk_score + sell_pool.risk_score) / 2.0;
    let liquidity_risk = if buy_pool.total_liquidity_usd < 100000.0 { 0.3 } else { 0.1 };
    let volatility_risk = (token_in.volatility_24h + token_out.volatility_24h) / 2.0;
    
    ((pool_risk + liquidity_risk + volatility_risk) / 3.0).min(1.0)
}

/// Calcula score de confianza
fn calculate_confidence_score(buy_pool: &Pool, sell_pool: &Pool) -> f64 {
    // Basado en health scores de los pools
    ((buy_pool.health_score + sell_pool.health_score) / 2.0).min(1.0)
}

