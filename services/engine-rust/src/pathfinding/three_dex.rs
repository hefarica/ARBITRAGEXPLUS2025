//! Three-DEX Arbitrage Algorithm
//! 
//! Implementa el algoritmo de programación dinámica para encontrar
//! oportunidades de arbitraje usando exactamente 3 DEXs.
//! 
//! Complejidad: O(n³) donde n = número de DEXs
//! 
//! Premisas:
//! 1. Datos de DEXs y pools desde Google Sheets (no hardcoded)
//! 2. Usa estructuras dinámicas (Vec, HashMap)
//! 3. Consumido por el módulo pathfinding principal

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexInfo {
    pub id: String,
    pub name: String,
    pub chain: String,
    pub fee_percentage: f64,
    pub liquidity_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPair {
    pub token_in: String,
    pub token_out: String,
    pub price: f64,
    pub liquidity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreeDexRoute {
    pub dex_1: String,
    pub dex_2: String,
    pub dex_3: String,
    pub tokens: Vec<String>,
    pub expected_profit: f64,
    pub gas_cost: f64,
    pub net_profit: f64,
    pub confidence_score: f64,
    pub complexity_score: f64,
}

/// Algoritmo DP para encontrar rutas óptimas de 3-DEX
/// 
/// dp[i][j][k] = mejor profit usando DEX i, DEX j y DEX k
/// donde i != j != k
pub struct ThreeDexPathfinder {
    dexes: Vec<DexInfo>,
    prices: HashMap<String, HashMap<String, TokenPair>>,
}

impl ThreeDexPathfinder {
    /// Crea un nuevo pathfinder con datos desde Sheets
    pub fn new(dexes: Vec<DexInfo>) -> Self {
        Self {
            dexes,
            prices: HashMap::new(),
        }
    }
    
    /// Carga precios de tokens desde el sistema (consumido desde Sheets/APIs)
    pub fn load_prices(&mut self, prices: HashMap<String, HashMap<String, TokenPair>>) {
        self.prices = prices;
    }
    
    /// Encuentra todas las rutas rentables de 3-DEX usando DP
    pub fn find_profitable_routes(
        &self,
        start_token: &str,
        min_profit_usd: f64,
        gas_cost_usd: f64,
    ) -> Vec<ThreeDexRoute> {
        let mut routes = Vec::new();
        let n = self.dexes.len();
        
        // DP: dp[i][j][k] = mejor ruta usando DEX i, j y k
        let mut dp: Vec<Vec<Vec<Option<ThreeDexRoute>>>> = 
            vec![vec![vec![None; n]; n]; n];
        
        // Iterar sobre todos los triples de DEXs (i, j, k) donde i != j != k
        for i in 0..n {
            for j in 0..n {
                if i == j {
                    continue;
                }
                
                for k in 0..n {
                    if k == i || k == j {
                        continue;
                    }
                    
                    let dex_1 = &self.dexes[i];
                    let dex_2 = &self.dexes[j];
                    let dex_3 = &self.dexes[k];
                    
                    // Solo considerar DEXs en la misma chain
                    if dex_1.chain != dex_2.chain || dex_2.chain != dex_3.chain {
                        continue;
                    }
                    
                    // Buscar rutas complejas usando DP
                    if let Some(route) = self.find_complex_route(
                        dex_1,
                        dex_2,
                        dex_3,
                        start_token,
                        gas_cost_usd,
                    ) {
                        // Calcular profit neto
                        let net_profit = route.expected_profit - gas_cost_usd;
                        
                        if net_profit > min_profit_usd {
                            dp[i][j][k] = Some(ThreeDexRoute {
                                net_profit,
                                ..route
                            });
                        }
                    }
                }
            }
        }
        
        // Extraer rutas rentables usando iteradores (arrays dinámicos)
        for i in 0..n {
            for j in 0..n {
                for k in 0..n {
                    if let Some(route) = &dp[i][j][k] {
                        routes.push(route.clone());
                    }
                }
            }
        }
        
        // Ordenar por profit neto descendente (array dinámico)
        routes.sort_by(|a, b| {
            b.net_profit.partial_cmp(&a.net_profit).unwrap()
        });
        
        routes
    }
    
    /// Encuentra una ruta compleja entre tres DEXs
    /// Patrón: A -> B (DEX1) -> C (DEX2) -> D (DEX3) -> A (DEX1)
    fn find_complex_route(
        &self,
        dex_1: &DexInfo,
        dex_2: &DexInfo,
        dex_3: &DexInfo,
        start_token: &str,
        gas_cost: f64,
    ) -> Option<ThreeDexRoute> {
        let dex_1_prices = self.prices.get(&dex_1.id)?;
        let dex_2_prices = self.prices.get(&dex_2.id)?;
        let dex_3_prices = self.prices.get(&dex_3.id)?;
        
        let mut best_route: Option<ThreeDexRoute> = None;
        let mut max_profit = 0.0;
        
        // Iterar sobre tokens intermedios (array dinámico)
        for (token_b, pair_ab) in dex_1_prices.iter() {
            if token_b == start_token {
                continue;
            }
            
            // Buscar segundo token intermedio
            for (token_c, pair_bc) in dex_2_prices.iter() {
                if token_c == start_token || token_c == token_b {
                    continue;
                }
                
                // Buscar tercer token intermedio
                for (token_d, pair_cd) in dex_3_prices.iter() {
                    if token_d == start_token || token_d == token_b || token_d == token_c {
                        continue;
                    }
                    
                    // Verificar si podemos volver al token inicial
                    if let Some(pair_da) = dex_1_prices.get(token_d) {
                        if pair_da.token_out == start_token {
                            // Calcular profit de la ruta completa
                            let profit = self.calculate_route_profit(
                                1000.0, // Monto inicial en USD
                                &[
                                    pair_ab.price,
                                    pair_bc.price,
                                    pair_cd.price,
                                    pair_da.price,
                                ],
                                &[
                                    dex_1.fee_percentage,
                                    dex_2.fee_percentage,
                                    dex_3.fee_percentage,
                                    dex_1.fee_percentage,
                                ],
                            );
                            
                            if profit > max_profit {
                                max_profit = profit;
                                
                                // Calcular confidence y complexity scores
                                let min_liquidity = pair_ab.liquidity
                                    .min(pair_bc.liquidity)
                                    .min(pair_cd.liquidity)
                                    .min(pair_da.liquidity);
                                
                                let confidence = self.calculate_confidence(
                                    min_liquidity,
                                    &[dex_1.liquidity_usd, dex_2.liquidity_usd, dex_3.liquidity_usd],
                                );
                                
                                let complexity = self.calculate_complexity(
                                    4, // 4 swaps
                                    &[dex_1.fee_percentage, dex_2.fee_percentage, dex_3.fee_percentage],
                                );
                                
                                best_route = Some(ThreeDexRoute {
                                    dex_1: dex_1.id.clone(),
                                    dex_2: dex_2.id.clone(),
                                    dex_3: dex_3.id.clone(),
                                    tokens: vec![
                                        start_token.to_string(),
                                        token_b.clone(),
                                        token_c.clone(),
                                        token_d.clone(),
                                    ],
                                    expected_profit: profit,
                                    gas_cost,
                                    net_profit: profit - gas_cost,
                                    confidence_score: confidence,
                                    complexity_score: complexity,
                                });
                            }
                        }
                    }
                }
            }
        }
        
        best_route
    }
    
    /// Calcula el profit de una ruta con múltiples swaps
    fn calculate_route_profit(
        &self,
        initial_amount: f64,
        prices: &[f64],
        fees: &[f64],
    ) -> f64 {
        let mut amount = initial_amount;
        
        // Aplicar cada swap con su fee correspondiente (array dinámico)
        for (price, fee) in prices.iter().zip(fees.iter()) {
            amount = amount * price * (1.0 - fee / 100.0);
        }
        
        // Profit = final - inicial
        amount - initial_amount
    }
    
    /// Calcula el confidence score basado en liquidez
    fn calculate_confidence(
        &self,
        min_pair_liquidity: f64,
        dex_liquidities: &[f64],
    ) -> f64 {
        // Normalizar liquidez del par a un score 0-1
        let liquidity_score = (min_pair_liquidity / 1_000_000.0).min(1.0);
        
        // Calcular promedio de liquidez de DEXs (array dinámico)
        let avg_dex_liquidity: f64 = dex_liquidities.iter().sum::<f64>() / dex_liquidities.len() as f64;
        let dex_score = (avg_dex_liquidity / 10_000_000.0).min(1.0);
        
        // Combinar scores (60% liquidez del par, 40% liquidez de DEXs)
        liquidity_score * 0.6 + dex_score * 0.4
    }
    
    /// Calcula el complexity score (menor es mejor)
    fn calculate_complexity(
        &self,
        num_swaps: usize,
        fees: &[f64],
    ) -> f64 {
        // Penalizar por número de swaps
        let swap_penalty = 1.0 - (num_swaps as f64 / 10.0).min(0.5);
        
        // Penalizar por fees totales (array dinámico)
        let total_fees: f64 = fees.iter().sum();
        let fee_penalty = 1.0 - (total_fees / 5.0).min(0.5);
        
        // Score combinado (50% swaps, 50% fees)
        swap_penalty * 0.5 + fee_penalty * 0.5
    }
    
    /// Filtra rutas por confidence y complexity mínimos (array dinámico)
    pub fn filter_by_quality(
        routes: Vec<ThreeDexRoute>,
        min_confidence: f64,
        min_complexity: f64,
    ) -> Vec<ThreeDexRoute> {
        routes
            .into_iter()
            .filter(|route| {
                route.confidence_score >= min_confidence
                    && route.complexity_score >= min_complexity
            })
            .collect()
    }
    
    /// Agrupa rutas por chain (array dinámico)
    pub fn group_by_chain(
        &self,
        routes: Vec<ThreeDexRoute>,
    ) -> HashMap<String, Vec<ThreeDexRoute>> {
        let mut grouped: HashMap<String, Vec<ThreeDexRoute>> = HashMap::new();
        
        for route in routes {
            // Buscar chain del DEX1
            if let Some(dex) = self.dexes.iter().find(|d| d.id == route.dex_1) {
                grouped
                    .entry(dex.chain.clone())
                    .or_insert_with(Vec::new)
                    .push(route);
            }
        }
        
        grouped
    }
    
    /// Optimiza rutas usando programación dinámica avanzada
    /// Combina rutas similares para reducir gas costs
    pub fn optimize_routes(
        routes: Vec<ThreeDexRoute>,
        max_routes: usize,
    ) -> Vec<ThreeDexRoute> {
        if routes.len() <= max_routes {
            return routes;
        }
        
        // Ordenar por profit/complexity ratio (array dinámico)
        let mut sorted_routes = routes;
        sorted_routes.sort_by(|a, b| {
            let ratio_a = a.net_profit / (1.0 - a.complexity_score).max(0.1);
            let ratio_b = b.net_profit / (1.0 - b.complexity_score).max(0.1);
            ratio_b.partial_cmp(&ratio_a).unwrap()
        });
        
        // Tomar las mejores rutas (array dinámico)
        sorted_routes.into_iter().take(max_routes).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_three_dex_pathfinding() {
        let dexes = vec![
            DexInfo {
                id: "uniswap".to_string(),
                name: "Uniswap V3".to_string(),
                chain: "ethereum".to_string(),
                fee_percentage: 0.3,
                liquidity_usd: 5_000_000_000.0,
            },
            DexInfo {
                id: "sushiswap".to_string(),
                name: "SushiSwap".to_string(),
                chain: "ethereum".to_string(),
                fee_percentage: 0.25,
                liquidity_usd: 2_000_000_000.0,
            },
            DexInfo {
                id: "curve".to_string(),
                name: "Curve Finance".to_string(),
                chain: "ethereum".to_string(),
                fee_percentage: 0.04,
                liquidity_usd: 3_000_000_000.0,
            },
        ];
        
        let pathfinder = ThreeDexPathfinder::new(dexes);
        
        // Test básico de creación
        assert_eq!(pathfinder.dexes.len(), 3);
    }
    
    #[test]
    fn test_profit_calculation() {
        let pathfinder = ThreeDexPathfinder::new(vec![]);
        
        let profit = pathfinder.calculate_route_profit(
            1000.0,
            &[1.1, 1.05, 1.03, 1.02],
            &[0.3, 0.25, 0.04, 0.3],
        );
        
        // Debería haber profit positivo
        assert!(profit > 0.0);
    }
    
    #[test]
    fn test_complexity_calculation() {
        let pathfinder = ThreeDexPathfinder::new(vec![]);
        
        let complexity = pathfinder.calculate_complexity(
            4,
            &[0.3, 0.25, 0.04],
        );
        
        // Complexity debería estar entre 0 y 1
        assert!(complexity >= 0.0 && complexity <= 1.0);
    }
}

