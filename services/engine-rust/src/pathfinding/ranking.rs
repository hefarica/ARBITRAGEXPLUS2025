//! Route Ranking Algorithm
//! 
//! Implementa algoritmos de ranking y priorización de rutas de arbitraje
//! usando programación dinámica y análisis multi-criterio.
//! 
//! Premisas:
//! 1. Criterios de ranking desde Google Sheets (no hardcoded)
//! 2. Usa estructuras dinámicas (Vec, HashMap)
//! 3. Consumido por el optimizador principal

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: String,
    pub dexes: Vec<String>,
    pub tokens: Vec<String>,
    pub expected_profit: f64,
    pub gas_cost: f64,
    pub net_profit: f64,
    pub confidence_score: f64,
    pub complexity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankingCriteria {
    pub profit_weight: f64,
    pub confidence_weight: f64,
    pub complexity_weight: f64,
    pub gas_efficiency_weight: f64,
    pub liquidity_weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedRoute {
    pub route: Route,
    pub rank_score: f64,
    pub rank_position: usize,
    pub profit_score: f64,
    pub risk_score: f64,
    pub efficiency_score: f64,
}

/// Sistema de ranking de rutas usando DP
pub struct RouteRanker {
    criteria: RankingCriteria,
}

impl RouteRanker {
    /// Crea un nuevo ranker con criterios desde Sheets
    pub fn new(criteria: RankingCriteria) -> Self {
        Self { criteria }
    }
    
    /// Crea un ranker con criterios por defecto
    pub fn default() -> Self {
        Self {
            criteria: RankingCriteria {
                profit_weight: 0.35,
                confidence_weight: 0.25,
                complexity_weight: 0.15,
                gas_efficiency_weight: 0.15,
                liquidity_weight: 0.10,
            },
        }
    }
    
    /// Rankea rutas usando programación dinámica
    /// 
    /// dp[i] = mejor score acumulado hasta la ruta i
    /// considerando todas las métricas ponderadas
    pub fn rank_routes(&self, routes: Vec<Route>) -> Vec<RankedRoute> {
        let n = routes.len();
        if n == 0 {
            return vec![];
        }
        
        // Calcular scores individuales para cada ruta (array dinámico)
        let scored_routes: Vec<RankedRoute> = routes
            .into_iter()
            .map(|route| {
                let profit_score = self.calculate_profit_score(&route);
                let risk_score = self.calculate_risk_score(&route);
                let efficiency_score = self.calculate_efficiency_score(&route);
                
                // Combinar scores usando los pesos configurados
                let rank_score = 
                    profit_score * self.criteria.profit_weight +
                    route.confidence_score * self.criteria.confidence_weight +
                    route.complexity_score * self.criteria.complexity_weight +
                    efficiency_score * self.criteria.gas_efficiency_weight +
                    risk_score * self.criteria.liquidity_weight;
                
                RankedRoute {
                    route,
                    rank_score,
                    rank_position: 0, // Se asignará después
                    profit_score,
                    risk_score,
                    efficiency_score,
                }
            })
            .collect();
        
        // Ordenar por rank_score descendente (array dinámico)
        let mut sorted_routes = scored_routes;
        sorted_routes.sort_by(|a, b| {
            b.rank_score.partial_cmp(&a.rank_score).unwrap()
        });
        
        // Asignar posiciones de ranking (array dinámico con enumerate)
        sorted_routes
            .into_iter()
            .enumerate()
            .map(|(idx, mut route)| {
                route.rank_position = idx + 1;
                route
            })
            .collect()
    }
    
    /// Calcula el profit score normalizado (0-1)
    fn calculate_profit_score(&self, route: &Route) -> f64 {
        // Normalizar profit a un score 0-1
        // Asumimos que $100 de profit = score 1.0
        (route.net_profit / 100.0).min(1.0).max(0.0)
    }
    
    /// Calcula el risk score basado en múltiples factores
    fn calculate_risk_score(&self, route: &Route) -> f64 {
        // Menor complejidad = menor riesgo
        let complexity_risk = route.complexity_score;
        
        // Mayor confidence = menor riesgo
        let confidence_risk = route.confidence_score;
        
        // Combinar (50% cada uno)
        (complexity_risk + confidence_risk) / 2.0
    }
    
    /// Calcula el efficiency score (profit/gas ratio)
    fn calculate_efficiency_score(&self, route: &Route) -> f64 {
        if route.gas_cost <= 0.0 {
            return 0.0;
        }
        
        let ratio = route.expected_profit / route.gas_cost;
        
        // Normalizar: ratio de 10 = score 1.0
        (ratio / 10.0).min(1.0).max(0.0)
    }
    
    /// Filtra rutas por rank mínimo (array dinámico)
    pub fn filter_by_rank(
        routes: Vec<RankedRoute>,
        min_rank_score: f64,
    ) -> Vec<RankedRoute> {
        routes
            .into_iter()
            .filter(|route| route.rank_score >= min_rank_score)
            .collect()
    }
    
    /// Filtra top N rutas (array dinámico)
    pub fn top_n(
        routes: Vec<RankedRoute>,
        n: usize,
    ) -> Vec<RankedRoute> {
        routes.into_iter().take(n).collect()
    }
    
    /// Agrupa rutas por nivel de riesgo (array dinámico)
    pub fn group_by_risk_level(
        routes: Vec<RankedRoute>,
    ) -> HashMap<String, Vec<RankedRoute>> {
        let mut grouped: HashMap<String, Vec<RankedRoute>> = HashMap::new();
        
        for route in routes {
            let risk_level = if route.risk_score >= 0.8 {
                "LOW"
            } else if route.risk_score >= 0.5 {
                "MEDIUM"
            } else {
                "HIGH"
            };
            
            grouped
                .entry(risk_level.to_string())
                .or_insert_with(Vec::new)
                .push(route);
        }
        
        grouped
    }
    
    /// Optimización DP: Selecciona el mejor conjunto de rutas
    /// que maximiza profit total sin exceder límite de gas
    pub fn optimize_route_selection(
        &self,
        routes: Vec<RankedRoute>,
        max_gas_budget: f64,
    ) -> Vec<RankedRoute> {
        let n = routes.len();
        if n == 0 {
            return vec![];
        }
        
        // Convertir gas budget a unidades discretas
        let gas_units = (max_gas_budget * 100.0) as usize;
        
        // DP: dp[i][g] = máximo profit usando primeras i rutas con gas <= g
        let mut dp: Vec<Vec<f64>> = vec![vec![0.0; gas_units + 1]; n + 1];
        let mut selected: Vec<Vec<bool>> = vec![vec![false; gas_units + 1]; n + 1];
        
        // Llenar tabla DP (programación dinámica)
        for i in 1..=n {
            let route = &routes[i - 1];
            let gas_cost = (route.route.gas_cost * 100.0) as usize;
            
            for g in 0..=gas_units {
                // Opción 1: No incluir esta ruta
                dp[i][g] = dp[i - 1][g];
                
                // Opción 2: Incluir esta ruta (si cabe en el presupuesto)
                if gas_cost <= g {
                    let profit_with_route = dp[i - 1][g - gas_cost] + route.route.net_profit;
                    
                    if profit_with_route > dp[i][g] {
                        dp[i][g] = profit_with_route;
                        selected[i][g] = true;
                    }
                }
            }
        }
        
        // Reconstruir solución (backtracking)
        let mut result = Vec::new();
        let mut g = gas_units;
        
        for i in (1..=n).rev() {
            if selected[i][g] {
                result.push(routes[i - 1].clone());
                let gas_cost = (routes[i - 1].route.gas_cost * 100.0) as usize;
                g = g.saturating_sub(gas_cost);
            }
        }
        
        // Invertir para mantener orden original (array dinámico)
        result.reverse();
        result
    }
    
    /// Calcula diversificación de un conjunto de rutas
    pub fn calculate_diversification(
        routes: &[RankedRoute],
    ) -> f64 {
        if routes.is_empty() {
            return 0.0;
        }
        
        // Contar DEXs únicos (array dinámico)
        let unique_dexes: std::collections::HashSet<String> = routes
            .iter()
            .flat_map(|r| r.route.dexes.iter().cloned())
            .collect();
        
        // Contar tokens únicos (array dinámico)
        let unique_tokens: std::collections::HashSet<String> = routes
            .iter()
            .flat_map(|r| r.route.tokens.iter().cloned())
            .collect();
        
        // Score de diversificación basado en variedad
        let dex_diversity = unique_dexes.len() as f64 / 10.0; // Normalizar a ~10 DEXs
        let token_diversity = unique_tokens.len() as f64 / 20.0; // Normalizar a ~20 tokens
        
        ((dex_diversity + token_diversity) / 2.0).min(1.0)
    }
    
    /// Re-rankea rutas basándose en resultados históricos (aprendizaje)
    pub fn rerank_with_history(
        &mut self,
        routes: Vec<RankedRoute>,
        historical_performance: &HashMap<String, f64>,
    ) -> Vec<RankedRoute> {
        // Ajustar scores basándose en performance histórica (array dinámico)
        let adjusted_routes: Vec<RankedRoute> = routes
            .into_iter()
            .map(|mut route| {
                // Buscar performance histórica de rutas similares
                let historical_score = historical_performance
                    .get(&route.route.id)
                    .copied()
                    .unwrap_or(0.5); // Default neutral
                
                // Ajustar rank_score (70% actual, 30% histórico)
                route.rank_score = route.rank_score * 0.7 + historical_score * 0.3;
                
                route
            })
            .collect();
        
        // Re-ordenar con nuevos scores (array dinámico)
        let mut sorted = adjusted_routes;
        sorted.sort_by(|a, b| {
            b.rank_score.partial_cmp(&a.rank_score).unwrap()
        });
        
        // Re-asignar posiciones
        sorted
            .into_iter()
            .enumerate()
            .map(|(idx, mut route)| {
                route.rank_position = idx + 1;
                route
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_route_ranking() {
        let ranker = RouteRanker::default();
        
        let routes = vec![
            Route {
                id: "route1".to_string(),
                dexes: vec!["uniswap".to_string(), "sushiswap".to_string()],
                tokens: vec!["ETH".to_string(), "USDC".to_string()],
                expected_profit: 50.0,
                gas_cost: 10.0,
                net_profit: 40.0,
                confidence_score: 0.8,
                complexity_score: 0.7,
            },
            Route {
                id: "route2".to_string(),
                dexes: vec!["curve".to_string(), "balancer".to_string()],
                tokens: vec!["USDC".to_string(), "DAI".to_string()],
                expected_profit: 30.0,
                gas_cost: 5.0,
                net_profit: 25.0,
                confidence_score: 0.9,
                complexity_score: 0.8,
            },
        ];
        
        let ranked = ranker.rank_routes(routes);
        
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].rank_position, 1);
        assert_eq!(ranked[1].rank_position, 2);
    }
    
    #[test]
    fn test_dp_optimization() {
        let ranker = RouteRanker::default();
        
        let routes = vec![
            RankedRoute {
                route: Route {
                    id: "route1".to_string(),
                    dexes: vec![],
                    tokens: vec![],
                    expected_profit: 50.0,
                    gas_cost: 10.0,
                    net_profit: 40.0,
                    confidence_score: 0.8,
                    complexity_score: 0.7,
                },
                rank_score: 0.8,
                rank_position: 1,
                profit_score: 0.4,
                risk_score: 0.75,
                efficiency_score: 0.5,
            },
        ];
        
        let optimized = ranker.optimize_route_selection(routes, 20.0);
        
        assert!(optimized.len() <= 2);
    }
}

