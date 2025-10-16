//! Arbitrage Engine - Motor principal de detección de arbitraje
//!
//! Integra los algoritmos de pathfinding (2-DEX, 3-DEX) con el sistema
//! de ranking para encontrar las mejores oportunidades de arbitraje.
//!
//! Premisas:
//! 1. Datos desde Google Sheets/APIs (no hardcoded)
//! 2. Usa arrays dinámicos (Vec, HashMap, iteradores)
//! 3. Consumido por el API server y ejecutor

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::pathfinding::{
    TwoDexPathfinder, ThreeDexPathfinder, RouteRanker,
    TwoDexRoute, ThreeDexRoute, RankedRoute, RankingCriteria
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageConfig {
    pub min_profit_usd: f64,
    pub max_gas_cost_usd: f64,
    pub min_confidence: f64,
    pub max_routes: usize,
    pub enable_2dex: bool,
    pub enable_3dex: bool,
    pub ranking_criteria: RankingCriteria,
}

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
pub struct ArbitrageOpportunity {
    pub id: String,
    pub route_type: String, // "2-DEX" or "3-DEX"
    pub dexes: Vec<String>,
    pub tokens: Vec<String>,
    pub expected_profit: f64,
    pub gas_cost: f64,
    pub net_profit: f64,
    pub confidence_score: f64,
    pub rank_score: f64,
    pub rank_position: usize,
}

/// Motor principal de arbitraje
pub struct ArbitrageEngine {
    config: ArbitrageConfig,
    dexes: Vec<DexInfo>,
    prices: HashMap<String, HashMap<String, TokenPair>>,
}

impl ArbitrageEngine {
    /// Crea un nuevo motor con configuración desde Sheets
    pub fn new(config: ArbitrageConfig, dexes: Vec<DexInfo>) -> Self {
        Self {
            config,
            dexes,
            prices: HashMap::new(),
        }
    }
    
    /// Actualiza precios desde fuentes externas (Pyth, DEX APIs)
    pub fn update_prices(&mut self, prices: HashMap<String, HashMap<String, TokenPair>>) {
        self.prices = prices;
    }
    
    /// Encuentra todas las oportunidades de arbitraje
    pub fn find_opportunities(
        &self,
        start_token: &str,
    ) -> Vec<ArbitrageOpportunity> {
        let mut all_opportunities = Vec::new();
        
        // 1. Buscar rutas de 2-DEX si está habilitado
        if self.config.enable_2dex {
            let two_dex_routes = self.find_2dex_routes(start_token);
            all_opportunities.extend(two_dex_routes);
        }
        
        // 2. Buscar rutas de 3-DEX si está habilitado
        if self.config.enable_3dex {
            let three_dex_routes = self.find_3dex_routes(start_token);
            all_opportunities.extend(three_dex_routes);
        }
        
        // 3. Rankear todas las oportunidades
        let ranked = self.rank_opportunities(all_opportunities);
        
        // 4. Filtrar por criterios de calidad
        let filtered = self.filter_opportunities(ranked);
        
        // 5. Limitar al máximo configurado
        filtered.into_iter()
            .take(self.config.max_routes)
            .collect()
    }
    
    /// Busca rutas de 2-DEX
    fn find_2dex_routes(&self, start_token: &str) -> Vec<ArbitrageOpportunity> {
        let mut pathfinder = TwoDexPathfinder::new(self.dexes.clone());
        pathfinder.load_prices(self.prices.clone());
        
        let routes = pathfinder.find_profitable_routes(
            start_token,
            self.config.min_profit_usd,
            self.config.max_gas_cost_usd,
        );
        
        // Convertir a ArbitrageOpportunity (array dinámico)
        routes.into_iter()
            .enumerate()
            .map(|(idx, route)| ArbitrageOpportunity {
                id: format!("2DEX_{}", idx),
                route_type: "2-DEX".to_string(),
                dexes: vec![route.dex_1.clone(), route.dex_2.clone()],
                tokens: vec![
                    route.token_start.clone(),
                    route.token_mid.clone(),
                    route.token_end.clone(),
                ],
                expected_profit: route.expected_profit,
                gas_cost: route.gas_cost,
                net_profit: route.net_profit,
                confidence_score: route.confidence_score,
                rank_score: 0.0, // Se calculará después
                rank_position: 0,
            })
            .collect()
    }
    
    /// Busca rutas de 3-DEX
    fn find_3dex_routes(&self, start_token: &str) -> Vec<ArbitrageOpportunity> {
        let mut pathfinder = ThreeDexPathfinder::new(self.dexes.clone());
        pathfinder.load_prices(self.prices.clone());
        
        let routes = pathfinder.find_profitable_routes(
            start_token,
            self.config.min_profit_usd,
            self.config.max_gas_cost_usd,
        );
        
        // Convertir a ArbitrageOpportunity (array dinámico)
        routes.into_iter()
            .enumerate()
            .map(|(idx, route)| ArbitrageOpportunity {
                id: format!("3DEX_{}", idx),
                route_type: "3-DEX".to_string(),
                dexes: vec![
                    route.dex_1.clone(),
                    route.dex_2.clone(),
                    route.dex_3.clone(),
                ],
                tokens: route.tokens.clone(),
                expected_profit: route.expected_profit,
                gas_cost: route.gas_cost,
                net_profit: route.net_profit,
                confidence_score: route.confidence_score,
                rank_score: 0.0, // Se calculará después
                rank_position: 0,
            })
            .collect()
    }
    
    /// Rankea oportunidades usando el sistema de ranking
    fn rank_opportunities(
        &self,
        opportunities: Vec<ArbitrageOpportunity>,
    ) -> Vec<ArbitrageOpportunity> {
        // Convertir a formato de Route para el ranker
        let routes: Vec<crate::pathfinding::ranking::Route> = opportunities
            .iter()
            .map(|opp| crate::pathfinding::ranking::Route {
                id: opp.id.clone(),
                dexes: opp.dexes.clone(),
                tokens: opp.tokens.clone(),
                expected_profit: opp.expected_profit,
                gas_cost: opp.gas_cost,
                net_profit: opp.net_profit,
                confidence_score: opp.confidence_score,
                complexity_score: if opp.route_type == "2-DEX" { 0.8 } else { 0.6 },
            })
            .collect();
        
        // Rankear usando el RouteRanker
        let ranker = RouteRanker::new(self.config.ranking_criteria.clone());
        let ranked_routes = ranker.rank_routes(routes);
        
        // Convertir de vuelta a ArbitrageOpportunity (array dinámico)
        ranked_routes.into_iter()
            .zip(opportunities.into_iter())
            .map(|(ranked, mut opp)| {
                opp.rank_score = ranked.rank_score;
                opp.rank_position = ranked.rank_position;
                opp
            })
            .collect()
    }
    
    /// Filtra oportunidades por criterios de calidad
    fn filter_opportunities(
        &self,
        opportunities: Vec<ArbitrageOpportunity>,
    ) -> Vec<ArbitrageOpportunity> {
        opportunities
            .into_iter()
            .filter(|opp| {
                // Filtrar por confidence mínimo
                opp.confidence_score >= self.config.min_confidence
                    // Filtrar por profit positivo
                    && opp.net_profit > 0.0
                    // Filtrar por gas cost máximo
                    && opp.gas_cost <= self.config.max_gas_cost_usd
            })
            .collect()
    }
    
    /// Agrupa oportunidades por chain (array dinámico)
    pub fn group_by_chain(
        &self,
        opportunities: Vec<ArbitrageOpportunity>,
    ) -> HashMap<String, Vec<ArbitrageOpportunity>> {
        let mut grouped: HashMap<String, Vec<ArbitrageOpportunity>> = HashMap::new();
        
        for opp in opportunities {
            // Buscar chain del primer DEX
            if let Some(dex) = self.dexes.iter().find(|d| d.id == opp.dexes[0]) {
                grouped
                    .entry(dex.chain.clone())
                    .or_insert_with(Vec::new)
                    .push(opp);
            }
        }
        
        grouped
    }
    
    /// Calcula métricas agregadas de oportunidades
    pub fn calculate_metrics(
        &self,
        opportunities: &[ArbitrageOpportunity],
    ) -> ArbitrageMetrics {
        if opportunities.is_empty() {
            return ArbitrageMetrics::default();
        }
        
        // Calcular totales usando iteradores (arrays dinámicos)
        let total_profit: f64 = opportunities.iter()
            .map(|opp| opp.net_profit)
            .sum();
        
        let total_gas: f64 = opportunities.iter()
            .map(|opp| opp.gas_cost)
            .sum();
        
        let avg_confidence: f64 = opportunities.iter()
            .map(|opp| opp.confidence_score)
            .sum::<f64>() / opportunities.len() as f64;
        
        let avg_rank: f64 = opportunities.iter()
            .map(|opp| opp.rank_score)
            .sum::<f64>() / opportunities.len() as f64;
        
        // Contar por tipo (array dinámico)
        let two_dex_count = opportunities.iter()
            .filter(|opp| opp.route_type == "2-DEX")
            .count();
        
        let three_dex_count = opportunities.iter()
            .filter(|opp| opp.route_type == "3-DEX")
            .count();
        
        ArbitrageMetrics {
            total_opportunities: opportunities.len(),
            total_expected_profit: total_profit,
            total_gas_cost: total_gas,
            avg_confidence_score: avg_confidence,
            avg_rank_score: avg_rank,
            two_dex_routes: two_dex_count,
            three_dex_routes: three_dex_count,
        }
    }
    
    /// Actualiza configuración dinámicamente desde Sheets
    pub fn update_config(&mut self, config: ArbitrageConfig) {
        self.config = config;
    }
    
    /// Actualiza lista de DEXs dinámicamente desde Sheets
    pub fn update_dexes(&mut self, dexes: Vec<DexInfo>) {
        self.dexes = dexes;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArbitrageMetrics {
    pub total_opportunities: usize,
    pub total_expected_profit: f64,
    pub total_gas_cost: f64,
    pub avg_confidence_score: f64,
    pub avg_rank_score: f64,
    pub two_dex_routes: usize,
    pub three_dex_routes: usize,
}

impl Default for ArbitrageConfig {
    fn default() -> Self {
        Self {
            min_profit_usd: 10.0,
            max_gas_cost_usd: 50.0,
            min_confidence: 0.7,
            max_routes: 10,
            enable_2dex: true,
            enable_3dex: true,
            ranking_criteria: RankingCriteria {
                profit_weight: 0.35,
                confidence_weight: 0.25,
                complexity_weight: 0.15,
                gas_efficiency_weight: 0.15,
                liquidity_weight: 0.10,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_arbitrage_engine_creation() {
        let config = ArbitrageConfig::default();
        let dexes = vec![
            DexInfo {
                id: "uniswap".to_string(),
                name: "Uniswap V3".to_string(),
                chain: "ethereum".to_string(),
                fee_percentage: 0.3,
                liquidity_usd: 5_000_000_000.0,
            },
        ];
        
        let engine = ArbitrageEngine::new(config, dexes);
        assert_eq!(engine.dexes.len(), 1);
    }
    
    #[test]
    fn test_metrics_calculation() {
        let config = ArbitrageConfig::default();
        let engine = ArbitrageEngine::new(config, vec![]);
        
        let opportunities = vec![
            ArbitrageOpportunity {
                id: "test1".to_string(),
                route_type: "2-DEX".to_string(),
                dexes: vec![],
                tokens: vec![],
                expected_profit: 100.0,
                gas_cost: 20.0,
                net_profit: 80.0,
                confidence_score: 0.8,
                rank_score: 0.9,
                rank_position: 1,
            },
        ];
        
        let metrics = engine.calculate_metrics(&opportunities);
        assert_eq!(metrics.total_opportunities, 1);
        assert_eq!(metrics.total_expected_profit, 80.0);
    }
}

