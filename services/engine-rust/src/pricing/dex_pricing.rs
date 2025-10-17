//! DEX Pricing Engine - Dynamic Pricing for Multiple DEX Types
//! 
//! Este módulo implementa el motor de pricing dinámico que soporta múltiples
//! tipos de DEX (UniswapV2, UniswapV3, Curve, Balancer, etc.) con cálculos
//! precisos de output, slippage y price impact.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ==================================================================================
// TYPES & ENUMS
// ==================================================================================

/// Tipos de DEX soportados (cargados dinámicamente desde Google Sheets)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum DexType {
    UniswapV2,
    UniswapV3,
    SushiSwap,
    PancakeSwap,
    Curve,
    Balancer,
    DODO,
    KyberElastic,
    Custom(String),
}

impl DexType {
    /// Crear DexType desde string (dinámico desde Sheets)
    pub fn from_string(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "uniswapv2" | "uniswap_v2" => DexType::UniswapV2,
            "uniswapv3" | "uniswap_v3" => DexType::UniswapV3,
            "sushiswap" | "sushi" => DexType::SushiSwap,
            "pancakeswap" | "pancake" => DexType::PancakeSwap,
            "curve" => DexType::Curve,
            "balancer" => DexType::Balancer,
            "dodo" => DexType::DODO,
            "kyber" | "kyberelastic" => DexType::KyberElastic,
            custom => DexType::Custom(custom.to_string()),
        }
    }
}

/// Configuración de pool cargada desde Google Sheets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub pool_id: String,
    pub dex_type: DexType,
    pub token_a: String,
    pub token_b: String,
    pub reserve_a: f64,
    pub reserve_b: f64,
    pub fee_bps: u32,           // Fee en basis points (30 = 0.3%)
    pub is_active: bool,
    
    // Parámetros específicos por tipo de DEX
    pub tick_spacing: Option<u32>,      // UniswapV3
    pub current_tick: Option<i32>,      // UniswapV3
    pub amplification: Option<f64>,     // Curve
    pub weights: Option<Vec<f64>>,      // Balancer
}

/// Resultado de cálculo de pricing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingResult {
    pub output_amount: f64,
    pub price_impact: f64,
    pub effective_price: f64,
    pub slippage: f64,
    pub fee_amount: f64,
    pub is_profitable: bool,
    pub warnings: Vec<String>,
}

// ==================================================================================
// DEX PRICING ENGINE
// ==================================================================================

/// Motor de pricing dinámico para múltiples DEXes
pub struct DexPricingEngine {
    /// Configuraciones de pools cargadas desde Google Sheets
    pools: HashMap<String, PoolConfig>,
    
    /// Tolerancia máxima de slippage (%)
    max_slippage: f64,
    
    /// Precio mínimo de impacto aceptable (%)
    max_price_impact: f64,
}

impl DexPricingEngine {
    /// Crear nuevo motor de pricing
    pub fn new(max_slippage: f64, max_price_impact: f64) -> Self {
        Self {
            pools: HashMap::new(),
            max_slippage,
            max_price_impact,
        }
    }
    
    /// Cargar configuración de pools desde datos dinámicos (Google Sheets)
    pub fn load_pools(&mut self, pools: Vec<PoolConfig>) {
        self.pools.clear();
        for pool in pools {
            if pool.is_active {
                self.pools.insert(pool.pool_id.clone(), pool);
            }
        }
    }
    
    /// Obtener pool por ID
    pub fn get_pool(&self, pool_id: &str) -> Option<&PoolConfig> {
        self.pools.get(pool_id)
    }
    
    /// Calcular output para un swap dado
    pub fn calculate_swap(
        &self,
        pool_id: &str,
        input_amount: f64,
        token_in: &str,
    ) -> Result<PricingResult, String> {
        let pool = self.pools.get(pool_id)
            .ok_or_else(|| format!("Pool {} not found", pool_id))?;
        
        if !pool.is_active {
            return Err(format!("Pool {} is not active", pool_id));
        }
        
        // Determinar dirección del swap
        let (reserve_in, reserve_out) = if token_in == pool.token_a {
            (pool.reserve_a, pool.reserve_b)
        } else if token_in == pool.token_b {
            (pool.reserve_b, pool.reserve_a)
        } else {
            return Err(format!("Token {} not in pool {}", token_in, pool_id));
        };
        
        // Calcular según tipo de DEX
        match &pool.dex_type {
            DexType::UniswapV2 | DexType::SushiSwap | DexType::PancakeSwap => {
                self.calculate_constant_product(input_amount, reserve_in, reserve_out, pool.fee_bps)
            }
            DexType::UniswapV3 => {
                self.calculate_uniswap_v3(input_amount, reserve_in, reserve_out, pool)
            }
            DexType::Curve => {
                self.calculate_curve(input_amount, reserve_in, reserve_out, pool)
            }
            DexType::Balancer => {
                self.calculate_balancer(input_amount, reserve_in, reserve_out, pool)
            }
            DexType::DODO => {
                self.calculate_dodo(input_amount, reserve_in, reserve_out, pool)
            }
            DexType::KyberElastic => {
                self.calculate_kyber(input_amount, reserve_in, reserve_out, pool)
            }
            DexType::Custom(name) => {
                Err(format!("Custom DEX type '{}' not implemented", name))
            }
        }
    }
    
    // ================================================================================
    // CONSTANT PRODUCT (UniswapV2, Sushi, Pancake)
    // ================================================================================
    
    fn calculate_constant_product(
        &self,
        input_amount: f64,
        reserve_in: f64,
        reserve_out: f64,
        fee_bps: u32,
    ) -> Result<PricingResult, String> {
        if reserve_in <= 0.0 || reserve_out <= 0.0 {
            return Err("Invalid reserves".to_string());
        }
        
        // Calcular fee (fee_bps / 10000)
        let fee_multiplier = 1.0 - (fee_bps as f64 / 10000.0);
        let input_with_fee = input_amount * fee_multiplier;
        
        // Fórmula: (input_with_fee * reserve_out) / (reserve_in + input_with_fee)
        let output_amount = (input_with_fee * reserve_out) / (reserve_in + input_with_fee);
        
        // Calcular métricas
        let spot_price = reserve_out / reserve_in;
        let effective_price = output_amount / input_amount;
        let price_impact = ((spot_price - effective_price) / spot_price).abs() * 100.0;
        let slippage = ((1.0 - effective_price / spot_price) * 100.0).abs();
        let fee_amount = input_amount * (fee_bps as f64 / 10000.0);
        
        // Validaciones
        let mut warnings = Vec::new();
        
        if price_impact > self.max_price_impact {
            warnings.push(format!("Price impact {:.2}% exceeds maximum {:.2}%", 
                price_impact, self.max_price_impact));
        }
        
        if slippage > self.max_slippage {
            warnings.push(format!("Slippage {:.2}% exceeds maximum {:.2}%", 
                slippage, self.max_slippage));
        }
        
        let is_profitable = warnings.is_empty() && output_amount > 0.0;
        
        Ok(PricingResult {
            output_amount,
            price_impact,
            effective_price,
            slippage,
            fee_amount,
            is_profitable,
            warnings,
        })
    }
    
    // ================================================================================
    // UNISWAP V3 (Concentrated Liquidity)
    // ================================================================================
    
    fn calculate_uniswap_v3(
        &self,
        input_amount: f64,
        reserve_in: f64,
        reserve_out: f64,
        pool: &PoolConfig,
    ) -> Result<PricingResult, String> {
        // Simplificación: usar constant product con ajuste por tick
        // En producción, implementar cálculo completo de concentrated liquidity
        
        let tick_adjustment = pool.current_tick.unwrap_or(0) as f64 / 10000.0;
        let adjusted_reserve_out = reserve_out * (1.0 + tick_adjustment);
        
        self.calculate_constant_product(
            input_amount,
            reserve_in,
            adjusted_reserve_out,
            pool.fee_bps,
        )
    }
    
    // ================================================================================
    // CURVE (StableSwap)
    // ================================================================================
    
    fn calculate_curve(
        &self,
        input_amount: f64,
        reserve_in: f64,
        reserve_out: f64,
        pool: &PoolConfig,
    ) -> Result<PricingResult, String> {
        let amp = pool.amplification.unwrap_or(100.0);
        
        // Fórmula simplificada de Curve StableSwap
        // En producción, implementar cálculo completo con invariante D
        
        let d = reserve_in + reserve_out;
        let ann = amp * 2.0;
        
        let y = reserve_out - (input_amount * reserve_out) / (reserve_in + input_amount * ann / d);
        let output_amount = reserve_out - y;
        
        let fee_amount = output_amount * (pool.fee_bps as f64 / 10000.0);
        let final_output = output_amount - fee_amount;
        
        let spot_price = 1.0; // Stablecoins ~1:1
        let effective_price = final_output / input_amount;
        let price_impact = ((spot_price - effective_price) / spot_price).abs() * 100.0;
        let slippage = ((1.0 - effective_price / spot_price) * 100.0).abs();
        
        Ok(PricingResult {
            output_amount: final_output,
            price_impact,
            effective_price,
            slippage,
            fee_amount,
            is_profitable: final_output > 0.0 && price_impact < self.max_price_impact,
            warnings: Vec::new(),
        })
    }
    
    // ================================================================================
    // BALANCER (Weighted Pools)
    // ================================================================================
    
    fn calculate_balancer(
        &self,
        input_amount: f64,
        reserve_in: f64,
        reserve_out: f64,
        pool: &PoolConfig,
    ) -> Result<PricingResult, String> {
        let weights = pool.weights.as_ref()
            .ok_or("Balancer pool missing weights")?;
        
        if weights.len() < 2 {
            return Err("Invalid weights for Balancer pool".to_string());
        }
        
        let weight_in = weights[0];
        let weight_out = weights[1];
        
        // Fórmula de Balancer: output = reserve_out * (1 - (reserve_in / (reserve_in + input))^(weight_in/weight_out))
        let ratio = reserve_in / (reserve_in + input_amount);
        let power = weight_in / weight_out;
        let output_amount = reserve_out * (1.0 - ratio.powf(power));
        
        let fee_amount = output_amount * (pool.fee_bps as f64 / 10000.0);
        let final_output = output_amount - fee_amount;
        
        let spot_price = (reserve_out / weight_out) / (reserve_in / weight_in);
        let effective_price = final_output / input_amount;
        let price_impact = ((spot_price - effective_price) / spot_price).abs() * 100.0;
        
        Ok(PricingResult {
            output_amount: final_output,
            price_impact,
            effective_price,
            slippage: price_impact,
            fee_amount,
            is_profitable: final_output > 0.0 && price_impact < self.max_price_impact,
            warnings: Vec::new(),
        })
    }
    
    // ================================================================================
    // DODO (Proactive Market Maker)
    // ================================================================================
    
    fn calculate_dodo(
        &self,
        input_amount: f64,
        reserve_in: f64,
        reserve_out: f64,
        pool: &PoolConfig,
    ) -> Result<PricingResult, String> {
        // Simplificación: usar constant product con ajuste
        // En producción, implementar PMM completo
        
        self.calculate_constant_product(
            input_amount,
            reserve_in,
            reserve_out,
            pool.fee_bps,
        )
    }
    
    // ================================================================================
    // KYBER ELASTIC
    // ================================================================================
    
    fn calculate_kyber(
        &self,
        input_amount: f64,
        reserve_in: f64,
        reserve_out: f64,
        pool: &PoolConfig,
    ) -> Result<PricingResult, String> {
        // Similar a UniswapV3
        self.calculate_uniswap_v3(input_amount, reserve_in, reserve_out, pool)
    }
    
    // ================================================================================
    // UTILIDADES
    // ================================================================================
    
    /// Calcular mejor ruta entre múltiples pools
    pub fn find_best_route(
        &self,
        token_in: &str,
        token_out: &str,
        amount_in: f64,
    ) -> Result<Vec<(String, PricingResult)>, String> {
        let mut routes = Vec::new();
        
        // Buscar todos los pools que conecten los tokens
        for (pool_id, pool) in &self.pools {
            if !pool.is_active {
                continue;
            }
            
            // Verificar si el pool conecta los tokens
            let connects = (pool.token_a == token_in && pool.token_b == token_out) ||
                          (pool.token_b == token_in && pool.token_a == token_out);
            
            if connects {
                if let Ok(result) = self.calculate_swap(pool_id, amount_in, token_in) {
                    if result.is_profitable {
                        routes.push((pool_id.clone(), result));
                    }
                }
            }
        }
        
        // Ordenar por mejor output
        routes.sort_by(|a, b| {
            b.1.output_amount.partial_cmp(&a.1.output_amount)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        
        Ok(routes)
    }
    
    /// Actualizar reservas de un pool (después de un swap)
    pub fn update_pool_reserves(
        &mut self,
        pool_id: &str,
        new_reserve_a: f64,
        new_reserve_b: f64,
    ) -> Result<(), String> {
        let pool = self.pools.get_mut(pool_id)
            .ok_or_else(|| format!("Pool {} not found", pool_id))?;
        
        pool.reserve_a = new_reserve_a;
        pool.reserve_b = new_reserve_b;
        
        Ok(())
    }
    
    /// Obtener estadísticas de todos los pools
    pub fn get_pool_stats(&self) -> HashMap<String, PoolStats> {
        self.pools.iter()
            .map(|(id, pool)| {
                let tvl = pool.reserve_a + pool.reserve_b; // Simplificado
                let stats = PoolStats {
                    pool_id: id.clone(),
                    dex_type: pool.dex_type.clone(),
                    tvl,
                    volume_24h: 0.0, // TODO: implementar tracking
                    fee_bps: pool.fee_bps,
                    is_active: pool.is_active,
                };
                (id.clone(), stats)
            })
            .collect()
    }
}

/// Estadísticas de pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    pub pool_id: String,
    pub dex_type: DexType,
    pub tvl: f64,
    pub volume_24h: f64,
    pub fee_bps: u32,
    pub is_active: bool,
}

// ==================================================================================
// TESTS
// ==================================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_constant_product_pricing() {
        let engine = DexPricingEngine::new(5.0, 3.0);
        
        let result = engine.calculate_constant_product(
            1000.0,  // input
            100000.0, // reserve_in
            50000.0,  // reserve_out
            30,       // 0.3% fee
        ).unwrap();
        
        assert!(result.output_amount > 0.0);
        assert!(result.price_impact >= 0.0);
        assert!(result.fee_amount > 0.0);
    }
    
    #[test]
    fn test_pool_loading() {
        let mut engine = DexPricingEngine::new(5.0, 3.0);
        
        let pools = vec![
            PoolConfig {
                pool_id: "pool1".to_string(),
                dex_type: DexType::UniswapV2,
                token_a: "USDC".to_string(),
                token_b: "USDT".to_string(),
                reserve_a: 1000000.0,
                reserve_b: 1000000.0,
                fee_bps: 30,
                is_active: true,
                tick_spacing: None,
                current_tick: None,
                amplification: None,
                weights: None,
            }
        ];
        
        engine.load_pools(pools);
        assert_eq!(engine.pools.len(), 1);
        assert!(engine.get_pool("pool1").is_some());
    }
}

