//! Domain models for the arbitrage engine.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Asset {
    pub symbol: String,
    pub address: String,
    pub chain_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pool {
    pub address: String,
    pub token_a: Asset,
    pub token_b: Asset,
    pub fee: u32,
    pub protocol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteStep {
    pub pool: Pool,
    pub asset_in: Asset,
    pub asset_out: Asset,
    pub amount_in: String, // Using String for large numbers
    pub amount_out: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: String,
    pub steps: Vec<RouteStep>,
    pub profit_asset: Asset,
    pub profit_amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Opportunity {
    pub id: String,
    pub routes: Vec<Route>,
    pub detected_at: u64,
    pub expiration_at: u64,
}

