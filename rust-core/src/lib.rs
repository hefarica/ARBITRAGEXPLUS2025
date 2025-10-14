pub mod domain {
    #[derive(Debug, Clone)]
    pub struct Quote { pub amount_in: f64, pub amount_out: f64 }
}
pub mod math {
    pub fn price_after_fee(px: f64, fee_bps: f64) -> f64 { px * (1.0 - fee_bps/10_000.0) }
}
