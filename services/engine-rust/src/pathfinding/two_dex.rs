//! Two-DEX Arbitrage Algorithm
//! 
//! Implementa el algoritmo de programación dinámica para encontrar
//! oportunidades de arbitraje usando exactamente 2 DEXs.
//! 
//! Complejidad: O(n²) donde n = número de DEXs
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
pub struct TwoDexRoute {
    pub dex_1: String,
    pub dex_2: String,
    pub token_start: String,
    pub token_mid: String,
    pub token_end: String,
    pub expected_profit: f64,
    pub gas_cost: f64,
    pub net_profit: f64,
    pub confidence_score: f64,
}

/// Algoritmo DP para encontrar rutas óptimas de 2-DEX
/// 
/// dp[i][j] = mejor profit usando DEX i y DEX j
/// donde i != j
pub struct TwoDexPathfinder {
    dexes: Vec<DexInfo>,
    prices: HashMap<String, HashMap<String, TokenPair>>,
}

impl TwoDexPathfinder {
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
    
    /// Encuentra todas las rutas rentables de 2-DEX usando DP
    pub fn find_profitable_routes(
        &self,
        start_token: &str,
        min_profit_usd: f64,
        gas_cost_usd: f64,
    ) -> Vec<TwoDexRoute> {
        let mut routes = Vec::new();
        let n = self.dexes.len();
        
        // DP: dp[i][j] = mejor ruta usando DEX i y DEX j
        let mut dp: Vec<Vec<Option<TwoDexRoute>>> = vec![vec![None; n]; n];
        
        // Iterar sobre todos los pares de DEXs (i, j) donde i != j
        for i in 0..n {
            for j in 0..n {
                if i == j {
                    continue;
                }
                
                let dex_1 = &self.dexes[i];
                let dex_2 = &self.dexes[j];
                
                // Solo considerar DEXs en la misma chain
                if dex_1.chain != dex_2.chain {
                    continue;
                }
                
                // Buscar rutas triangulares usando DP
                if let Some(route) = self.find_triangular_route(
                    dex_1,
                    dex_2,
                    start_token,
                    gas_cost_usd,
                ) {
                    // Calcular profit neto
                    let net_profit = route.expected_profit - gas_cost_usd;
                    
                    if net_profit > min_profit_usd {
                        dp[i][j] = Some(TwoDexRoute {
                            net_profit,
                            ..route
                        });
                    }
                }
            }
        }
        
        // Extraer rutas rentables usando iteradores (arrays dinámicos)
        for i in 0..n {
            for j in 0..n {
                if let Some(route) = &dp[i][j] {
                    routes.push(route.clone());
                }
            }
        }
        
        // Ordenar por profit neto descendente (array dinámico)
        routes.sort_by(|a, b| {
            b.net_profit.partial_cmp(&a.net_profit).unwrap()
        });
        
        routes
    }
    
    /// Encuentra una ruta triangular entre dos DEXs
    /// Patrón: Token A -> Token B (DEX1) -> Token C (DEX2) -> Token A (DEX1)
    fn find_triangular_route(
        &self,
        dex_1: &DexInfo,
        dex_2: &DexInfo,
        start_token: &str,
        gas_cost: f64,
    ) -> Option<TwoDexRoute> {
        // Obtener precios de DEX1
        let dex_1_prices = self.prices.get(&dex_1.id)?;
        
        // Obtener precios de DEX2
        let dex_2_prices = self.prices.get(&dex_2.id)?;
        
        // Buscar tokens intermedios disponibles en ambos DEXs
        let mut best_route: Option<TwoDexRoute> = None;
        let mut max_profit = 0.0;
        
        // Iterar sobre tokens intermedios posibles (array dinámico)
        for (mid_token, pair_1) in dex_1_prices.iter() {
            if mid_token == start_token {
                continue;
            }
            
            // Verificar si el token intermedio está en DEX2
            if !dex_2_prices.contains_key(mid_token) {
                continue;
            }
            
            // Buscar token final que cierre el ciclo
            for (end_token, pair_2) in dex_2_prices.iter() {
                if end_token == start_token || end_token == mid_token {
                    continue;
                }
                
                // Verificar si podemos volver al token inicial
                if let Some(pair_3) = dex_1_prices.get(end_token) {
                    if pair_3.token_out == start_token {
                        // Calcular profit de la ruta completa
                        let profit = self.calculate_route_profit(
                            1000.0, // Monto inicial en USD
                            pair_1.price,
                            pair_2.price,
                            pair_3.price,
                            dex_1.fee_percentage,
                            dex_2.fee_percentage,
                        );
                        
                        if profit > max_profit {
                            max_profit = profit;
                            
                            // Calcular confidence score basado en liquidez
                            let min_liquidity = pair_1.liquidity
                                .min(pair_2.liquidity)
                                .min(pair_3.liquidity);
                            
                            let confidence = self.calculate_confidence(
                                min_liquidity,
                                dex_1.liquidity_usd,
                                dex_2.liquidity_usd,
                            );
                            
                            best_route = Some(TwoDexRoute {
                                dex_1: dex_1.id.clone(),
                                dex_2: dex_2.id.clone(),
                                token_start: start_token.to_string(),
                                token_mid: mid_token.clone(),
                                token_end: end_token.clone(),
                                expected_profit: profit,
                                gas_cost,
                                net_profit: profit - gas_cost,
                                confidence_score: confidence,
                            });
                        }
                    }
                }
            }
        }
        
        best_route
    }
    
    /// Calcula el profit de una ruta considerando fees
    fn calculate_route_profit(
        &self,
        initial_amount: f64,
        price_1: f64,
        price_2: f64,
        price_3: f64,
        fee_1: f64,
        fee_2: f64,
    ) -> f64 {
        // Paso 1: Swap en DEX1 (aplicar fee)
        let amount_after_swap_1 = initial_amount * price_1 * (1.0 - fee_1 / 100.0);
        
        // Paso 2: Swap en DEX2 (aplicar fee)
        let amount_after_swap_2 = amount_after_swap_1 * price_2 * (1.0 - fee_2 / 100.0);
        
        // Paso 3: Swap de vuelta en DEX1 (aplicar fee)
        let final_amount = amount_after_swap_2 * price_3 * (1.0 - fee_1 / 100.0);
        
        // Profit = final - inicial
        final_amount - initial_amount
    }
    
    /// Calcula el confidence score basado en liquidez
    fn calculate_confidence(
        &self,
        min_pair_liquidity: f64,
        dex_1_liquidity: f64,
        dex_2_liquidity: f64,
    ) -> f64 {
        // Normalizar liquidez a un score 0-1
        let liquidity_score = (min_pair_liquidity / 1_000_000.0).min(1.0);
        
        // Considerar liquidez total de los DEXs
        let dex_score = ((dex_1_liquidity + dex_2_liquidity) / 10_000_000.0).min(1.0);
        
        // Combinar scores (70% liquidez del par, 30% liquidez de DEXs)
        liquidity_score * 0.7 + dex_score * 0.3
    }
    
    /// Filtra rutas por confidence score mínimo (array dinámico)
    pub fn filter_by_confidence(
        routes: Vec<TwoDexRoute>,
        min_confidence: f64,
    ) -> Vec<TwoDexRoute> {
        routes
            .into_iter()
            .filter(|route| route.confidence_score >= min_confidence)
            .collect()
    }
    
    /// Agrupa rutas por chain (array dinámico)
    pub fn group_by_chain(
        &self,
        routes: Vec<TwoDexRoute>,
    ) -> HashMap<String, Vec<TwoDexRoute>> {
        let mut grouped: HashMap<String, Vec<TwoDexRoute>> = HashMap::new();
        
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
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_two_dex_pathfinding() {
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
        ];
        
        let pathfinder = TwoDexPathfinder::new(dexes);
        
        // Test básico de creación
        assert_eq!(pathfinder.dexes.len(), 2);
    }
    
    #[test]
    fn test_profit_calculation() {
        let pathfinder = TwoDexPathfinder::new(vec![]);
        
        let profit = pathfinder.calculate_route_profit(
            1000.0,  // $1000 inicial
            1.1,     // +10% en swap 1
            1.05,    // +5% en swap 2
            1.02,    // +2% en swap 3
            0.3,     // 0.3% fee
            0.25,    // 0.25% fee
        );
        
        // Debería haber profit positivo
        assert!(profit > 0.0);
    }
}

