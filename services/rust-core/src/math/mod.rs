//! Mathematical utilities for arbitrage calculations.

pub fn calculate_profit(amount_in: f64, amount_out: f64) -> f64 {
    amount_out - amount_in
}

pub fn calculate_slippage(expected: f64, actual: f64) -> f64 {
    (expected - actual) / expected
}

