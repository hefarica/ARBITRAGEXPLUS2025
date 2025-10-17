//! Pricing module for calculating optimal execution prices

pub mod dex_pricing;

pub use dex_pricing::{
    DexPricingEngine,
    DexType,
    PoolConfig,
    PricingResult,
    PoolStats,
};

pub struct PricingEngine {
    pub slippage_tolerance: f64,
}

impl PricingEngine {
    pub fn new(slippage_tolerance: f64) -> Self {
        PricingEngine { slippage_tolerance }
    }

    pub fn calculate_output(&self, input_amount: f64, reserve_in: f64, reserve_out: f64) -> f64 {
        // Fórmula de Uniswap V2: (input * 997 * reserve_out) / (reserve_in * 1000 + input * 997)
        let input_with_fee = input_amount * 0.997;
        (input_with_fee * reserve_out) / (reserve_in + input_with_fee)
    }

    pub fn calculate_price_impact(&self, input_amount: f64, reserve_in: f64, reserve_out: f64) -> f64 {
        let output = self.calculate_output(input_amount, reserve_in, reserve_out);
        let spot_price = reserve_out / reserve_in;
        let execution_price = output / input_amount;
        ((spot_price - execution_price) / spot_price) * 100.0
    }
}
