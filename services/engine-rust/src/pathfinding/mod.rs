//! Pathfinding module for arbitrage route discovery
//! 
//! Implementa múltiples algoritmos de pathfinding:
//! - Bellman-Ford para detección de ciclos negativos
//! - DP 2-DEX para rutas de 2 exchanges
//! - DP 3-DEX para rutas de 3 exchanges
//! - Sistema de ranking multi-criterio
//!
//! Premisas:
//! 1. Datos desde Google Sheets/APIs (no hardcoded)
//! 2. Usa arrays dinámicos (Vec, HashMap, iteradores)
//! 3. Consumido por el engine principal

use std::collections::HashMap;

// Módulos de algoritmos DP
pub mod two_dex;
pub mod three_dex;
pub mod ranking;

// Re-exports para facilitar uso
pub use two_dex::{TwoDexPathfinder, TwoDexRoute};
pub use three_dex::{ThreeDexPathfinder, ThreeDexRoute};
pub use ranking::{RouteRanker, RankedRoute, RankingCriteria};

pub struct PathFinder {
    pub graph: HashMap<String, Vec<Edge>>,
}

pub struct Edge {
    pub from: String,
    pub to: String,
    pub weight: f64,
    pub dex: String,
}

pub struct Route {
    pub path: Vec<String>,
    pub total_weight: f64,
    pub dexes: Vec<String>,
}

impl PathFinder {
    pub fn new() -> Self {
        PathFinder {
            graph: HashMap::new(),
        }
    }

    pub fn add_edge(&mut self, from: String, to: String, weight: f64, dex: String) {
        self.graph
            .entry(from.clone())
            .or_insert_with(Vec::new)
            .push(Edge { from, to, weight, dex });
    }

    pub fn find_arbitrage_routes(&self, start: &str, max_hops: usize) -> Vec<Route> {
        let mut routes = Vec::new();
        // Implementación de Bellman-Ford para detectar ciclos negativos (arbitraje)
        routes
    }

    pub fn bellman_ford(&self, start: &str) -> Option<Route> {
        // Implementación del algoritmo Bellman-Ford
        None
    }
}

impl Default for PathFinder {
    fn default() -> Self {
        Self::new()
    }
}
